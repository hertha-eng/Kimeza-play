import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/lib/supabase";
import type { GameChallenge, GameChallengeResponse, GameRoomSession } from "../../src/games/room-types";

type LaunchResult = { launched?: boolean; reason?: string; match_id?: string; room_code?: string };

export default function GameRoomsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string }>();
  const [session, setSession] = useState<GameRoomSession | null>(null);
  const [challenges, setChallenges] = useState<GameChallenge[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [title, setTitle] = useState("Kimeza Game Room");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [launchBusyId, setLaunchBusyId] = useState("");
  const knownStatuses = useRef<Record<string, string>>({});
  const redirectedMatch = useRef("");

  const loadRoom = useCallback(async (id: string) => {
    if (!supabase) return;
    const [roomResult, challengeResult] = await Promise.all([
      supabase.rpc("get_game_room_session", { p_room_session_id: id }),
      supabase.rpc("get_game_room_challenges", { p_room_session_id: id }),
    ]);
    if (roomResult.error) {
      setError(roomResult.error.message);
      return;
    }
    setSession(roomResult.data as unknown as GameRoomSession);
    if (challengeResult.error) {
      setError(challengeResult.error.message);
      return;
    }
    const next = (challengeResult.data || []) as unknown as GameChallenge[];
    setChallenges(next);
    for (const challenge of next) {
      const previousStatus = knownStatuses.current[challenge.id];
      if (challenge.status === "launched" && previousStatus === "accepted" &&
          challenge.launched_match_id &&
          (challenge.challenger_id === currentUserId || challenge.challenged_id === currentUserId) &&
          redirectedMatch.current !== challenge.launched_match_id) {
        redirectedMatch.current = challenge.launched_match_id;
        router.replace({ pathname: "/games/word-chain", params: { room: challenge.launched_match_id } });
      }
      knownStatuses.current[challenge.id] = challenge.status;
    }
    setError("");
  }, [currentUserId, router]);

  useEffect(() => {
    let alive = true;
    void supabase?.auth.getUser().then(({ data }) => {
      if (alive) setCurrentUserId(data.user?.id || "");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!params.room) return;
    void loadRoom(params.room);
    const poll = setInterval(() => void loadRoom(params.room!), 2500);
    return () => clearInterval(poll);
  }, [params.room, loadRoom]);

  async function createRoom() {
    if (!supabase || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: e } = await supabase.rpc("create_game_room_session", {
        p_title: title, p_expires_minutes: 120,
      });
      if (e) throw e;
      const result = data as unknown as { id: string; room_code: string };
      router.replace({ pathname: "/games/rooms", params: { room: result.id } });
      setJoinCode(result.room_code);
      setNotice("Your room is ready. Share its code with fellow active club members.");
    } catch (e: any) {
      setError(e?.message || "Could not create the room.");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    if (!supabase || busy || joinCode.trim().length !== 6) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: e } = await supabase.rpc("join_game_room_session", {
        p_room_code: joinCode.trim().toUpperCase(),
      });
      if (e) throw e;
      const result = data as unknown as { room_session_id: string };
      router.replace({ pathname: "/games/rooms", params: { room: result.room_session_id } });
      setNotice("You joined the room as a watcher.");
    } catch (e: any) {
      setError(e?.message || "Could not join the room.");
    } finally { setBusy(false); }
  }

  async function challengeMember(userId: string) {
    if (!supabase || !session || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: e } = await supabase.rpc("create_game_challenge", {
        p_room_session_id: session.id,
        p_game_code: "word_chain",
        p_challenged_id: userId,
      });
      if (e) throw e;
      setNotice("Challenge sent. The other member must accept before it enters the queue.");
      await loadRoom(session.id);
    } catch (e: any) {
      setError(e?.message || "Could not send the challenge.");
    } finally { setBusy(false); }
  }

  async function respond(challengeId: string, accept: boolean) {
    if (!supabase || !session || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: e } = await supabase.rpc("respond_game_challenge", {
        p_challenge_id: challengeId, p_accept: accept,
      });
      if (e) throw e;
      const result = data as unknown as GameChallengeResponse;
      const launch = result.launch as LaunchResult | undefined;
      if (accept && launch?.launched && launch.match_id) {
        router.replace({ pathname: "/games/word-chain", params: { room: launch.match_id } });
        return;
      }
      setNotice(accept
        ? launch?.reason === "room_has_active_match"
          ? `Challenge accepted and added to queue at position ${result.queue_position}. It will launch when the current match ends.`
          : "Challenge accepted and added to the room queue."
        : "Challenge declined.");
      await loadRoom(session.id);
    } catch (e: any) {
      setError(e?.message || "Could not respond to the challenge.");
    } finally { setBusy(false); }
  }

  async function leaveRoom() {
    if (!supabase || !session || busy) return;
    setBusy(true); setError("");
    try {
      const { error: e } = await supabase.rpc("leave_game_room_session", {
        p_room_session_id: session.id,
      });
      if (e) throw e;
      setSession(null); setChallenges([]); knownStatuses.current = {};
      router.replace("/games/rooms");
    } catch (e: any) { setError(e?.message || "Could not leave the room."); }
    finally { setBusy(false); }
  }

  async function closeRoom() {
    if (!supabase || !session || busy) return;
    setBusy(true); setError("");
    try {
      const { error: e } = await supabase.rpc("close_game_room_session", {
        p_room_session_id: session.id,
      });
      if (e) throw e;
      setNotice("Room closed. Its history has been retained.");
      await loadRoom(session.id);
    } catch (e: any) { setError(e?.message || "Could not close the room."); }
    finally { setBusy(false); }
  }

  const pendingForMe = challenges.filter(c => c.status === "pending" && c.challenged_id === currentUserId);
  const queued = challenges.filter(c => c.status === "accepted" || c.status === "launched");
  const members = session?.members || [];

  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.shell}>
      <Link href="/games" style={s.back}>‹  Back to games library</Link>
      <Text style={s.eyebrow}>KIMEZA PLAY • UNIVERSAL GAME ROOMS</Text>
      <Text style={s.title}>Game Rooms</Text>
      <Text style={s.subtitle}>A shared space for Rotary and Rotaract members to meet, challenge one another, play and watch. Members can move between player and watcher roles as each match ends.</Text>

      {!!error && <Text style={s.error}>{error}</Text>}
      {!!notice && <Text style={s.notice}>{notice}</Text>}

      {!session ? <>
        <View style={s.card}>
          <Text style={s.heading}>Create a room</Text>
          <Text style={s.muted}>Start a room and invite other active club members using its six-character code. The room remains open for up to two hours.</Text>
          <TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Room name" maxLength={60} />
          <Pressable disabled={busy} onPress={() => void createRoom()} style={[s.primary,busy&&s.disabled]}>
            <Text style={s.primaryText}>{busy ? "Please wait…" : "Create game room"}</Text>
          </Pressable>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Join a room</Text>
          <Text style={s.muted}>Enter a room code shared by another member.</Text>
          <TextInput value={joinCode} onChangeText={v=>setJoinCode(v.toUpperCase().replace(/[^A-Z0-9]/g,""))}
            style={s.input} placeholder="SIX-CHARACTER CODE" autoCapitalize="characters" maxLength={6} />
          <Pressable disabled={busy||joinCode.length!==6} onPress={()=>void joinRoom()} style={[s.secondary,(busy||joinCode.length!==6)&&s.disabled]}>
            <Text style={s.secondaryText}>Join room</Text>
          </Pressable>
        </View>
      </> : <>
        <View style={s.hero}>
          <Text style={s.heroLabel}>ROOM CODE</Text>
          <Text selectable style={s.roomCode}>{session.room_code || "—"}</Text>
          <Text style={s.heroTitle}>{session.title}</Text>
          <Text style={s.heroMeta}>{session.status.toUpperCase()} · {members.length} members present</Text>
        </View>

        <View style={s.card}>
          <Text style={s.heading}>Members in this room</Text>
          <Text style={s.muted}>Players and watchers can both challenge one another. When a match ends, its players return to the watcher role.</Text>
          {members.map(member => <View key={member.user_id} style={s.memberRow}>
            <View style={s.memberInfo}>
              <Text style={s.memberName}>{member.display_name || "Kimeza member"}{member.user_id===currentUserId?" (You)":""}</Text>
              <Text style={s.muted}>{member.member_role==="player"?"Player":"Watcher"}</Text>
            </View>
            {member.user_id!==currentUserId && <Pressable disabled={busy||session.status!=="open"} onPress={()=>void challengeMember(member.user_id)} style={[s.smallButton,(busy||session.status!=="open")&&s.disabled]}>
              <Text style={s.smallButtonText}>Challenge</Text>
            </Pressable>}
          </View>)}
        </View>

        {pendingForMe.length>0 && <View style={s.card}>
          <Text style={s.heading}>Challenges for you</Text>
          {pendingForMe.map(challenge=><View key={challenge.id} style={s.challengeRow}>
            <Text style={s.memberName}>{challenge.challenger_name} challenged you to Word Chain</Text>
            <View style={s.actions}>
              <Pressable disabled={busy} onPress={()=>void respond(challenge.id,true)} style={s.primarySmall}><Text style={s.primaryText}>Accept</Text></Pressable>
              <Pressable disabled={busy} onPress={()=>void respond(challenge.id,false)} style={s.secondarySmall}><Text style={s.secondaryText}>Decline</Text></Pressable>
            </View>
          </View>)}
        </View>}

        <View style={s.card}>
          <Text style={s.heading}>Challenge queue</Text>
          {queued.length===0 ? <Text style={s.muted}>No accepted challenges are waiting. Accepted challenges will appear here in order.</Text> :
            queued.map(challenge=><View key={challenge.id} style={s.challengeRow}>
              <View style={s.queueTop}>
                <Text style={s.memberName}>{challenge.challenger_name} vs {challenge.challenged_name}</Text>
                <Text style={s.queueStatus}>{challenge.status==="launched"?"MATCH READY":"QUEUED"}</Text>
              </View>
              <Text style={s.muted}>{challenge.game_code==="word_chain"?"Word Chain":challenge.game_code} · {challenge.status==="launched"?"Match created":`Queue position ${challenge.queue_position}`}</Text>
              {challenge.status==="launched" && challenge.launched_match_id &&
                (challenge.challenger_id===currentUserId||challenge.challenged_id===currentUserId) &&
                <Pressable disabled={launchBusyId===challenge.id} onPress={()=>{
                  setLaunchBusyId(challenge.id);
                  router.push({pathname:"/games/word-chain",params:{room:challenge.launched_match_id!}});
                }} style={s.secondary}><Text style={s.secondaryText}>Open match</Text></Pressable>}
            </View>)}
        </View>

        <View style={s.roomActions}>
          <Pressable disabled={busy} onPress={()=>void leaveRoom()} style={s.secondary}><Text style={s.secondaryText}>Leave room</Text></Pressable>
          {session.created_by===currentUserId && session.status==="open" &&
            <Pressable disabled={busy} onPress={()=>void closeRoom()} style={s.closeButton}><Text style={s.closeText}>Close room</Text></Pressable>}
        </View>
      </>}
    </View>
  </ScrollView>;
}

const s=StyleSheet.create({
  page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},
  shell:{width:"100%",maxWidth:780,alignSelf:"center",paddingVertical:20},
  back:{color:"#557168",fontWeight:"700",marginBottom:24},
  eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},
  title:{color:"#102A24",fontSize:30,fontWeight:"900",marginTop:7},
  subtitle:{color:"#66756D",lineHeight:22,marginTop:8,marginBottom:18},
  card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#E2E9E3",padding:18,marginBottom:14},
  heading:{color:"#153B30",fontSize:18,fontWeight:"900"},
  muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},
  input:{backgroundColor:"#F8FAF8",borderWidth:1,borderColor:"#DCE5DE",borderRadius:11,padding:14,color:"#18352C",marginTop:14,marginBottom:12},
  primary:{backgroundColor:"#153B30",borderRadius:11,padding:13,alignItems:"center",marginTop:6},
  primaryText:{color:"#fff",fontWeight:"900"},
  secondary:{backgroundColor:"#E7F0E9",borderRadius:11,padding:13,alignItems:"center",marginTop:8},
  secondaryText:{color:"#176B45",fontWeight:"900"},
  disabled:{opacity:.45},
  error:{color:"#B42318",backgroundColor:"#FEF3F2",padding:12,borderRadius:10,marginBottom:12},
  notice:{color:"#176B45",backgroundColor:"#ECFDF3",padding:12,borderRadius:10,marginBottom:12},
  hero:{backgroundColor:"#102A24",borderRadius:16,padding:20,marginBottom:14},
  heroLabel:{color:"#C2D3C8",fontSize:10,fontWeight:"900",letterSpacing:1.5},
  roomCode:{color:"#E2B55F",fontSize:30,fontWeight:"900",letterSpacing:5,marginTop:4},
  heroTitle:{color:"#fff",fontSize:20,fontWeight:"900",marginTop:12},
  heroMeta:{color:"#C2D3C8",fontSize:11,marginTop:6},
  memberRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,borderTopWidth:1,borderTopColor:"#EFF2EF",paddingVertical:11,marginTop:8},
  memberInfo:{flex:1},
  memberName:{color:"#153B30",fontWeight:"900"},
  smallButton:{backgroundColor:"#E7F0E9",borderRadius:9,paddingVertical:9,paddingHorizontal:12},
  smallButtonText:{color:"#176B45",fontSize:11,fontWeight:"900"},
  challengeRow:{borderTopWidth:1,borderTopColor:"#EFF2EF",paddingVertical:12,marginTop:8},
  actions:{flexDirection:"row",gap:8,marginTop:10},
  primarySmall:{backgroundColor:"#153B30",borderRadius:9,paddingVertical:9,paddingHorizontal:16},
  secondarySmall:{backgroundColor:"#E7F0E9",borderRadius:9,paddingVertical:9,paddingHorizontal:16},
  queueTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},
  queueStatus:{color:"#B17B27",fontSize:9,fontWeight:"900",letterSpacing:.8},
  roomActions:{gap:8,marginBottom:30},
  closeButton:{backgroundColor:"#FCEBE9",borderWidth:1,borderColor:"#F2C5C0",borderRadius:11,padding:13,alignItems:"center"},
  closeText:{color:"#B42318",fontWeight:"900"},
});
