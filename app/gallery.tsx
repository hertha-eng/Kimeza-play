import { useCallback, useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Player = { user_id: string; display_name: string };
type Reaction = { user_id: string; reaction: string; created_at: string };
type Match = {
  id: string;
  title: string;
  status: string;
  game_state: any;
  room_session_id?: string | null;
  players: Player[];
  reactions?: Reaction[];
};

export default function GalleryScreen() {
  const { match } = useLocalSearchParams<{ match: string }>();
  const [data, setData] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reactionBusy, setReactionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !match) return;
    const universal = await supabase.rpc("watch_game_room_match", { p_match_id: match });
    if (!universal.error) {
      setData(universal.data as Match);
      setError("");
      setLoading(false);
      return;
    }

    // Preserve the existing Fellowship Gallery as a separate access path.
    const fellowship = await supabase.rpc("watch_fellowship_word_chain_match", { p_match_id: match });
    if (fellowship.error) setError(fellowship.error.message);
    else { setData(fellowship.data as Match); setError(""); }
    setLoading(false);
  }, [match]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [load]);

  async function sendReaction(reaction: string) {
    if (!supabase || !match || reactionBusy || !data?.room_session_id) return;
    setReactionBusy(true);
    const { data: next, error: e } = await supabase.rpc("send_word_chain_reaction", {
      p_match_id: match,
      p_reaction: reaction,
    });
    if (e) setError(e.message);
    else setData(next as Match);
    setReactionBusy(false);
  }

  const words = data?.game_state?.words || [];
  const current = data?.players?.find(p => p.user_id === data.game_state?.current_turn_user_id);
  const isUniversalRoom = !!data?.room_session_id;
  const backHref = isUniversalRoom
    ? { pathname: "/games/rooms", params: { room: data!.room_session_id! } }
    : "/fellowship";

  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.shell}>
      <Link href={backHref as any} style={s.back}>‹  Back to {isUniversalRoom ? "game room" : "fellowship"}</Link>
      <Text style={s.eyebrow}>KIMEZA PLAY • THE GALLERY</Text>
      <Text style={s.title}>Watch the match</Text>
      <Text style={s.subtitle}>Follow the game, support the players and enjoy the room. Gallery members can watch without taking a player's turn.</Text>

      {loading ? <ActivityIndicator size="large" color="#176B45" /> : error ? <View style={s.card}><Text style={s.error}>{error}</Text></View> : data ? <>
        <View style={s.hero}>
          <Text style={s.live}>●  {data.status === "in_progress" ? "LIVE MATCH" : data.status.toUpperCase()}</Text>
          <Text style={s.heroTitle}>{data.title}</Text>
          <Text style={s.heroSub}>Word Chain · {words.length} words played</Text>
        </View>

        <View style={s.card}>
          <Text style={s.heading}>Players</Text>
          {data.players.map(p => <View key={p.user_id} style={s.player}>
            <Text style={s.name}>{p.display_name || "Kimeza member"}</Text>
            <Text style={s.score}>{words.filter((w: any) => w.user_id === p.user_id).length} words</Text>
          </View>)}
          {data.status === "in_progress" && <Text style={s.turn}>Now playing: {current?.display_name || "Next player"}</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.heading}>The live word chain</Text>
          {words.length ? words.slice().reverse().map((w: any, i: number) => <View key={w.turn} style={s.word}>
            <Text style={s.number}>{words.length - i}</Text>
            <Text style={s.wordText}>{w.word}</Text>
            <Text style={s.by}>{data.players.find(p => p.user_id === w.user_id)?.display_name || "Player"}</Text>
          </View>) : <Text style={s.muted}>The first word is yet to be played.</Text>}
        </View>

        {isUniversalRoom && data.status !== "completed" && data.status !== "cancelled" && <View style={s.card}>
          <Text style={s.heading}>Cheer the players</Text>
          <Text style={s.muted}>Room members can react without joining the match as players.</Text>
          <View style={s.reactions}>{["🔥", "😂", "👏", "😮", "💪", "❤️"].map(x =>
            <Pressable key={x} disabled={reactionBusy} onPress={() => void sendReaction(x)} style={s.reaction}>
              <Text style={s.reactionEmoji}>{x}</Text>
            </Pressable>)}</View>
          {(data.reactions || []).slice(0, 8).map((r, i) => <Text key={r.created_at + i} style={s.muted}>{data.players.find(p => p.user_id === r.user_id)?.display_name || "Room member"} {r.reaction}</Text>)}
        </View>}

        <View style={s.note}>
          <Text style={s.noteTitle}>{isUniversalRoom ? "SHARED ROOM GALLERY" : "FELLOWSHIP GALLERY"}</Text>
          <Text style={s.muted}>{isUniversalRoom
            ? "You are watching as a room member. Players alone can make game moves; when a match ends, its players return to the watcher role."
            : "Cheer, react and chat in the fellowship room. Gallery access is read-only; match controls remain with the players."}</Text>
        </View>
      </> : null}
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},
  shell:{width:"100%",maxWidth:760,alignSelf:"center",paddingVertical:20},
  back:{color:"#557168",fontWeight:"800",marginBottom:24},
  eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},
  title:{color:"#102A24",fontSize:30,fontWeight:"900",marginTop:7},
  subtitle:{color:"#66756D",lineHeight:22,marginTop:8,marginBottom:18},
  hero:{backgroundColor:"#102A24",borderRadius:18,padding:20,marginBottom:14},
  live:{color:"#A8D7B9",fontWeight:"900",fontSize:10,letterSpacing:1.4},
  heroTitle:{color:"#fff",fontSize:23,fontWeight:"900",marginTop:12},
  heroSub:{color:"#C2D3C8",marginTop:6,fontSize:12},
  card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#E2E9E3",padding:18,marginBottom:14},
  heading:{color:"#153B30",fontSize:18,fontWeight:"900",marginBottom:8},
  player:{flexDirection:"row",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EFF2EF"},
  name:{color:"#18352C",fontWeight:"800"},
  score:{color:"#176B45",fontWeight:"900"},
  turn:{color:"#B17B27",fontWeight:"800",marginTop:12},
  word:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EFF2EF",gap:12},
  number:{color:"#B17B27",fontWeight:"900"},
  wordText:{color:"#153B30",fontSize:17,fontWeight:"900",flex:1},
  by:{color:"#68776F",fontSize:11},
  muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},
  reactions:{flexDirection:"row",gap:10,flexWrap:"wrap",marginTop:12,marginBottom:8},
  reaction:{backgroundColor:"#F1F6F2",borderRadius:24,padding:10},
  reactionEmoji:{fontSize:22},
  note:{backgroundColor:"#E9F1EA",borderRadius:14,padding:16},
  noteTitle:{color:"#176B45",fontWeight:"900",letterSpacing:1,fontSize:11},
  error:{color:"#B42318",fontSize:12},
});
