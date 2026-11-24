import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Club = { id: string; name: string; club_type: "rotary" | "rotaract" };
type Member = { membership_id: string; user_id: string; display_name: string; avatar_url: string | null; status: "active" | "pending"; joined_at: string | null; created_at: string };

export default function ClubAdminScreen() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Account services are unavailable."); setLoading(false); return; }
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError("Please sign in again."); setLoading(false); return; }
    const { data: assignments, error: assignmentError } = await supabase
      .from("club_admins").select("club_id").eq("user_id", auth.user.id);
    if (assignmentError) { setError(assignmentError.message); setLoading(false); return; }
    const ids = [...new Set((assignments ?? []).map(x => x.club_id))];
    if (!ids.length) { setClubs([]); setMembers([]); setLoading(false); return; }
    const { data: clubRows, error: clubError } = await supabase.from("clubs")
      .select("id,name,club_type").in("id", ids).order("name");
    if (clubError) { setError(clubError.message); setLoading(false); return; }
    const available = (clubRows ?? []) as Club[];
    setClubs(available);
    const selected = available.some(c => c.id === clubId) ? clubId : available[0]?.id ?? "";
    setClubId(selected);
    if (selected) {
      const { data, error: memberError } = await supabase.rpc("list_club_members", { p_club_id: selected });
      if (memberError) setError(memberError.message);
      else setMembers((data ?? []) as Member[]);
    } else setMembers([]);
    setLoading(false);
  }, [clubId]);

  useEffect(() => { void load(); }, [load]);

  async function review(member: Member, approve: boolean) {
    if (!supabase || busy) return;
    setBusy(member.membership_id); setError(""); setNotice("");
    const { error: actionError } = await supabase.rpc("review_club_membership", {
      p_membership_id: member.membership_id, p_approve: approve
    });
    if (actionError) setError(actionError.message);
    else setNotice(member.display_name + (approve ? " has been approved as a club member." : "'s membership request was rejected."));
    setBusy("");
    await load();
  }

  async function changeClub(id: string) {
    setClubId(id); setLoading(true); setError("");
    const { data, error: memberError } = await supabase!.rpc("list_club_members", { p_club_id: id });
    if (memberError) setError(memberError.message);
    else setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  const pending = members.filter(m => m.status === "pending");
  const active = members.filter(m => m.status === "active");

  return <ScrollView contentContainerStyle={styles.page}><View style={styles.shell}>
    <Link href="/dashboard" style={styles.back}>‹  Back to dashboard</Link>
    <Text style={styles.eyebrow}>KIMEZA PLAY • CLUB MANAGEMENT</Text>
    <Text style={styles.title}>Club administration</Text>
    <Text style={styles.subtitle}>Review membership requests and see the members connected to your club.</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!notice && <Text style={styles.notice}>{notice}</Text>}
    {loading ? <ActivityIndicator size="large" color="#176B45" /> : clubs.length === 0 ?
      <View style={styles.card}><Text style={styles.cardTitle}>No club administration access</Text><Text style={styles.body}>Your account has not been appointed as an administrator of a club.</Text></View> :
      <>
        <Text style={styles.label}>SELECT CLUB</Text>
        <View style={styles.clubChoices}>{clubs.map(c => <Pressable key={c.id} onPress={() => void changeClub(c.id)} style={[styles.clubChoice, clubId === c.id && styles.clubChoiceActive]}><Text style={[styles.clubChoiceText, clubId === c.id && styles.clubChoiceTextActive]}>{c.name}</Text></Pressable>)}</View>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.number}>{active.length}</Text><Text style={styles.statLabel}>Active members</Text></View>
          <View style={styles.stat}><Text style={styles.number}>{pending.length}</Text><Text style={styles.statLabel}>Pending requests</Text></View>
        </View>
        <Text style={styles.section}>Membership requests</Text>
        {pending.length === 0 ? <View style={styles.card}><Text style={styles.body}>There are no pending membership requests.</Text></View> :
          pending.map(m => <View key={m.membership_id} style={styles.card}>
            <Text style={styles.memberName}>{m.display_name || "Kimeza member"}</Text>
            <Text style={styles.body}>Requested {new Date(m.created_at).toLocaleDateString()}</Text>
            <View style={styles.actions}>
              <Pressable disabled={!!busy} onPress={() => void review(m, true)} style={[styles.action, styles.approve]}><Text style={styles.actionText}>{busy === m.membership_id ? "Please wait…" : "Approve"}</Text></Pressable>
              <Pressable disabled={!!busy} onPress={() => void review(m, false)} style={[styles.action, styles.reject]}><Text style={styles.rejectText}>Reject</Text></Pressable>
            </View>
          </View>)}
        <Text style={styles.section}>Current members</Text>
        {active.length === 0 ? <View style={styles.card}><Text style={styles.body}>No active members are listed yet.</Text></View> :
          active.map(m => <View key={m.membership_id} style={styles.memberRow}><View style={styles.memberAvatar}><Text style={styles.avatarText}>{(m.display_name || "M").trim().charAt(0).toUpperCase()}</Text></View><View style={styles.memberInfo}><Text style={styles.memberName}>{m.display_name || "Kimeza member"}</Text><Text style={styles.body}>Member since {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "date not recorded"}</Text></View><Text style={styles.activeTag}>ACTIVE</Text></View>)}
        <Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>Refresh members</Text></Pressable>
      </>}
  </View></ScrollView>;
}

const styles = StyleSheet.create({
 page:{flexGrow:1,backgroundColor:"#F4F7F3",padding:20},shell:{width:"100%",maxWidth:850,alignSelf:"center",paddingVertical:24},
 back:{color:"#557168",fontWeight:"700",marginBottom:26},eyebrow:{color:"#B17B27",fontSize:10,fontWeight:"900",letterSpacing:2},
 title:{color:"#102A24",fontSize:29,fontWeight:"900",marginTop:7},subtitle:{color:"#66756D",fontSize:14,lineHeight:22,marginTop:8,marginBottom:20},
 label:{color:"#66756D",fontSize:10,fontWeight:"900",letterSpacing:1.5,marginBottom:8},clubChoices:{gap:8},
 clubChoice:{backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E9E3",borderRadius:11,padding:13},clubChoiceActive:{borderColor:"#176B45",backgroundColor:"#E7F0E9"},
 clubChoiceText:{color:"#18352C",fontWeight:"700"},clubChoiceTextActive:{color:"#176B45"},
 stats:{flexDirection:"row",gap:12,marginTop:18},stat:{flex:1,backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E9E3",borderRadius:14,padding:16},
 number:{fontSize:25,fontWeight:"900",color:"#153B30"},statLabel:{fontSize:12,color:"#68776F",marginTop:4},
 section:{fontSize:19,fontWeight:"900",color:"#153B30",marginTop:24,marginBottom:10},
 card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E9E3",borderRadius:15,padding:16,marginBottom:9},
 cardTitle:{fontSize:16,fontWeight:"900",color:"#153B30"},body:{color:"#68776F",lineHeight:20,marginTop:4,fontSize:12},
 memberName:{fontSize:15,fontWeight:"900",color:"#153B30"},actions:{flexDirection:"row",gap:10,marginTop:14},
 action:{paddingVertical:11,paddingHorizontal:18,borderRadius:9},approve:{backgroundColor:"#176B45"},reject:{backgroundColor:"#FCE8E6"},
 actionText:{color:"#fff",fontWeight:"900"},rejectText:{color:"#A12B22",fontWeight:"900"},
 memberRow:{backgroundColor:"#fff",borderWidth:1,borderColor:"#E2E9E3",borderRadius:13,padding:13,marginBottom:8,flexDirection:"row",alignItems:"center",gap:11},
 memberAvatar:{width:38,height:38,borderRadius:19,backgroundColor:"#E7F0E9",alignItems:"center",justifyContent:"center"},avatarText:{color:"#176B45",fontWeight:"900",fontSize:16},
 memberInfo:{flex:1},activeTag:{fontSize:9,color:"#176B45",fontWeight:"900",letterSpacing:1},
 refresh:{backgroundColor:"#153B30",borderRadius:11,padding:13,alignItems:"center",marginTop:18},refreshText:{color:"#fff",fontWeight:"800"},
 error:{color:"#B42318",backgroundColor:"#FEF3F2",padding:10,borderRadius:9,marginBottom:12},notice:{color:"#176B45",backgroundColor:"#E7F0E9",padding:10,borderRadius:9,marginBottom:12}
});