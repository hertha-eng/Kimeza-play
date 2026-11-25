import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Room = { id: string; club_id: string; title: string; status: string; break_duration_seconds: number; opened_at: string; clubs?: { name: string } | null };
type Member = { user_id: string; member_kind: string; home_club_id: string | null; profiles?: { display_name: string } | null };
type Message = { id: string; message: string; message_kind: string; created_at: string; profiles?: { display_name: string } | null };
type Challenge = { id: string; challenger_id: string; challenged_id: string | null; game_code: string; queue_position: number; status: string };

export default function FellowshipScreen() {
  const [userId,setUserId]=useState("");
  const [clubId,setClubId]=useState("");
  const [clubName,setClubName]=useState("");
  const [rooms,setRooms]=useState<Room[]>([]);
  const [room,setRoom]=useState<Room|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [messages,setMessages]=useState<Message[]>([]);
  const [queue,setQueue]=useState<Challenge[]>([]);
  const [title,setTitle]=useState("Club Fellowship");
  const [breakMinutes,setBreakMinutes]=useState("5");
  const [message,setMessage]=useState("");
  const [game,setGame]=useState("word_chain");
  const [target,setTarget]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const loadRooms=useCallback(async()=>{
    if(!supabase)return;
    const {data:auth}=await supabase.auth.getUser();
    const uid=auth.user?.id;if(!uid)return;setUserId(uid);
    const {data:m}=await supabase.from("club_memberships").select("club_id,status").eq("user_id",uid).eq("status","active").limit(1).maybeSingle();
    if(m?.club_id){setClubId(m.club_id);const {data:c}=await supabase.from("clubs").select("name").eq("id",m.club_id).maybeSingle();setClubName(c?.name||"My club");}
    const {data:r,error:e}=await supabase.from("fellowship_rooms").select("id,club_id,title,status,break_duration_seconds,opened_at,clubs(name)").neq("status","closed").order("opened_at",{ascending:false}).limit(50);
    if(e)setError(e.message);else setRooms((r||[]) as unknown as Room[]);
  },[]);

  const loadRoom=useCallback(async(id:string)=>{
    if(!supabase)return;
    const [mr,ms,ch]=await Promise.all([
      supabase.from("fellowship_room_members").select("user_id,member_kind,home_club_id,profiles(display_name)").eq("room_id",id).is("left_at",null).order("joined_at"),
      supabase.from("fellowship_room_messages").select("id,message,message_kind,created_at,profiles(display_name)").eq("room_id",id).order("created_at",{ascending:false}).limit(60),
      supabase.from("fellowship_challenges").select("id,challenger_id,challenged_id,game_code,queue_position,status").eq("room_id",id).in("status",["queued","offered","accepted"]).order("queue_position")
    ]);
    if(mr.error||ms.error||ch.error){setError(mr.error?.message||ms.error?.message||ch.error?.message||"Could not load room.");return;}
    setMembers((mr.data||[]) as unknown as Member[]);
    setMessages((ms.data||[]) as unknown as Message[]);
    setQueue((ch.data||[]) as Challenge[]);
  },[]);

  useEffect(()=>{void loadRooms();},[loadRooms]);
  useEffect(()=>{if(!room)return;void loadRoom(room.id);const timer=setInterval(()=>void loadRoom(room.id),3000);return()=>clearInterval(timer);},[room?.id,loadRoom]);

  async function run(fn:()=>Promise<any>,success:string){
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{const {data,error:e}=await fn();if(e)throw e;if(data&&typeof data==="object"&&data.room_id){setNotice(success);}else setNotice(success);await loadRooms();if(room)await loadRoom(room.id);return data;}
    catch(e:any){setError(e?.message||"Something went wrong.");}
    finally{setBusy(false);}
  }
  async function createRoom(){
    if(!clubId){setError("You need an active club membership to create a room. You can still join a room as a visitor.");return;}
    await run(()=>supabase!.rpc("create_fellowship_room",{p_club_id:clubId,p_title:title,p_break_seconds:Math.max(1,Math.min(30,Number(breakMinutes)||5))*60}),"Fellowship room created.");
    const {data}=await supabase!.from("fellowship_rooms").select("id,club_id,title,status,break_duration_seconds,opened_at").eq("club_id",clubId).eq("created_by",userId).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(data){setRoom(data as Room);await loadRoom(data.id);}
  }
  async function joinRoom(r:Room){
    await run(()=>supabase!.rpc("join_fellowship_room",{p_room_id:r.id}),"You joined the fellowship room.");
    setRoom(r);await loadRoom(r.id);
  }
  async function post(kind:"comment"|"reaction"="comment",value=message){
    if(!room||!value.trim())return;
    await run(()=>supabase!.rpc("post_fellowship_message",{p_room_id:room.id,p_message:value.trim(),p_kind:kind}),"Message posted.");
    setMessage("");
  }
  async function challenge(){
    if(!room)return;
    await run(()=>supabase!.rpc("queue_fellowship_challenge",{p_room_id:room.id,p_game_code:game,p_challenged_id:target||null}),"Your match request has been queued.");
    setTarget("");
  }
  async function respond(id:string,accept:boolean){
    await run(()=>supabase!.rpc("respond_fellowship_challenge",{p_challenge_id:id,p_accept:accept}),accept?"Challenge accepted.":"Challenge declined.");
  }
  async function leave(){
    if(!room)return;
    await run(()=>supabase!.rpc("leave_fellowship_room",{p_room_id:room.id}),"You left the room.");
    setRoom(null);await loadRooms();
  }

  return <ScrollView contentContainerStyle={s.page}><View style={s.shell}>
    <Link href="/dashboard" style={s.back}>‹ Back to dashboard</Link>
    <Text style={s.eyebrow}>KIMEZA PLAY • CLUB FELLOWSHIP</Text><Text style={s.title}>Fellowship rooms</Text>
    <Text style={s.sub}>A shared club space to meet, chat, cheer and organise the next game. Visiting members and guests can join with their Kimeza accounts.</Text>
    {!!error&&<Text style={s.error}>{error}</Text>}{!!notice&&<Text style={s.notice}>{notice}</Text>}
    {room?<>
      <View style={s.card}><View style={s.row}><View style={{flex:1}}><Text style={s.heading}>{room.title}</Text><Text style={s.muted}>{room.clubs?.name||clubName||"Club room"} • {room.status.replace("_"," ")}</Text></View><Pressable onPress={()=>void leave()} style={s.outline}><Text style={s.actionText}>Leave</Text></Pressable></View>
        <Text style={s.section}>People in this room ({members.length})</Text>
        {members.map(m=><View key={m.user_id} style={s.person}><Text style={s.personName}>{m.profiles?.display_name||"Kimeza member"}{m.user_id===userId?" (you)":""}</Text><Text style={s.tag}>{m.member_kind.replace("_"," ")}</Text></View>)}
      </View>
      <View style={s.card}><Text style={s.heading}>Social lounge</Text><Text style={s.muted}>Chat and react during the break. The room remains open between matches.</Text>
        <View style={s.row}><TextInput value={message} onChangeText={setMessage} style={[s.input,{flex:1}]} placeholder="Write a message…" maxLength={500}/><Pressable onPress={()=>void post()} disabled={busy||!message.trim()} style={s.send}><Text style={s.sendText}>Send</Text></Pressable></View>
        <View style={s.reactions}>{["👏","🔥","😂","❤️","💪","🎉"].map(x=><Pressable key={x} onPress={()=>void post("reaction",x)} style={s.react}><Text style={{fontSize:20}}>{x}</Text></Pressable>)}</View>
        {messages.map(m=><View key={m.id} style={s.message}><Text style={s.personName}>{m.profiles?.display_name||"Member"} <Text style={s.muted}>• {new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</Text></Text><Text style={s.messageText}>{m.message}</Text></View>)}
      </View>
      <View style={s.card}><Text style={s.heading}>Next match queue</Text><Text style={s.muted}>Choose a game and request a friendly match. Challenges can be accepted or declined by the invited player.</Text>
        <TextInput value={game} onChangeText={setGame} style={s.input} placeholder="Game code (e.g. word_chain)"/>
        <TextInput value={target} onChangeText={setTarget} style={s.input} placeholder="Challenge player ID (optional)"/>
        <Pressable onPress={()=>void challenge()} disabled={busy} style={s.primary}><Text style={s.primaryText}>Join challenge queue</Text></Pressable>
        {queue.map((q,i)=><View key={q.id} style={s.person}><View style={{flex:1}}><Text style={s.personName}>#{i+1} • {q.game_code.replace("_"," ")}</Text><Text style={s.muted}>{q.status} • {q.challenged_id?"Direct challenge":"Open queue"}</Text></View>
          {q.challenged_id===userId&&q.status!=="accepted"&&<View style={s.row}><Pressable onPress={()=>void respond(q.id,true)} style={s.accept}><Text style={s.primaryText}>Accept</Text></Pressable><Pressable onPress={()=>void respond(q.id,false)} style={s.outline}><Text style={s.actionText}>Pass</Text></Pressable></View>}
        </View>)}
      </View>
    </>:<>
      {clubId&&<View style={s.card}><Text style={s.heading}>Open your club room</Text><Text style={s.muted}>{clubName||"Your active club"} • Administrators can create a room. Members can join an existing room.</Text>
        <TextInput value={title} onChangeText={setTitle} style={s.input} placeholder="Room title"/>
        <TextInput value={breakMinutes} onChangeText={setBreakMinutes} style={s.input} keyboardType="number-pad" placeholder="Break duration in minutes (1–30)"/>
        <Pressable onPress={()=>void createRoom()} disabled={busy} style={s.primary}><Text style={s.primaryText}>{busy?"Please wait…":"Create fellowship room"}</Text></Pressable>
      </View>}
      <Text style={s.section}>Open rooms</Text>
      {rooms.length===0?<Text style={s.muted}>No open fellowship rooms yet.</Text>:rooms.map(r=><View key={r.id} style={s.card}><Text style={s.heading}>{r.title}</Text><Text style={s.muted}>{r.clubs?.name||"Club"} • {r.status.replace("_"," ")} • Break {Math.round(r.break_duration_seconds/60)} min</Text><Pressable onPress={()=>void joinRoom(r)} disabled={busy} style={s.secondary}><Text style={s.actionText}>Join room</Text></Pressable></View>)}
    </>}
  </View></ScrollView>;
}

const s=StyleSheet.create({
 page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:18},shell:{width:"100%",maxWidth:820,alignSelf:"center",paddingVertical:20},
 back:{color:"#557168",fontWeight:"700",marginBottom:22},eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},title:{color:"#102A24",fontSize:30,fontWeight:"900",marginTop:7},sub:{color:"#66756D",lineHeight:22,marginTop:8,marginBottom:18},
 card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#E2E9E3",padding:18,marginBottom:14},heading:{color:"#153B30",fontSize:18,fontWeight:"900"},section:{color:"#153B30",fontSize:14,fontWeight:"900",marginTop:18,marginBottom:8},muted:{color:"#68776F",fontSize:12,lineHeight:19,marginTop:5},input:{backgroundColor:"#F8FAF8",borderWidth:1,borderColor:"#DCE5DE",borderRadius:11,padding:13,color:"#18352C",marginTop:10,marginBottom:8},row:{flexDirection:"row",alignItems:"center",gap:8},primary:{backgroundColor:"#153B30",borderRadius:11,padding:13,alignItems:"center",marginTop:8},primaryText:{color:"#fff",fontWeight:"900"},secondary:{backgroundColor:"#E7F0E9",borderRadius:10,padding:12,alignItems:"center",marginTop:12},actionText:{color:"#176B45",fontWeight:"900"},outline:{borderWidth:1,borderColor:"#C8D7CC",borderRadius:9,padding:9},person:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EDF1ED"},personName:{color:"#18352C",fontWeight:"800",fontSize:13},tag:{color:"#8B671F",fontSize:10,fontWeight:"800",textTransform:"capitalize"},send:{backgroundColor:"#153B30",padding:13,borderRadius:10},sendText:{color:"#fff",fontWeight:"800"},reactions:{flexDirection:"row",gap:8,marginVertical:10},react:{backgroundColor:"#F3F6F3",padding:8,borderRadius:10},message:{paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#EDF1ED"},messageText:{color:"#40534A",marginTop:4,lineHeight:20},accept:{backgroundColor:"#176B45",padding:9,borderRadius:8},error:{color:"#B42318",backgroundColor:"#FEF3F2",padding:10,borderRadius:9,marginBottom:12},notice:{color:"#176B45",backgroundColor:"#E7F0E9",padding:10,borderRadius:9,marginBottom:12}
});
