import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Org = { id: string; name: string; status: string; parent?: string; kind: "district" | "zone" | "club" };

export default function PlatformAdminScreen() {
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [isAdmin,setIsAdmin]=useState(false);
  const [items,setItems]=useState<Org[]>([]);

  const load=useCallback(async()=>{
    if(!supabase){setError("Account services are not configured.");setLoading(false);return;}
    setLoading(true);setError("");
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){setIsAdmin(false);setLoading(false);return;}
    const {data:profile,error:profileError}=await supabase.from("profiles").select("platform_role").eq("id",auth.user.id).maybeSingle();
    if(profileError){setError(profileError.message);setLoading(false);return;}
    const admin=profile?.platform_role==="platform_admin";setIsAdmin(admin);
    if(!admin){setLoading(false);return;}
    const [ds,zs,cs]=await Promise.all([
      supabase.from("districts").select("id,name,status").order("name"),
      supabase.from("zones").select("id,name,status,district_id").order("name"),
      supabase.from("clubs").select("id,name,status,zone_id").order("name")
    ]);
    const problem=ds.error||zs.error||cs.error;
    if(problem)setError(problem.message);
    const districts=(ds.data||[]).map(x=>({id:x.id,name:x.name,status:x.status,kind:"district" as const}));
    const zones=(zs.data||[]).map(x=>({id:x.id,name:x.name,status:x.status,parent:x.district_id,kind:"zone" as const}));
    const clubs=(cs.data||[]).map(x=>({id:x.id,name:x.name,status:x.status,parent:x.zone_id,kind:"club" as const}));
    setItems([...districts,...zones,...clubs]);setLoading(false);
  },[]);

  async function review(item:Org,approve:boolean){
    if(!supabase)return;
    setBusy(item.id);setError("");setNotice("");
    const {error:rpcError}=await supabase.rpc("review_organization",{p_entity_type:item.kind,p_entity_id:item.id,p_approve:approve});
    if(rpcError)setError(rpcError.message);
    else setNotice(item.name+" "+(approve?"approved.":"rejected."));
    setBusy("");await load();
  }

  const pending=items.filter(x=>x.status==="pending");
  const approved=items.filter(x=>x.status==="approved");
  return <ScrollView contentContainerStyle={styles.page}><View style={styles.shell}>
    <Text style={styles.eyebrow}>KIMEZA PLAY • CONTROL CENTRE</Text>
    <Text style={styles.title}>Platform administration</Text>
    <Text style={styles.intro}>Manage the Rotary and Rotaract organisational directory and review registrations.</Text>
    {loading?<ActivityIndicator size="large" color="#176B45"/>:!isAdmin?
      <View style={styles.card}><Text style={styles.cardTitle}>Administrator access required</Text><Text style={styles.body}>This account does not have platform administrator permissions.</Text></View>:
      <>
        {!!error&&<Text style={styles.error}>{error}</Text>}{!!notice&&<Text style={styles.notice}>{notice}</Text>}
        <View style={styles.stats}><View style={styles.stat}><Text style={styles.num}>{pending.length}</Text><Text style={styles.label}>Pending review</Text></View><View style={styles.stat}><Text style={styles.num}>{approved.length}</Text><Text style={styles.label}>Approved records</Text></View></View>
        <Text style={styles.section}>Pending approvals</Text>
        {pending.length===0?<View style={styles.card}><Text style={styles.body}>There are no pending registrations.</Text></View>:pending.map(item=><View key={item.id} style={styles.card}>
          <Text style={styles.kind}>{item.kind.toUpperCase()}</Text><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.body}>Status: {item.status}</Text>
          <View style={styles.actions}><Pressable disabled={!!busy} onPress={()=>review(item,true)} style={[styles.action,styles.approve]}><Text style={styles.actionText}>{busy===item.id?"Please wait…":"Approve"}</Text></Pressable><Pressable disabled={!!busy} onPress={()=>review(item,false)} style={[styles.action,styles.reject]}><Text style={styles.rejectText}>Reject</Text></Pressable></View>
          {item.kind!=="district"&&<Text style={styles.hint}>Parent record must already be approved before this record can be approved.</Text>}
        </View>)}
        <Text style={styles.section}>Approved directory</Text>
        {approved.length===0?<View style={styles.card}><Text style={styles.body}>No approved organisations yet.</Text></View>:approved.map(item=><View key={item.id} style={styles.row}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.kind}>{item.kind}</Text></View>)}
        <Pressable onPress={load} style={styles.refresh}><Text style={styles.refreshText}>Refresh records</Text></Pressable>
      </>}
    <Link href="/dashboard" style={styles.back}>Back to member dashboard</Link>
  </View></ScrollView>;
}
const styles=StyleSheet.create({
 page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:20},shell:{width:"100%",maxWidth:900,alignSelf:"center",paddingVertical:24},
 eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},title:{color:"#102A24",fontSize:28,fontWeight:"900",marginTop:7},intro:{color:"#68776F",lineHeight:22,marginTop:8,marginBottom:22},
 stats:{flexDirection:"row",gap:12,marginBottom:12},stat:{flex:1,backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E9E3",borderRadius:14,padding:16},num:{fontSize:25,fontWeight:"900",color:"#153B30"},label:{fontSize:12,color:"#68776F",marginTop:4},
 section:{fontSize:19,fontWeight:"900",color:"#153B30",marginTop:22,marginBottom:10},card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E9E3",borderRadius:15,padding:16,marginBottom:10},kind:{fontSize:10,fontWeight:"900",letterSpacing:1,color:"#B17B27"},cardTitle:{fontSize:16,fontWeight:"900",color:"#153B30",marginTop:5},body:{color:"#68776F",lineHeight:20,marginTop:5},actions:{flexDirection:"row",gap:10,marginTop:14},action:{paddingVertical:11,paddingHorizontal:18,borderRadius:9},approve:{backgroundColor:"#176B45"},reject:{backgroundColor:"#FCE8E6"},actionText:{color:"#fff",fontWeight:"900"},rejectText:{color:"#A12B22",fontWeight:"900"},hint:{fontSize:11,color:"#9A6B25",marginTop:10},row:{backgroundColor:"#fff",borderRadius:12,padding:14,marginBottom:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},refresh:{backgroundColor:"#153B30",borderRadius:11,padding:13,alignItems:"center",marginTop:20},refreshText:{color:"#fff",fontWeight:"800"},back:{color:"#557168",textAlign:"center",marginTop:22,fontWeight:"700"},error:{color:"#B42318",backgroundColor:"#FEF3F2",padding:10,borderRadius:9,marginBottom:12},notice:{color:"#176B45",backgroundColor:"#E7F0E9",padding:10,borderRadius:9,marginBottom:12}
});