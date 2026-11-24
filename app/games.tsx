import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Player={user_id:string;display_name:string;joined_at:string};
type Word={word:string;user_id:string;turn:number;played_at:string};
type Room={id:string;title:string;game_code:string;status:string;room_code:string;max_players:number;turn_duration_seconds:number;game_state:{words:Word[];current_turn_user_id:string;turn_number:number;turn_deadline?:string;started:boolean};players:Player[]};

export default function GamesScreen(){
 const router=useRouter(); const params=useLocalSearchParams<{room?:string}>();
 const [room,setRoom]=useState<Room|null>(null); const [code,setCode]=useState(""); const [title,setTitle]=useState("Word Chain"); const [word,setWord]=useState("");
 const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [seconds,setSeconds]=useState(0); const [currentUserId,setCurrentUserId]=useState("");
 
 const handleError=(e:any)=>setError(e?.message||"Something went wrong. Please try again.");
 const accept=(data:any)=>{if(data){setRoom(data as Room);setCode(data.room_code||"");setError("");}};
 const loadRoom=useCallback(async(id:string)=>{if(!supabase)return;const {data,error:e}=await supabase.rpc("get_word_chain_room",{p_match_id:id});if(e)handleError(e);else accept(data);},[]);
 useEffect(()=>{let alive=true;void supabase?.auth.getUser().then(({data})=>{if(alive)setCurrentUserId(data.user?.id||"");});return()=>{alive=false;};},[]);\n useEffect(()=>{if(params.room)void loadRoom(params.room);},[params.room,loadRoom]);
 useEffect(()=>{if(!room?.id)return;const poll=setInterval(()=>void loadRoom(room.id),2500);return()=>clearInterval(poll);},[room?.id,loadRoom]);
 useEffect(()=>{if(!room?.game_state?.turn_deadline){setSeconds(0);return;}const tick=()=>setSeconds(Math.max(0,Math.ceil((new Date(room.game_state.turn_deadline!).getTime()-Date.now())/1000)));tick();const timer=setInterval(tick,500);return()=>clearInterval(timer);},[room?.game_state?.turn_deadline]);
 async function action(fn:()=>Promise<any>,success?:string){if(busy)return;setBusy(true);setError("");setNotice("");try{const {data,error:e}=await fn();if(e)throw e;if(data)accept(data);if(success)setNotice(success);}catch(e){handleError(e);}finally{setBusy(false);}}
 async function create(){await action(()=>supabase!.rpc("create_word_chain_room",{p_title:title,p_turn_seconds:30}),"Room created. Share the room code with one other member.");}
 async function join(){await action(()=>supabase!.rpc("join_word_chain_room",{p_room_code:code}),"You joined the room.");}
 async function start(){if(!room)return;await action(()=>supabase!.rpc("start_word_chain_room",{p_match_id:room.id}),"Game started. Good luck!");}
 async function submit(){if(!room)return;const clean=word.trim();if(!clean)return;await action(()=>supabase!.rpc("submit_word_chain_word",{p_match_id:room.id,p_word:clean}),"Word accepted.");setWord("");}
 const myId=room?.players.find(p=>p.user_id===room.game_state?.current_turn_user_id)?.user_id;
 const {data:authData}= {data:null as any};
 const currentPlayer=room?.players.find(p=>p.user_id===room.game_state?.current_turn_user_id);
 const previous=room?.game_state?.words?.[room.game_state.words.length-1]?.word;
 return <ScrollView contentContainerStyle={s.page}><View style={s.shell}>
 <Link href="/dashboard" style={s.back}>‹  Back to dashboard</Link><Text style={s.eyebrow}>KIMEZA PLAY • GAMES</Text><Text style={s.title}>Word Chain</Text><Text style={s.subtitle}>Take turns building a chain of words. Each new word must begin with the last letter of the previous word.</Text>
 {!!error&&<Text style={s.error}>{error}</Text>}{!!notice&&<Text style={s.notice}>{notice}</Text>}
 {!room?<><View style={s.card}><Text style={s.heading}>Create a room</Text><Text style={s.muted}>Start a friendly two-player game and invite another active club member.</Text><TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Room name"/><Pressable disabled={busy} onPress={create} style={s.primary}><Text style={s.primaryText}>{busy?"Please wait…":"Create Word Chain room"}</Text></Pressable></View>
 <View style={s.card}><Text style={s.heading}>Join a room</Text><Text style={s.muted}>Enter the six-character code shared by your friend.</Text><TextInput value={code} onChangeText={setCode} style={s.input} placeholder="ROOM CODE" autoCapitalize="characters" maxLength={6}/><Pressable disabled={busy||code.trim().length!==6} onPress={join} style={s.secondary}><Text style={s.secondaryText}>Join room</Text></Pressable></View></>:<>
 <View style={s.roomHead}><View><Text style={s.muted}>ROOM CODE</Text><Text style={s.roomCode}>{room.room_code}</Text></View><Pressable onPress={()=>{setRoom(null);router.replace("/games");}} style={s.leave}><Text style={s.secondaryText}>Close view</Text></Pressable></View>
 <View style={s.card}><Text style={s.heading}>{room.title}</Text><Text style={s.muted}>{room.players.length} of 2 players joined • {room.status.replace("_"," ")}</Text>{room.players.map((p,i)=><View key={p.user_id} style={s.player}><Text style={s.playerName}>{p.display_name||"Kimeza member"}</Text><Text style={s.muted}>{i===0?"Player 1":"Player 2"}</Text></View>)}
 {room.status==="open"&&<Pressable disabled={busy||room.players.length!==2} onPress={start} style={[s.primary,room.players.length!==2&&s.disabled]}><Text style={s.primaryText}>Start game</Text></Pressable>}
 {room.status==="in_progress"&&<><View style={s.turn}><Text style={s.muted}>CURRENT TURN</Text><Text style={s.turnName}>{currentPlayer?.display_name||"Player"}</Text><Text style={s.timer}>{seconds}s</Text><Text style={s.muted}>{room.game_state.current_turn_user_id===currentUserId?"It is your turn.":"Waiting for your opponent."}</Text></View>{previous&&<Text style={s.muted}>Your word must begin with <Text style={s.letter}>{previous.slice(-1).toUpperCase()}</Text></Text>}
 <TextInput value={word} onChangeText={setWord} style={s.input} placeholder="Enter one word" autoCapitalize="none" editable={room.game_state.current_turn_user_id===currentUserId}/>
 <Pressable disabled={busy||!word.trim()||room.game_state.current_turn_user_id!==currentUserId} onPress={submit} style={s.primary}><Text style={s.primaryText}>Submit word</Text></Pressable></>}
 </View>
 <Text style={s.section}>Word chain ({room.game_state.words?.length||0})</Text>
 {(room.game_state.words||[]).length===0?<Text style={s.muted}>The first player can begin with any word.</Text>:(room.game_state.words||[]).map((w,i)=><View key={w.turn} style={s.wordRow}><Text style={s.wordIndex}>{i+1}</Text><Text style={s.wordText}>{w.word}</Text><Text style={s.muted}>{room.players.find(p=>p.user_id===w.user_id)?.display_name||"Player"}</Text></View>)}
 </>}
 </View></ScrollView>;
}
const s=StyleSheet.create({page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},shell:{width:"100%",maxWidth:760,alignSelf:"center",paddingVertical:20},back:{color:"#557168",fontWeight:"700",marginBottom:24},eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},title:{color:"#102A24",fontSize:30,fontWeight:"900",marginTop:7},subtitle:{color:"#66756D",lineHeight:22,marginTop:8,marginBottom:18},card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#E2E9E3",padding:18,marginBottom:14},heading:{color:"#153B30",fontSize:18,fontWeight:"900"},muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},input:{backgroundColor:"#F8FAF8",borderWidth:1,borderColor:"#DCE5DE",borderRadius:11,padding:14,color:"#18352C",marginTop:14,marginBottom:12},primary:{backgroundColor:"#153B30",borderRadius:11,padding:14,alignItems:"center",marginTop:6},primaryText:{color:"#fff",fontWeight:"900"},secondary:{backgroundColor:"#E7F0E9",borderRadius:11,padding:14,alignItems:"center"},secondaryText:{color:"#176B45",fontWeight:"900"},error:{color:"#B42318",backgroundColor:"#FEF3F2",padding:12,borderRadius:10,marginBottom:12},notice:{color:"#176B45",backgroundColor:"#ECFDF3",padding:12,borderRadius:10,marginBottom:12},roomHead:{backgroundColor:"#102A24",borderRadius:15,padding:18,marginBottom:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},roomCode:{color:"#E2B55F",fontSize:28,fontWeight:"900",letterSpacing:4},leave:{backgroundColor:"#fff",padding:10,borderRadius:9},player:{borderTopWidth:1,borderTopColor:"#E8EEE9",paddingVertical:12,marginTop:10},playerName:{color:"#153B30",fontWeight:"800"},disabled:{opacity:.45},turn:{backgroundColor:"#F1F6F2",padding:14,borderRadius:12,marginTop:16,marginBottom:12},turnName:{color:"#153B30",fontSize:20,fontWeight:"900",marginTop:3},timer:{color:"#B17B27",fontSize:25,fontWeight:"900",marginTop:5},letter:{fontWeight:"900",color:"#176B45",fontSize:16},section:{fontSize:19,color:"#153B30",fontWeight:"900",marginTop:20,marginBottom:9},wordRow:{backgroundColor:"#fff",borderRadius:11,padding:13,marginBottom:7,flexDirection:"row",alignItems:"center",gap:10},wordIndex:{color:"#B17B27",fontWeight:"900"},wordText:{color:"#153B30",fontSize:16,fontWeight:"900",flex:1}});
