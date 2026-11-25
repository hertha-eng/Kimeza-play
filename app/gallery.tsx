import { useCallback, useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Match = { id:string; title:string; status:string; game_state:any; players:{user_id:string;display_name:string}[] };
export default function GalleryScreen(){
 const {match}=useLocalSearchParams<{match:string}>();
 const [data,setData]=useState<Match|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{if(!supabase||!match)return;const {data:d,error:e}=await supabase.rpc("watch_fellowship_word_chain_match",{p_match_id:match});if(e)setError(e.message);else{setData(d as Match);setError("");}setLoading(false);},[match]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),2000);return()=>clearInterval(timer);},[load]);
 const words=data?.game_state?.words||[];
 const current=data?.players?.find(p=>p.user_id===data.game_state?.current_turn_user_id);
 return <ScrollView contentContainerStyle={s.page}><View style={s.shell}>
  <Link href="/fellowship" style={s.back}>‹  Back to fellowship</Link>
  <Text style={s.eyebrow}>KIMEZA PLAY • THE GALLERY</Text><Text style={s.title}>Watch the match</Text>
  <Text style={s.subtitle}>You’re part of the audience. Follow every word, cheer in the room and enjoy the game. Only the two players can make moves.</Text>
  {loading?<ActivityIndicator size="large" color="#176B45"/>:error?<View style={s.card}><Text style={s.error}>{error}</Text></View>:data?<>
   <View style={s.hero}><Text style={s.live}>●  {data.status==="in_progress"?"LIVE MATCH":data.status.toUpperCase()}</Text><Text style={s.heroTitle}>{data.title}</Text><Text style={s.heroSub}>Word Chain · {words.length} words played</Text></View>
   <View style={s.card}><Text style={s.heading}>Players</Text>{data.players.map((p,i)=><View key={p.user_id} style={s.player}><Text style={s.name}>{p.display_name||"Kimeza member"}</Text><Text style={s.score}>{words.filter((w:any)=>w.user_id===p.user_id).length} words</Text></View>)}
    {data.status==="in_progress"&&<Text style={s.turn}>Now playing: {current?.display_name||"Next player"}</Text>}
   </View>
   <View style={s.card}><Text style={s.heading}>The live word chain</Text>{words.length?words.slice().reverse().map((w:any,i:number)=><View key={w.turn} style={s.word}><Text style={s.number}>{words.length-i}</Text><Text style={s.wordText}>{w.word}</Text><Text style={s.by}>{data.players.find(p=>p.user_id===w.user_id)?.display_name||"Player"}</Text></View>):<Text style={s.muted}>The first word is yet to be played.</Text>}</View>
   <View style={s.note}><Text style={s.noteTitle}>THE GALLERY IS LIVE</Text><Text style={s.muted}>Cheer, react and chat in the fellowship room. Gallery access is read-only; match controls remain with the players.</Text></View>
  </>:null}
 </View></ScrollView>;
}
const s=StyleSheet.create({page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},shell:{width:"100%",maxWidth:760,alignSelf:"center",paddingVertical:20},back:{color:"#557168",fontWeight:"800",marginBottom:24},eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},title:{color:"#102A24",fontSize:30,fontWeight:"900",marginTop:7},subtitle:{color:"#66756D",lineHeight:22,marginTop:8,marginBottom:18},hero:{backgroundColor:"#102A24",borderRadius:18,padding:20,marginBottom:14},live:{color:"#A8D7B9",fontWeight:"900",fontSize:10,letterSpacing:1.4},heroTitle:{color:"#fff",fontSize:23,fontWeight:"900",marginTop:12},heroSub:{color:"#C2D3C8",marginTop:6,fontSize:12},card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#E2E9E3",padding:18,marginBottom:14},heading:{color:"#153B30",fontSize:18,fontWeight:"900",marginBottom:8},player:{flexDirection:"row",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EFF2EF"},name:{color:"#18352C",fontWeight:"800"},score:{color:"#176B45",fontWeight:"900"},turn:{color:"#B17B27",fontWeight:"800",marginTop:12},word:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EFF2EF",gap:12},number:{color:"#B17B27",fontWeight:"900"},wordText:{color:"#153B30",fontSize:17,fontWeight:"900",flex:1},by:{color:"#68776F",fontSize:11},muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},note:{backgroundColor:"#E9F1EA",borderRadius:14,padding:16},noteTitle:{color:"#176B45",fontWeight:"900",letterSpacing:1,fontSize:11},error:{color:"#B42318",fontSize:12}});
