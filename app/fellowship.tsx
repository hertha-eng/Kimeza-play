import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Room = { id:string; club_id:string; title:string; status:string; break_duration_seconds:number; opened_at:string; club_name?:string|null; member_count?:number; clubs?:{name:string}|null };
type Member = { user_id:string; member_kind:string; home_club_id:string|null; profiles?:{display_name:string}|null };
type Message = { id:string; user_id:string; message:string; message_kind:string; created_at:string; profiles?:{display_name:string}|null };
type Challenge = { id:string; challenger_id:string; challenged_id:string|null; offered_to_id:string|null; game_code:string; queue_position:number; status:string; expires_at:string|null; created_at:string; match_id:string|null };
const GAMES=[{label:"Word Chain",value:"word_chain"}];
const REACTIONS=["👏","🔥","😂","❤️","💪","🎉"];

export default function FellowshipScreen(){\n const router=useRouter();
 const [userId,setUserId]=useState("");const [clubId,setClubId]=useState("");const [clubName,setClubName]=useState("");
 const [rooms,setRooms]=useState<Room[]>([]);const [room,setRoom]=useState<Room|null>(null);
 const [members,setMembers]=useState<Member[]>([]);const [messages,setMessages]=useState<Message[]>([]);const [queue,setQueue]=useState<Challenge[]>([]);
 const [title,setTitle]=useState("Club Fellowship");const [breakMinutes,setBreakMinutes]=useState("5");const [message,setMessage]=useState("");
 const [game,setGame]=useState("word_chain");const [target,setTarget]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);const [refreshing,setRefreshing]=useState(false);const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");

 const loadRooms=useCallback(async()=>{
  if(!supabase){setError("Kimeza account services are unavailable.");setLoading(false);return;}
  const {data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user){setError("Please sign in again to access fellowship rooms.");setLoading(false);return;}
  const uid=auth.user.id;setUserId(uid);
  const [membershipResult,roomResult]=await Promise.all([
   supabase.from("club_memberships").select("club_id").eq("user_id",uid).eq("status","active").limit(1).maybeSingle(),
   supabase.rpc("list_open_fellowship_rooms")
  ]);
  if(membershipResult.error)setError(membershipResult.error.message);
  if(membershipResult.data?.club_id){setClubId(membershipResult.data.club_id);const {data:c}=await supabase.from("clubs").select("name").eq("id",membershipResult.data.club_id).maybeSingle();setClubName(c?.name||"My club");}
  else{setClubId("");setClubName("");}
  if(roomResult.error)setError(roomResult.error.message);else setRooms((roomResult.data||[]) as unknown as Room[]);
  setLoading(false);
 },[]);

 const loadRoom=useCallback(async(id:string)=>{
  if(!supabase)return;
  await supabase.rpc("advance_fellowship_challenge_queue",{p_room_id:id});\n  const [mr,ms,ch]=await Promise.all([
   supabase.from("fellowship_room_members").select("user_id,member_kind,home_club_id,profiles(display_name)").eq("room_id",id).is("left_at",null).order("joined_at"),
   supabase.from("fellowship_room_messages").select("id,user_id,message,message_kind,created_at,profiles(display_name)").eq("room_id",id).order("created_at",{ascending:false}).limit(60),
   supabase.from("fellowship_challenges").select("id,challenger_id,challenged_id,offered_to_id,game_code,queue_position,status,expires_at,created_at,match_id").eq("room_id",id).in("status",["queued","offered","accepted","completed"]).order("queue_position")
  ]);
  const issue=mr.error||ms.error||ch.error;if(issue){setError(issue.message);return;}
  setMembers((mr.data||[]) as unknown as Member[]);setMessages((ms.data||[]) as unknown as Message[]);setQueue((ch.data||[]) as Challenge[]);
 },[]);
 const activeMembers=useMemo(()=>members.filter(m=>m.user_id!==userId),[members,userId]);
 const selectedTarget=activeMembers.find(m=>m.user_id===target);

 useEffect(()=>{void loadRooms();},[loadRooms]);
 useEffect(()=>{if(!room)return;void loadRoom(room.id);const timer=setInterval(()=>void loadRoom(room.id),5000);return()=>clearInterval(timer);},[room?.id,loadRoom]);

 async function perform(action:()=>PromiseLike<{data:any;error:any}>,success:string){
  if(busy)return null;setBusy(true);setError("");setNotice("");
  try{const result=await action();if(result.error)throw result.error;setNotice(success);return {ok:true,data:result.data};}
  catch(e:any){setError(e?.message||"That action could not be completed. Please try again.");return {ok:false,data:null};}
  finally{setBusy(false);}
 }
 async function createRoom(){
  if(!supabase||!clubId)return;
  const mins=Number(breakMinutes);if(!Number.isFinite(mins)||mins<1||mins>30){setError("Choose a break duration from 1 to 30 minutes.");return;}
  const id=await perform(()=>supabase!.rpc("create_fellowship_room",{p_club_id:clubId,p_title:title.trim()||"Club Fellowship",p_break_seconds:mins*60}),"Your fellowship room is ready.");
  if(!id?.ok||!id.data)return;
  await loadRooms();
  const {data}=await supabase.from("fellowship_rooms").select("id,club_id,title,status,break_duration_seconds,opened_at,clubs(name)").eq("id",id.data).maybeSingle();
  if(data){setRoom(data as unknown as Room);await loadRoom(id.data);}
 }
 async function joinRoom(r:Room){
  if(!supabase)return;const result=await perform(()=>supabase!.rpc("join_fellowship_room",{p_room_id:r.id}),"You are now in the room.");
  if(!result?.ok)return;setRoom(r);await loadRoom(r.id);
 }
 async function leaveRoom(){
  if(!supabase||!room)return;const result=await perform(()=>supabase!.rpc("leave_fellowship_room",{p_room_id:room.id}),"You have left the room.");
  if(!result?.ok)return;setRoom(null);setMembers([]);setMessages([]);setQueue([]);await loadRooms();
 }
 async function post(kind:"comment"|"reaction"="comment",value=message){
  if(!supabase||!room||!value.trim())return;
  const result=await perform(()=>supabase!.rpc("post_fellowship_message",{p_room_id:room.id,p_message:value.trim(),p_kind:kind}),"");
  if(result?.ok){if(kind==="comment")setMessage("");await loadRoom(room.id);}
 }
 async function addChallenge(){
  if(!supabase||!room)return;
  const result=await perform(()=>supabase!.rpc("queue_fellowship_challenge",{p_room_id:room.id,p_game_code:game,p_challenged_id:target}),"Your request has been added to the queue.");
  if(result?.ok){setTarget(null);await loadRoom(room.id);}
 }
 async function respond(id:string,accept:boolean){
  if(!supabase||!room)return;const result=await perform(()=>supabase!.rpc("respond_fellowship_challenge",{p_challenge_id:id,p_accept:accept}),accept?"You accepted the match request.":"You passed on the match request.");
  if(result?.ok)await loadRoom(room.id);
 }
 async function refresh(){
  setRefreshing(true);await loadRooms();if(room)await loadRoom(room.id);setRefreshing(false);
 }

 return <ScrollView contentContainerStyle={s.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()} tintColor="#176B45"/>}>
 <View style={s.shell}>
  <Link href="/dashboard" style={s.back}>‹  Dashboard</Link>
  <Text style={s.eyebrow}>KIMEZA PLAY  /  COMMUNITY</Text><Text style={s.title}>Fellowship rooms</Text>
  <Text style={s.subtitle}>Meet members from other clubs, share a moment and organise your next friendly game.</Text>
  {!!error&&<View style={s.alert}><Text style={s.alertText}>{error}</Text></View>}
  {!!notice&&<View style={s.success}><Text style={s.successText}>{notice}</Text></View>}
  {loading?<View style={s.loading}><ActivityIndicator size="large" color="#176B45"/><Text style={s.muted}>Finding fellowship rooms…</Text></View>:room?<>
   <View style={s.hero}>
    <View style={s.heroTop}><View style={s.liveDot}/><Text style={s.liveLabel}>ROOM OPEN</Text><View style={{flex:1}}/><Pressable onPress={()=>void leaveRoom()} disabled={busy} style={s.leave}><Text style={s.leaveText}>Leave room</Text></Pressable></View>
    <Text style={s.heroTitle}>{room.title}</Text><Text style={s.heroSub}>{room.club_name||room.clubs?.name||clubName||"Club fellowship"}  ·  {room.status.replace("_"," ")}</Text>
    <View style={s.heroStats}><View><Text style={s.statValue}>{members.length}</Text><Text style={s.statLabel}>In the room</Text></View><View><Text style={s.statValue}>{queue.length}</Text><Text style={s.statLabel}>Match requests</Text></View><View><Text style={s.statValue}>{Math.round(room.break_duration_seconds/60)}m</Text><Text style={s.statLabel}>Break setting</Text></View></View>
   </View>
   <View style={s.card}><Text style={s.sectionTitle}>People here</Text><Text style={s.muted}>Visitors keep their home-club identity. Being here does not automatically award host-club points.</Text>
    {members.length===0?<Text style={s.empty}>You are the first one here. Invite others to join.</Text>:members.map(m=><View key={m.user_id} style={s.memberRow}><View style={s.avatar}><Text style={s.avatarText}>{(m.profiles?.display_name||"K").slice(0,1).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={s.memberName}>{m.profiles?.display_name||"Kimeza member"}{m.user_id===userId?"  (You)":""}</Text><Text style={s.memberType}>{m.member_kind.replace("_"," ")}</Text></View>{m.user_id===userId&&<Text style={s.youTag}>YOU</Text>}</View>)}
   </View>
   <View style={s.card}><Text style={s.sectionTitle}>Social lounge</Text><Text style={s.muted}>Send a message or leave a quick reaction.</Text>
    <View style={s.composer}><TextInput value={message} onChangeText={setMessage} style={s.messageInput} placeholder="Say hello to the room…" placeholderTextColor="#87958D" maxLength={500} multiline/><Pressable onPress={()=>void post()} disabled={busy||!message.trim()} style={[s.send,!message.trim()&&s.disabled]}><Text style={s.sendText}>Send</Text></Pressable></View>
    <View style={s.reactions}>{REACTIONS.map(x=><Pressable key={x} onPress={()=>void post("reaction",x)} disabled={busy} style={s.reaction}><Text style={s.reactionText}>{x}</Text></Pressable>)}</View>
    {messages.length===0?<Text style={s.empty}>No messages yet. Start the conversation.</Text>:messages.map(m=><View key={m.id} style={s.chatRow}><View style={s.chatAvatar}><Text style={s.chatAvatarText}>{(m.profiles?.display_name||"M").slice(0,1).toUpperCase()}</Text></View><View style={s.chatBubble}><Text style={s.chatName}>{m.profiles?.display_name||"Member"} <Text style={s.chatTime}>{new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</Text></Text><Text style={s.chatText}>{m.message}</Text></View></View>)}
   </View>
   <View style={s.card}><Text style={s.sectionTitle}>Next up: friendly match</Text><Text style={s.muted}>Word Chain is currently connected to the live match engine. Other games will become selectable here as their engines are completed. Organisational scoring must be authorised separately.</Text>
    <Text style={s.fieldLabel}>Choose a game</Text><View style={s.gameGrid}>{GAMES.map(g=><Pressable key={g.value} onPress={()=>setGame(g.value)} style={[s.gameOption,game===g.value&&s.gameSelected]}><Text style={[s.gameText,game===g.value&&s.gameTextSelected]}>{g.label}</Text></Pressable>)}</View>
    <Text style={s.fieldLabel}>Challenge a specific player (optional)</Text><View style={s.targetList}><Pressable onPress={()=>setTarget(null)} style={[s.targetOption,!target&&s.targetSelected]}><Text style={[s.targetText,!target&&s.targetTextSelected]}>Open queue</Text></Pressable>{activeMembers.map(m=><Pressable key={m.user_id} onPress={()=>setTarget(m.user_id)} style={[s.targetOption,target===m.user_id&&s.targetSelected]}><Text style={[s.targetText,target===m.user_id&&s.targetTextSelected]}>{m.profiles?.display_name||"Member"}</Text></Pressable>)}</View>
    <Pressable onPress={()=>void addChallenge()} disabled={busy} style={[s.primary,busy&&s.disabled]}><Text style={s.primaryText}>{busy?"Please wait…":"Add to match queue"}</Text></Pressable>
    {room.status==="active_game"&&queue.find(q=>q.match_id)&&<Pressable onPress={()=>router.push({pathname:"/gallery",params:{match:queue.find(q=>q.match_id)!.match_id!}})} style={[s.primary,{backgroundColor:"#B17B27"}]}><Text style={s.primaryText}>Enter The Gallery · Watch live</Text></Pressable>}\n    <Text style={s.fieldLabel}>Queue</Text>
    {queue.length===0?<Text style={s.empty}>The queue is clear. Be the first to request a game.</Text>:queue.map((q,i)=>{const incoming=q.status==="offered"&&q.offered_to_id===userId;const own=q.challenger_id===userId;return <View key={q.id} style={s.queueRow}><View style={s.queueNumber}><Text style={s.queueNumberText}>{i+1}</Text></View><View style={{flex:1}}><Text style={s.memberName}>{GAMES.find(g=>g.value===q.game_code)?.label||q.game_code.replace(/_/g," ")}</Text><Text style={s.memberType}>{own?"Your request":q.challenged_id?"Direct challenge":"Open match"}  ·  {q.status}{q.status==="offered"&&q.expires_at?` · responds by ${new Date(q.expires_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""}</Text></View>{q.status==="accepted"&&(q.challenger_id===userId||q.offered_to_id===userId)&&<Pressable onPress={()=>void launchMatch(q.id)} disabled={busy} style={s.accept}><Text style={s.acceptText}>Launch Word Chain</Text></Pressable>}{incoming&&<View style={s.queueActions}><Pressable onPress={()=>void respond(q.id,true)} style={s.accept}><Text style={s.acceptText}>Accept</Text></Pressable><Pressable onPress={()=>void respond(q.id,false)} style={s.pass}><Text style={s.passText}>Pass</Text></Pressable></View>}</View>})}
   </View>
  </>:<>
   {clubId&&<View style={s.card}><Text style={s.sectionTitle}>Host a fellowship</Text><Text style={s.muted}>Create a room for your club. Club administrators can open rooms; all signed-in Kimeza members can visit.</Text>
    <Text style={s.fieldLabel}>Room name</Text><TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Club Fellowship" maxLength={80}/>
    <Text style={s.fieldLabel}>Social break between games</Text><View style={s.durationRow}>{[1,3,5,10,15,30].map(n=><Pressable key={n} onPress={()=>setBreakMinutes(String(n))} style={[s.duration,!([1,3,5,10,15,30].includes(Number(breakMinutes))?Number(breakMinutes)===n:n===5)&&s.durationOff,Number(breakMinutes)===n&&s.durationOn]}><Text style={[s.durationText,Number(breakMinutes)===n&&s.durationTextOn]}>{n} min</Text></Pressable>)}</View>
    <Pressable onPress={()=>void createRoom()} disabled={busy} style={[s.primary,busy&&s.disabled]}><Text style={s.primaryText}>{busy?"Creating…":"Create fellowship room"}</Text></Pressable>
   </View>}
   <View style={s.listHeader}><Text style={s.sectionTitle}>Open rooms</Text><Pressable onPress={()=>void refresh()}><Text style={s.refreshText}>Refresh</Text></Pressable></View>
   {rooms.length===0?<View style={s.emptyCard}><Text style={s.emptyTitle}>No rooms are open yet</Text><Text style={s.muted}>When a club opens a fellowship room, it will appear here. You can visit rooms hosted by other clubs.</Text></View>:rooms.map(r=><View key={r.id} style={s.roomCard}><View style={s.roomIcon}><Text style={{fontSize:21}}>♧</Text></View><View style={{flex:1}}><Text style={s.roomTitle}>{r.title}</Text><Text style={s.muted}>{r.club_name||r.clubs?.name||"Club"}  ·  Break {Math.round(r.break_duration_seconds/60)} min</Text><Text style={s.roomStatus}>{r.status==="social"?"SOCIAL BREAK":"GAME IN PROGRESS"}</Text></View><Pressable onPress={()=>void joinRoom(r)} disabled={busy} style={s.join}><Text style={s.joinText}>Join</Text></Pressable></View>)}
  </>}
 </View></ScrollView>;
}

const s=StyleSheet.create({
 page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},shell:{width:"100%",maxWidth:820,alignSelf:"center",paddingTop:18,paddingBottom:36},back:{color:"#557168",fontWeight:"800",marginBottom:22},eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},title:{color:"#102A24",fontSize:31,fontWeight:"900",marginTop:7},subtitle:{color:"#68776F",lineHeight:22,marginTop:8,marginBottom:20},
 hero:{backgroundColor:"#102A24",borderRadius:20,padding:20,marginBottom:14},heroTop:{flexDirection:"row",alignItems:"center"},liveDot:{width:8,height:8,borderRadius:4,backgroundColor:"#55C58A",marginRight:7},liveLabel:{color:"#A8D7B9",fontSize:10,fontWeight:"900",letterSpacing:1.5},leave:{borderWidth:1,borderColor:"#648074",borderRadius:9,paddingVertical:7,paddingHorizontal:10},leaveText:{color:"#fff",fontWeight:"800",fontSize:11},heroTitle:{color:"#fff",fontSize:23,fontWeight:"900",marginTop:15},heroSub:{color:"#C2D3C8",marginTop:5,fontSize:12},heroStats:{flexDirection:"row",gap:30,marginTop:20,borderTopWidth:1,borderTopColor:"#355247",paddingTop:15},statValue:{color:"#fff",fontSize:19,fontWeight:"900"},statLabel:{color:"#AFC2B6",fontSize:10,marginTop:3},
 card:{backgroundColor:"#fff",borderRadius:17,borderWidth:1,borderColor:"#E2E9E3",padding:17,marginBottom:13},sectionTitle:{color:"#153B30",fontSize:17,fontWeight:"900"},muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},memberRow:{flexDirection:"row",alignItems:"center",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EFF2EF",gap:10},avatar:{width:34,height:34,borderRadius:17,backgroundColor:"#E5F0E8",alignItems:"center",justifyContent:"center"},avatarText:{color:"#176B45",fontWeight:"900"},memberName:{color:"#18352C",fontWeight:"800",fontSize:13},memberType:{color:"#8B671F",fontSize:10,textTransform:"capitalize",marginTop:3},youTag:{color:"#176B45",fontSize:9,fontWeight:"900"},empty:{color:"#87958D",fontSize:12,paddingVertical:13},
 composer:{flexDirection:"row",alignItems:"center",gap:8,marginTop:12},messageInput:{flex:1,minHeight:44,maxHeight:100,backgroundColor:"#F7F9F7",borderWidth:1,borderColor:"#DCE5DE",borderRadius:12,padding:12,color:"#18352C"},send:{backgroundColor:"#153B30",paddingVertical:13,paddingHorizontal:16,borderRadius:11},sendText:{color:"#fff",fontWeight:"900"},disabled:{opacity:.5},reactions:{flexDirection:"row",gap:8,marginTop:10,marginBottom:5},reaction:{backgroundColor:"#F1F5F1",padding:8,borderRadius:10},reactionText:{fontSize:18},chatRow:{flexDirection:"row",gap:8,paddingVertical:8},chatAvatar:{width:28,height:28,borderRadius:14,backgroundColor:"#EAF0EA",alignItems:"center",justifyContent:"center"},chatAvatarText:{color:"#176B45",fontSize:11,fontWeight:"900"},chatBubble:{flex:1,backgroundColor:"#F7F9F7",borderRadius:12,padding:10},chatName:{color:"#18352C",fontSize:11,fontWeight:"900"},chatTime:{color:"#94A098",fontWeight:"500",fontSize:10},chatText:{color:"#40534A",fontSize:13,lineHeight:19,marginTop:4},
 fieldLabel:{color:"#40534A",fontSize:11,fontWeight:"900",marginTop:16,marginBottom:7},gameGrid:{flexDirection:"row",flexWrap:"wrap",gap:7},gameOption:{paddingVertical:9,paddingHorizontal:11,borderRadius:10,borderWidth:1,borderColor:"#DCE5DE",backgroundColor:"#FAFBFA"},gameSelected:{backgroundColor:"#E6F1E9",borderColor:"#176B45"},gameText:{color:"#53645B",fontSize:11,fontWeight:"700"},gameTextSelected:{color:"#176B45",fontWeight:"900"},targetList:{flexDirection:"row",flexWrap:"wrap",gap:7},targetOption:{paddingVertical:8,paddingHorizontal:10,borderRadius:9,borderWidth:1,borderColor:"#DCE5DE"},targetSelected:{backgroundColor:"#153B30",borderColor:"#153B30"},targetText:{fontSize:11,color:"#53645B"},targetTextSelected:{color:"#fff",fontWeight:"800"},primary:{backgroundColor:"#153B30",borderRadius:11,padding:14,alignItems:"center",marginTop:14},primaryText:{color:"#fff",fontWeight:"900"},queueRow:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:11,borderBottomWidth:1,borderBottomColor:"#EFF2EF"},queueNumber:{width:26,height:26,borderRadius:13,backgroundColor:"#EDF3EE",alignItems:"center",justifyContent:"center"},queueNumberText:{color:"#176B45",fontWeight:"900"},queueActions:{flexDirection:"row",gap:6},accept:{backgroundColor:"#176B45",paddingVertical:8,paddingHorizontal:10,borderRadius:8},acceptText:{color:"#fff",fontSize:11,fontWeight:"900"},pass:{borderWidth:1,borderColor:"#C8D7CC",paddingVertical:8,paddingHorizontal:10,borderRadius:8},passText:{color:"#176B45",fontSize:11,fontWeight:"800"},
 input:{backgroundColor:"#F8FAF8",borderWidth:1,borderColor:"#DCE5DE",borderRadius:11,padding:13,color:"#18352C"},durationRow:{flexDirection:"row",flexWrap:"wrap",gap:7},duration:{borderWidth:1,borderColor:"#DCE5DE",borderRadius:9,paddingVertical:9,paddingHorizontal:12},durationOff:{backgroundColor:"#FAFBFA"},durationOn:{backgroundColor:"#E6F1E9",borderColor:"#176B45"},durationText:{color:"#53645B",fontSize:11,fontWeight:"700"},durationTextOn:{color:"#176B45",fontWeight:"900"},listHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:10,marginBottom:9},refreshText:{color:"#176B45",fontWeight:"900",fontSize:12},roomCard:{backgroundColor:"#fff",borderRadius:15,borderWidth:1,borderColor:"#E2E9E3",padding:14,marginBottom:10,flexDirection:"row",alignItems:"center",gap:12},roomIcon:{width:42,height:42,borderRadius:13,backgroundColor:"#E8F1EA",alignItems:"center",justifyContent:"center"},roomTitle:{color:"#153B30",fontSize:15,fontWeight:"900"},roomStatus:{color:"#B17B27",fontSize:9,fontWeight:"900",letterSpacing:1,marginTop:6},join:{backgroundColor:"#153B30",paddingVertical:10,paddingHorizontal:16,borderRadius:10},joinText:{color:"#fff",fontWeight:"900",fontSize:12},emptyCard:{backgroundColor:"#fff",borderRadius:15,padding:18,borderWidth:1,borderColor:"#E2E9E3"},emptyTitle:{color:"#153B30",fontSize:15,fontWeight:"900"},alert:{backgroundColor:"#FEF3F2",padding:12,borderRadius:10,marginBottom:12},alertText:{color:"#B42318",fontSize:12},success:{backgroundColor:"#E7F0E9",padding:12,borderRadius:10,marginBottom:12},successText:{color:"#176B45",fontSize:12,fontWeight:"700"},loading:{padding:40,alignItems:"center",gap:12}
});
