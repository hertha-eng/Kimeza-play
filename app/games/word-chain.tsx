import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Player = { user_id: string; display_name: string; joined_at: string };
type Word = { word: string; user_id: string; turn: number; played_at: string; response_ms?: number };
type Reaction = { user_id: string; reaction: string; created_at: string };
type GameState = {
  words: Word[]; current_turn_user_id: string; turn_number: number; started: boolean;
  turn_deadline?: string; typing_deadline?: string; match_deadline?: string;
  turn_started_at?: string; live_draft_user_id?: string | null; live_draft?: string | null; winner_user_id?: string | null; end_reason?: string;
  final_counts?: Record<string, number>; missed_turns?: Record<string, number>; streaks?: Record<string, number>;
};
type Room = { id: string; title: string; game_code: string; status: string; room_code: string; created_by: string; room_expires_at?: string | null;
  max_players: number; turn_duration_seconds: number; match_duration_seconds: number; game_state: GameState; players: Player[]; reactions?: Reaction[] };

const DURATIONS = [{ label: "2 min", value: 120 }, { label: "3 min", value: 180 }, { label: "5 min", value: 300 }, { label: "10 min", value: 600 }, { label: "15 min", value: 900 }];

export default function GamesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string }>();
  const [room, setRoom] = useState<Room | null>(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("Word Chain");
  const [word, setWord] = useState("");
  const [duration, setDuration] = useState(300);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejection, setRejection] = useState<{ word: string; reason: string } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const startedTyping = useRef(false);
  const autoSubmittedFor = useRef("");
  const busyRef = useRef(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = (e: any) => setError(e?.message || "Something went wrong. Please try again.");
  const accept = (data: any) => { if (data) { setRoom(data as Room); setCode(data.room_code || ""); } };
  const loadRoom = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data, error: e } = await supabase.rpc("get_word_chain_room", { p_match_id: id });
    if (e) handleError(e); else accept(data);
  }, []);

  useEffect(() => {
    let alive = true;
    void supabase?.auth.getUser().then(({ data }) => { if (alive) setCurrentUserId(data.user?.id || ""); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (params.room) void loadRoom(params.room); }, [params.room, loadRoom]);
  useEffect(() => {
    if (!room?.id) return;
    const poll = setInterval(() => void loadRoom(room.id), 1200);
    return () => clearInterval(poll);
  }, [room?.id, loadRoom]);

  useEffect(() => {
    if (room?.status !== "in_progress") { setSeconds(0); setMatchSeconds(0); return; }
    const tick = () => {
      const now = Date.now();
      setSeconds(room.game_state.turn_deadline ? Math.max(0, Math.ceil((new Date(room.game_state.turn_deadline).getTime() - now) / 1000)) : 0);
      setMatchSeconds(Math.max(0, Math.ceil((new Date(room.game_state.match_deadline || 0).getTime() - now) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [room?.status, room?.game_state?.turn_deadline, room?.game_state?.match_deadline]);

  useEffect(() => {
    if (room?.status !== "in_progress" || !room.game_state.turn_deadline || seconds > 0 || busyRef.current) return;
    const key = room.id + ":" + room.game_state.turn_deadline;
    if (autoSubmittedFor.current === key) return;
    autoSubmittedFor.current = key;
    if (room.game_state.current_turn_user_id === currentUserId) void submitWord(true);
    else {
      const graceTimer = setTimeout(() => void passExpiredTurn(), 2300);
      return () => clearTimeout(graceTimer);
    }
  }, [seconds, room?.id, room?.status, room?.game_state?.turn_deadline, currentUserId]);

  useEffect(() => {
    if (room?.status !== "in_progress" || matchSeconds > 0 || busyRef.current) return;
    void finishMatch();
  }, [matchSeconds, room?.id, room?.status]);

  async function action(fn: () => PromiseLike<any>, success?: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: e } = await fn();
      if (e) throw e;
      if (data) accept(data);
      if (success) setNotice(success);
      return data;
    } catch (e) { handleError(e); return null; }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function create() {
    await action(() => supabase!.rpc("create_word_chain_room", {
      p_title: title, p_turn_seconds: 30, p_match_seconds: duration
    }), "Room created. Share the code with one other active club member.");
  }
  async function join() {
    await action(() => supabase!.rpc("join_word_chain_room", { p_room_code: code }), "You joined the room.");
  }
  async function start() {
    if (!room) return;
    startedTyping.current = false; autoSubmittedFor.current = "";
    await action(() => supabase!.rpc("start_word_chain_room", { p_match_id: room.id }), "Game started. Each player has 30 seconds to enter and submit a word.");
  }
  async function shareDraft(value: string) {
    if (!room || room.game_state.current_turn_user_id !== currentUserId || !startedTyping.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void supabase!.rpc("update_word_chain_draft", { p_match_id: room.id, p_draft: value });
    }, 350);
  }
  async function beginTyping() {
    if (!room || startedTyping.current || room.game_state.current_turn_user_id !== currentUserId) return;
    startedTyping.current = true;
    const { data, error: e } = await supabase!.rpc("begin_word_chain_turn", { p_match_id: room.id });
    if (e) { startedTyping.current = false; setError(e.message); }
    else accept(data);
  }
  async function submitWord(automatic = false) {
    if (!room || busyRef.current || room.game_state.current_turn_user_id !== currentUserId) return;
    const clean = word.trim().toLowerCase();
    if (!clean) { await passTurn("empty"); return; }
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const { data: validation, error: validationError } = await supabase!.functions.invoke("word-chain-dictionary", { body: { word: clean } });
      if (validationError || !validation?.valid) { const reason = validation?.error || validationError?.message || "The word could not be verified in the English dictionary."; setRejection({ word: clean, reason }); await passTurn("invalid"); return; }
      const { data, error: submitError } = await supabase!.rpc("submit_word_chain_word", { p_match_id: room.id, p_word: clean });
      if (submitError) {
        setRejection({ word: clean, reason: submitError.message });
        await passTurn("invalid");
      } else {
        accept(data); setWord(""); startedTyping.current = false;
        if (!automatic) setNotice("Dictionary-verified word accepted.");
      }
    } catch (e: any) { handleError(e); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function passTurn(reason: string) {
    if (!room) return;
    const { data, error: e } = await supabase!.rpc("pass_word_chain_turn", { p_match_id: room.id, p_reason: reason });
    if (e) handleError(e); else { accept(data); setWord(""); startedTyping.current = false; }
  }
  async function passExpiredTurn() {
    if (!room || busyRef.current) return;
    await action(() => supabase!.rpc("expire_word_chain_turn", { p_match_id: room.id }), "Time expired. The turn has passed.");
  }
  async function sendReaction(reaction: string) {
    if (!room) return;
    const { data, error: e } = await supabase!.rpc("send_word_chain_reaction", { p_match_id: room.id, p_reaction: reaction });
    if (e) handleError(e); else accept(data);
  }
  async function inviteRematch() {
    if (!room || rematchBusy) return;
    setRematchBusy(true);
    try {
      const { data, error: e } = await supabase!.rpc("create_word_chain_room", { p_title: "Rematch • " + room.title, p_turn_seconds: 30, p_match_seconds: room.match_duration_seconds });
      if (e) throw e;
      accept(data); setWord(""); setRejection(null); setNotice("Rematch room created. Share the new room code with your opponent.");
    } catch (e: any) { handleError(e); } finally { setRematchBusy(false); }
  }
  async function finishMatch() {
    if (!room || busyRef.current) return;
    await action(() => supabase!.rpc("finish_word_chain_match", { p_match_id: room.id }));
  }
  async function closeRoom() {
    if (!room || room.created_by !== currentUserId || room.status !== "open") return;
    await action(() => supabase!.rpc("close_word_chain_room", { p_match_id: room.id }), "Room closed. Its history has been retained.");
  }

  const currentPlayer = room?.players.find(p => p.user_id === room.game_state.current_turn_user_id);
  const previous = room?.game_state?.words?.[room.game_state.words.length - 1]?.word;
  const myTurn = !!room && room.game_state.current_turn_user_id === currentUserId;
  const counts = room?.players.map(p => ({ ...p, count: room.game_state.words.filter(w => w.user_id === p.user_id).length,
    longest: Math.max(0, ...room.game_state.words.filter(w => w.user_id === p.user_id).map(w => w.word.length)),
    fastest: room.game_state.words.some(w => w.user_id === p.user_id) ? Math.min(...room.game_state.words.filter(w => w.user_id === p.user_id).map(w => w.response_ms || 0)) : 0,
    missed: room.game_state.missed_turns?.[p.user_id] || 0,
    streak: room.game_state.streaks?.[p.user_id] || 0,
    avg: room.game_state.words.filter(w => w.user_id === p.user_id).length
      ? Math.round(room.game_state.words.filter(w => w.user_id === p.user_id).reduce((n, w) => n + (w.response_ms || 0), 0) /
        room.game_state.words.filter(w => w.user_id === p.user_id).length) : 0 })) || [];

  return <ScrollView contentContainerStyle={s.page}><View style={s.shell}>
    <Link href="/dashboard" style={s.back}>‹  Back to dashboard</Link>
    <Text style={s.eyebrow}>KIMEZA PLAY • GAMES</Text><Text style={s.title}>Word Chain</Text>
    <Text style={s.subtitle}>Build a chain of dictionary-verified words. Each word must begin with the last letter of the previous word.</Text>
    {!!error && <Text style={s.error}>{error}</Text>}{!!notice && <Text style={s.notice}>{notice}</Text>}
    {room?.status === "in_progress" && rejection && <View style={s.rejection}><Text style={s.rejectionTitle}>WORD NOT ACCEPTED</Text><Text style={s.rejectionWord}>“{rejection.word}”</Text><Text style={s.rejectionReason}>Reason: {rejection.reason}</Text><Text style={s.rejectionHint}>No point was awarded. The turn has moved to the next player.</Text></View>}
    {!room ? <>
      <View style={s.card}><Text style={s.heading}>Create a room</Text><Text style={s.muted}>Choose the match duration. The setting locks when the game starts.</Text>
        <TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Room name" />
        <Text style={s.label}>MATCH DURATION</Text><View style={s.durationRow}>{DURATIONS.map(d =>
          <Pressable key={d.value} onPress={() => setDuration(d.value)} style={[s.duration, duration === d.value && s.durationActive]}>
            <Text style={[s.durationText, duration === d.value && s.durationTextActive]}>{d.label}</Text>
          </Pressable>)}</View>
        <Pressable disabled={busy} onPress={create} style={s.primary}><Text style={s.primaryText}>{busy ? "Please wait…" : "Create Word Chain room"}</Text></Pressable>
      </View>
      <View style={s.card}><Text style={s.heading}>Join a room</Text><Text style={s.muted}>Enter the six-character code shared by your friend.</Text>
        <TextInput value={code} onChangeText={setCode} style={s.input} placeholder="ROOM CODE" autoCapitalize="characters" maxLength={6} />
        <Pressable disabled={busy || code.trim().length !== 6} onPress={join} style={s.secondary}><Text style={s.secondaryText}>Join room</Text></Pressable>
      </View>
    </> : <>
      <View style={s.roomHead}><View><Text style={s.muted}>ROOM CODE</Text><Text style={s.roomCode}>{room.room_code}</Text></View>
        <Pressable onPress={() => { setRoom(null); setWord(""); router.replace("/games"); }} style={s.leave}><Text style={s.secondaryText}>Close view</Text></Pressable>
      </View>
      <View style={s.card}><Text style={s.heading}>{room.title}</Text>
        <Text style={s.muted}>{room.players.length} of 2 players joined • {room.status.replace("_", " ")}</Text>
        {room.players.map((p, i) => <View key={p.user_id} style={s.player}><Text style={s.playerName}>{p.display_name || "Kimeza member"}</Text><Text style={s.muted}>Player {i + 1}</Text></View>)}
        {room.status === "open" && <><Text style={s.durationSummary}>Match length: {Math.round(room.match_duration_seconds / 60)} minutes</Text>
          {!!room.room_expires_at && <Text style={s.muted}>This waiting room expires {new Date(room.room_expires_at).toLocaleString()} if the game is not started.</Text>}
          <Pressable disabled={busy || room.players.length !== 2} onPress={start} style={[s.primary, (busy || room.players.length !== 2) && s.disabled]}><Text style={s.primaryText}>Start game</Text></Pressable>
          {room.created_by === currentUserId && <Pressable disabled={busy} onPress={()=>void closeRoom()} style={s.cancelRoom}><Text style={s.cancelRoomText}>Close this room</Text></Pressable>}</>}
        {room.status === "in_progress" && <>
          <View style={s.clockRow}><View style={s.clock}><Text style={s.muted}>MATCH TIME LEFT</Text><Text style={s.matchTimer}>{Math.floor(matchSeconds / 60)}:{String(matchSeconds % 60).padStart(2, "0")}</Text></View>
            <View style={s.clock}><Text style={s.muted}>YOUR TURN CLOCK</Text><Text style={s.timer}>{room.game_state.turn_deadline ? `${seconds}s` : (myTurn ? "READY" : "—")}</Text></View></View>
          <View style={s.turn}><Text style={s.muted}>CURRENT TURN</Text><Text style={s.turnName}>{currentPlayer?.display_name || "Player"}</Text>
            <Text style={s.muted}>{myTurn ? "Your turn. Think first if you need to; the 30-second clock starts when you type your first letter." : "Waiting for your opponent to finish their turn."}</Text></View>
          {!myTurn && room.game_state.live_draft_user_id === room.game_state.current_turn_user_id && !!room.game_state.live_draft && <View style={s.liveDraft}><Text style={s.liveDraftLabel}>OPPONENT IS TYPING</Text><Text style={s.liveDraftText}>{room.game_state.live_draft}</Text></View>}
          {myTurn && <>
            {previous && <Text style={s.muted}>Your word must begin with <Text style={s.letter}>{previous.slice(-1).toUpperCase()}</Text></Text>}
            {!room.game_state.turn_deadline && <Text style={s.muted}>Your 30-second clock starts with your first letter. Take a moment to think before typing.</Text>}
            <TextInput value={word} onChangeText={v => { setWord(v); setRejection(null); if (v.length > 0) { void beginTyping(); void shareDraft(v); } }} style={s.input}
              placeholder="Start typing a word…" autoCapitalize="none" editable={!busy} />
            <Pressable disabled={busy || !word.trim()} onPress={() => void submitWord(false)} style={s.primary}><Text style={s.primaryText}>Submit word now</Text></Pressable>
          </>}
        </>}
      </View>
      {room.status === "in_progress" && <View style={s.card}><Text style={s.heading}>Quick reactions</Text><View style={s.reactionRow}>{["🔥","😂","👏","😮","💪","❤️"].map(x=><Pressable key={x} onPress={()=>void sendReaction(x)} style={s.reaction}><Text style={s.reactionEmoji}>{x}</Text></Pressable>)}</View>{(room.reactions || []).slice(0,4).map((r,i)=><Text key={r.created_at+i} style={s.muted}>{room.players.find(p=>p.user_id===r.user_id)?.display_name || "Player"} {r.reaction}</Text>)}</View>}
      {room.status === "in_progress" && <View style={s.card}><Text style={s.heading}>Live scores & speed</Text>
        {counts.map(p => <View key={p.user_id} style={s.scoreRow}><Text style={s.playerName}>{p.display_name}</Text><Text style={s.scoreValue}>{p.count} words</Text><Text style={s.muted}>Avg. {p.count ? (p.avg / 1000).toFixed(1) + "s" : "—"} • Fastest {p.fastest ? (p.fastest / 1000).toFixed(1) + "s" : "—"} • Longest {p.longest} letters • Streak {p.streak} • Missed {p.missed}</Text></View>)}
      </View>}
      {room.status === "cancelled" && <View style={s.card}><Text style={s.heading}>Room closed</Text><Text style={s.muted}>This room is no longer available to join. Its match history has been retained.</Text></View>}
      {room.status === "completed" && <View style={s.card}><Text style={s.heading}>Game complete</Text>
        {room.game_state.winner_user_id ? <Text style={s.turnName}>{room.players.find(p => p.user_id === room.game_state.winner_user_id)?.display_name || "Winner"} wins!</Text> : <Text style={s.turnName}>It’s a draw!</Text>}
        <Text style={s.muted}>Final score is based on valid words. Friendly-play points are saved; no club, zone or district score was awarded.</Text>
        {counts.map(p => <View key={p.user_id} style={s.scoreRow}><Text style={s.playerName}>{p.display_name}</Text><Text style={s.scoreValue}>{p.count} valid words</Text><Text style={s.muted}>Average {p.count ? (p.avg / 1000).toFixed(1) + "s" : "—"} • Fastest {p.fastest ? (p.fastest / 1000).toFixed(1) + "s" : "—"} • Longest {p.longest} letters • Best live streak {p.streak} • Missed turns {p.missed}</Text></View>)}
      </View>}
        {room.status === "completed" && <Pressable disabled={rematchBusy} onPress={()=>void inviteRematch()} style={s.primary}><Text style={s.primaryText}>{rematchBusy ? "Creating rematch…" : "Create rematch room"}</Text></Pressable>}
      <Text style={s.section}>Word chain ({room.game_state.words?.length || 0})</Text>
      {(room.game_state.words || []).length === 0 ? <Text style={s.muted}>The first player can begin with any word.</Text> :
        (room.game_state.words || []).map((w, i) => <View key={w.turn} style={s.wordRow}><Text style={s.wordIndex}>{i + 1}</Text>
          <Text style={s.wordText}>{w.word}</Text><Text style={s.muted}>{room.players.find(p => p.user_id === w.user_id)?.display_name || "Player"} • {((w.response_ms || 0) / 1000).toFixed(1)}s</Text></View>)}
    </>}
  </View></ScrollView>;
}

const s = StyleSheet.create({
 page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},shell:{width:"100%",maxWidth:760,alignSelf:"center",paddingVertical:20},
 back:{color:"#557168",fontWeight:"700",marginBottom:24},eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},
 title:{color:"#102A24",fontSize:30,fontWeight:"900",marginTop:7},subtitle:{color:"#66756D",lineHeight:22,marginTop:8,marginBottom:18},
 card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#E2E9E3",padding:18,marginBottom:14},
 heading:{color:"#153B30",fontSize:18,fontWeight:"900"},muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},
 label:{color:"#68776F",fontSize:10,fontWeight:"900",letterSpacing:1,marginTop:5},input:{backgroundColor:"#F8FAF8",borderWidth:1,borderColor:"#DCE5DE",borderRadius:11,padding:14,color:"#18352C",marginTop:14,marginBottom:12},
 primary:{backgroundColor:"#153B30",borderRadius:11,padding:14,alignItems:"center",marginTop:6},primaryText:{color:"#fff",fontWeight:"900"},
 secondary:{backgroundColor:"#E7F0E9",borderRadius:11,padding:14,alignItems:"center"},secondaryText:{color:"#176B45",fontWeight:"900"},
 liveDraft:{backgroundColor:"#F3F6FF",borderWidth:1,borderColor:"#CBD5F5",padding:14,borderRadius:12,marginTop:12,marginBottom:12},liveDraftLabel:{color:"#4056A1",fontWeight:"900",fontSize:10,letterSpacing:1},liveDraftText:{color:"#263B7A",fontSize:20,fontWeight:"800",letterSpacing:1,marginTop:6},
 rejection:{backgroundColor:"#FFF1F0",borderWidth:1,borderColor:"#F2B8B5",padding:14,borderRadius:12,marginBottom:12},rejectionTitle:{color:"#B42318",fontWeight:"900",fontSize:11,letterSpacing:1},rejectionWord:{color:"#842029",fontWeight:"900",fontSize:18,marginTop:5},rejectionReason:{color:"#842029",fontSize:13,lineHeight:19,marginTop:5},rejectionHint:{color:"#8A4B48",fontSize:11,marginTop:6},error:{color:"#B42318",backgroundColor:"#FEF3F2",padding:12,borderRadius:10,marginBottom:12},notice:{color:"#176B45",backgroundColor:"#ECFDF3",padding:12,borderRadius:10,marginBottom:12},
 roomHead:{backgroundColor:"#102A24",borderRadius:15,padding:18,marginBottom:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
 roomCode:{color:"#E2B55F",fontSize:28,fontWeight:"900",letterSpacing:4},leave:{backgroundColor:"#fff",padding:10,borderRadius:9},
 player:{borderTopWidth:1,borderTopColor:"#E8EEE9",paddingVertical:12,marginTop:10},playerName:{color:"#153B30",fontWeight:"800"},
 disabled:{opacity:.45},durationRow:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:10,marginBottom:10},duration:{borderWidth:1,borderColor:"#DCE5DE",borderRadius:9,paddingVertical:9,paddingHorizontal:12},
 durationActive:{backgroundColor:"#153B30",borderColor:"#153B30"},durationText:{color:"#36564A",fontWeight:"800"},durationTextActive:{color:"#fff"},
 durationSummary:{color:"#176B45",fontWeight:"800",marginTop:12},clockRow:{flexDirection:"row",gap:10,marginTop:15},clock:{flex:1,backgroundColor:"#F1F6F2",padding:12,borderRadius:12},
 matchTimer:{color:"#153B30",fontSize:24,fontWeight:"900",marginTop:4},turn:{backgroundColor:"#F1F6F2",padding:14,borderRadius:12,marginTop:12,marginBottom:12},
 turnName:{color:"#153B30",fontSize:20,fontWeight:"900",marginTop:3},timer:{color:"#B17B27",fontSize:25,fontWeight:"900",marginTop:5},
 letter:{fontWeight:"900",color:"#176B45",fontSize:16},section:{fontSize:19,color:"#153B30",fontWeight:"900",marginTop:20,marginBottom:9},
 wordRow:{backgroundColor:"#fff",borderRadius:11,padding:13,marginBottom:7,flexDirection:"row",alignItems:"center",gap:10,flexWrap:"wrap"},
 wordIndex:{color:"#B17B27",fontWeight:"900"},wordText:{color:"#153B30",fontSize:16,fontWeight:"900",flex:1},
 reactionRow:{flexDirection:"row",gap:10,marginTop:12,marginBottom:8,flexWrap:"wrap"},reaction:{backgroundColor:"#F1F6F2",borderRadius:24,padding:10},reactionEmoji:{fontSize:22},
 scoreRow:{borderTopWidth:1,borderTopColor:"#E8EEE9",paddingVertical:11,marginTop:8},scoreValue:{color:"#176B45",fontWeight:"900",marginTop:4}
});
