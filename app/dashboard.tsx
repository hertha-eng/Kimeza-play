import { useCallback, useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../src/lib/supabase";

type Profile = { display_name: string; avatar_url: string | null };
type Membership = { id: string; status: string; club_id: string };
type Club = { id: string; name: string; club_type: "rotary" | "rotaract"; status: string };

export default function DashboardScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!supabase) { setError("Account services are not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) { setSession(null); setLoading(false); router.replace("/auth"); return; }
    setSession(auth.session);
    const userId = auth.session.user.id;

    const [profileResult, membershipResult, scoreResult] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("club_memberships").select("id, status, club_id").eq("user_id", userId).in("status", ["active", "pending"]).limit(1).maybeSingle(),
      supabase.from("score_ledger").select("points").eq("player_id", userId)
    ]);
    if (profileResult.error) setError(profileResult.error.message);
    setProfile(profileResult.data);
    setMembership(membershipResult.data);
    if (membershipResult.data) {
      const clubResult = await supabase.from("clubs").select("id, name, club_type, status").eq("id", membershipResult.data.club_id).maybeSingle();
      setClub(clubResult.data);
    } else setClub(null);
    if (scoreResult.data) setPoints(scoreResult.data.reduce((sum, row) => sum + row.points, 0));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadDashboard();
    const { data } = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) router.replace("/auth");
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };
    return () => data.subscription.unsubscribe();
  }, [loadDashboard, router]);

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    router.replace("/");
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>KIMEZA PLAY</Text><Text style={styles.title}>Member dashboard</Text></View>
          <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
        </View>
        {loading ? <ActivityIndicator size="large" color="#176B45" /> : <>
          <View style={styles.welcome}>
            <Text style={styles.welcomeSmall}>WELCOME</Text>
            <Text style={styles.welcomeTitle}>{profile?.display_name || session?.user.email || "Member"}</Text>
            <Text style={styles.welcomeText}>Your place to play, connect and compete with Rotary and Rotaract members.</Text>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statValue}>{points}</Text><Text style={styles.statLabel}>Recorded points</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{membership ? "1" : "0"}</Text><Text style={styles.statLabel}>Club memberships</Text></View>
          </View>
          <Text style={styles.sectionTitle}>My club</Text>
          <View style={styles.panel}>
            {membership ? <>
              <Text style={styles.panelTitle}>{club?.name || "Club details loading"}</Text>
              <Text style={styles.panelText}>{club?.club_type === "rotaract" ? "Rotaract" : club?.club_type === "rotary" ? "Rotary" : "Club"} • Membership {membership.status}</Text>
              {club?.status !== "approved" && <Text style={styles.muted}>This club is awaiting platform approval.</Text>}
            </> : <>
              <Text style={styles.panelTitle}>No club membership yet</Text>
              <Text style={styles.panelText}>You can request to join an approved club or use a club invitation code when membership applications are enabled.</Text>
            </>}
          </View>
          <Text style={styles.sectionTitle}>Your Kimeza space</Text>
          <View style={styles.grid}>
            <View style={styles.feature}><Text style={styles.featureTitle}>Games</Text><Text style={styles.featureText}>Friendly game rooms and challenges are coming next.</Text><Text style={styles.coming}>COMING NEXT</Text></View>
            <View style={styles.feature}><Text style={styles.featureTitle}>Buddy Groups</Text><Text style={styles.featureText}>Create cross-club fellowship groups with friends.</Text><Text style={styles.coming}>COMING NEXT</Text></View>
            <View style={styles.feature}><Text style={styles.featureTitle}>Competitions</Text><Text style={styles.featureText}>Follow official club, zone and district events.</Text><Text style={styles.coming}>COMING NEXT</Text></View>
            <View style={styles.feature}><Text style={styles.featureTitle}>My profile</Text><Text style={styles.featureText}>Account: {session?.user.email}</Text><Text style={styles.coming}>PROFILE ACTIVE</Text></View>
          </View>
          <Pressable onPress={loadDashboard} style={styles.refresh}><Text style={styles.refreshText}>Refresh dashboard</Text></Pressable>
        </>}
        <Link href="/" style={styles.home}>Back to home</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: "#F4F7F3", padding: 20 },
  shell: { width: "100%", maxWidth: 1000, alignSelf: "center", paddingVertical: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 28, fontWeight: "900", marginTop: 5 },
  signOut: { borderWidth: 1, borderColor: "#C8D7CC", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 13 },
  signOutText: { color: "#153B30", fontWeight: "700" },
  welcome: { backgroundColor: "#102A24", borderRadius: 20, padding: 24 },
  welcomeSmall: { color: "#E2B55F", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  welcomeTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "900", marginTop: 8 },
  welcomeText: { color: "#D6E2DA", lineHeight: 22, marginTop: 8, maxWidth: 600 },
  stats: { flexDirection: "row", gap: 12, marginTop: 16 },
  stat: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E2E9E3", padding: 18 },
  statValue: { color: "#153B30", fontSize: 25, fontWeight: "900" },
  statLabel: { color: "#6B7A72", marginTop: 5, fontSize: 12 },
  sectionTitle: { color: "#153B30", fontSize: 19, fontWeight: "900", marginTop: 26, marginBottom: 10 },
  panel: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#E2E9E3" },
  panelTitle: { color: "#18352C", fontSize: 17, fontWeight: "800" },
  panelText: { color: "#64736C", lineHeight: 21, marginTop: 6 },
  muted: { color: "#A16D1D", marginTop: 8, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  feature: { width: "48%", flexGrow: 1, minWidth: 140, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E9E3" },
  featureTitle: { color: "#153B30", fontWeight: "900", fontSize: 16 },
  featureText: { color: "#68776F", lineHeight: 19, marginTop: 7, fontSize: 12 },
  coming: { color: "#B17B27", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 12 },
  refresh: { backgroundColor: "#153B30", borderRadius: 11, padding: 13, alignItems: "center", marginTop: 22 },
  refreshText: { color: "#FFFFFF", fontWeight: "800" },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 10, borderRadius: 9, marginTop: 14 },
  home: { color: "#557168", textAlign: "center", marginTop: 22, fontWeight: "700" }
});
