import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Club = { id: string; name: string; club_type: "rotary" | "rotaract"; zone_id: string };
type Membership = { id: string; club_id: string; status: string; created_at: string };

export default function ClubMembershipScreen() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [search, setSearch] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Account services are unavailable."); setLoading(false); return; }
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/auth"); return; }
    const [clubResult, memberResult] = await Promise.all([
      supabase.from("clubs").select("id,name,club_type,zone_id").eq("status", "approved").order("name"),
      supabase.from("club_memberships").select("id,club_id,status,created_at").eq("user_id", auth.user.id).in("status", ["active", "pending"]).limit(1).maybeSingle()
    ]);
    if (clubResult.error) setError(clubResult.error.message);
    else setClubs((clubResult.data ?? []) as Club[]);
    if (memberResult.error) setError(memberResult.error.message);
    setMembership(memberResult.data as Membership | null);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filteredClubs = clubs.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function requestToJoin(club: Club) {
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/auth"); return; }
    const { error: e } = await supabase.from("club_memberships").insert({ club_id: club.id, user_id: auth.user.id, status: "pending" });
    if (e) setError(e.message);
    else { setMessage("Your membership request has been sent. It will remain pending until a club administrator reviews it."); await load(); }
    setBusy(false);
  }

  async function redeemInvite() {
    if (!supabase || busy) return;
    if (!inviteCode.trim()) { setError("Enter your club invitation code."); return; }
    setBusy(true); setError(""); setMessage("");
    const { error: e } = await supabase.rpc("redeem_club_invitation_code", { p_code: inviteCode.trim() });
    if (e) setError(e.message);
    else { setInviteCode(""); setMessage("Invitation accepted. Your club membership is now active."); await load(); }
    setBusy(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <Link href="/dashboard" style={styles.back}>‹  Back to dashboard</Link>
        <Text style={styles.eyebrow}>KIMEZA PLAY • COMMUNITY</Text>
        <Text style={styles.title}>Find your club</Text>
        <Text style={styles.subtitle}>Connect your account to your Rotary or Rotaract club. You can request membership or join directly with an invitation code from your club.</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!message && <Text style={styles.success}>{message}</Text>}
        {loading ? <ActivityIndicator size="large" color="#176B45" /> : <>
          {membership ? (
            <View style={styles.current}>
              <Text style={styles.cardEyebrow}>YOUR MEMBERSHIP</Text>
              <Text style={styles.cardTitle}>{clubs.find(c => c.id === membership.club_id)?.name ?? "Your club"}</Text>
              <Text style={styles.cardText}>Status: {membership.status === "active" ? "Active member" : "Request pending review"}</Text>
              {membership.status === "pending" && <Text style={styles.note}>Your club administrator must approve your request before membership becomes active.</Text>}
            </View>
          ) : <>
            <View style={styles.panel}>
              <Text style={styles.cardTitle}>Have an invitation code?</Text>
              <Text style={styles.cardText}>Enter the code shared by your club administrator to join immediately.</Text>
              <TextInput value={inviteCode} onChangeText={setInviteCode} placeholder="Enter invitation code" placeholderTextColor="#89958E" autoCapitalize="characters" autoCorrect={false} style={styles.input} />
              <Pressable disabled={busy} onPress={redeemInvite} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "Please wait…" : "Redeem invitation code"}</Text></Pressable>
            </View>
            <View style={styles.directoryHeader}>
              <Text style={styles.sectionTitle}>Approved clubs</Text>
              <Text style={styles.count}>{filteredClubs.length} clubs</Text>
            </View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search clubs by name" placeholderTextColor="#89958E" style={styles.input} />
            {filteredClubs.length === 0 ? <Text style={styles.empty}>No approved clubs match that search yet.</Text> : filteredClubs.map(club => (
              <View key={club.id} style={styles.club}>
                <View style={styles.clubInfo}>
                  <Text style={styles.clubType}>{club.club_type === "rotaract" ? "ROTARACT CLUB" : "ROTARY CLUB"}</Text>
                  <Text style={styles.clubName}>{club.name}</Text>
                </View>
                <Pressable disabled={busy} onPress={() => requestToJoin(club)} style={[styles.outline, busy && styles.disabled]}><Text style={styles.outlineText}>Request to join</Text></Pressable>
              </View>
            ))}
          </>}
        </>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: "#F4F7F3", padding: 20 },
  shell: { width: "100%", maxWidth: 850, alignSelf: "center", paddingVertical: 24 },
  back: { color: "#557168", fontWeight: "700", marginBottom: 26 },
  eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 30, fontWeight: "900", marginTop: 7 },
  subtitle: { color: "#66756D", fontSize: 14, lineHeight: 22, marginTop: 8, marginBottom: 20, maxWidth: 650 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E9E3", padding: 18, marginBottom: 24 },
  cardEyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  cardTitle: { color: "#153B30", fontSize: 18, fontWeight: "900" },
  cardText: { color: "#68776F", lineHeight: 20, marginTop: 6, marginBottom: 10 },
  current: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#DCE8DF", padding: 20 },
  note: { color: "#94651F", lineHeight: 20, marginTop: 8 },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13, color: "#18352C", marginTop: 10, marginBottom: 12 },
  primary: { backgroundColor: "#153B30", borderRadius: 11, padding: 14, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  directoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitle: { color: "#153B30", fontSize: 20, fontWeight: "900" },
  count: { color: "#6B7A72", fontSize: 12 },
  club: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E9E3", borderRadius: 14, padding: 15, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  clubInfo: { flex: 1 },
  clubType: { color: "#B17B27", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  clubName: { color: "#18352C", fontWeight: "800", fontSize: 15, marginTop: 5 },
  outline: { borderWidth: 1, borderColor: "#176B45", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  outlineText: { color: "#176B45", fontWeight: "800", fontSize: 12 },
  empty: { color: "#68776F", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 18, marginTop: 10 },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 12, borderRadius: 9, marginBottom: 12 },
  success: { color: "#176B45", backgroundColor: "#ECFDF3", padding: 12, borderRadius: 9, marginBottom: 12 },
  disabled: { opacity: 0.55 }
});
