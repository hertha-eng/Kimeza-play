import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type GameResult = "win" | "loss" | "draw";
type HistoryEntry = {
  match_id: string;
  game_code: string;
  game_name: string;
  title: string | null;
  created_at: string;
  ended_at: string | null;
  result: GameResult;
  points: number;
  score_type: string | null;
  representation: string;
  represented_entity_id: string | null;
  destination_scope: string | null;
  opponents: { display_name: string }[];
  details: {
    words: unknown[];
    final_counts: Record<string, number>;
    end_reason: string | null;
    completed_at: string | null;
  };
};

type ResultFilter = "all" | GameResult;

const representationLabels: Record<string, string> = {
  none: "Casual play",
  individual: "Individual",
  buddy_group: "Buddy Group",
  club: "Club",
  zone: "Zone",
  district: "District",
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GameHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [gameFilter, setGameFilter] = useState("all");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!supabase) {
      setError("Account services are not configured.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) {
      router.replace("/auth");
      return;
    }

    const { data, error: historyError } = await (supabase as any).rpc("get_my_game_history");
    if (historyError) {
      setError(historyError.message || "We could not load your game history.");
      setHistory([]);
    } else {
      setHistory(Array.isArray(data) ? (data as HistoryEntry[]) : []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredHistory = useMemo(() => history.filter(entry => {
    const matchesGame = gameFilter === "all" || entry.game_code === gameFilter;
    const matchesResult = resultFilter === "all" || entry.result === resultFilter;
    return matchesGame && matchesResult;
  }), [history, gameFilter, resultFilter]);

  const counts = useMemo(() => ({
    wins: history.filter(item => item.result === "win").length,
    losses: history.filter(item => item.result === "loss").length,
    draws: history.filter(item => item.result === "draw").length,
    points: history.reduce((total, item) => total + (item.points || 0), 0),
  }), [history]);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <View style={s.shell}>
        <Link href="/dashboard" style={s.back}>‹  Back to dashboard</Link>
        <Text style={s.eyebrow}>KIMEZA PLAY • YOUR RECORD</Text>
        <Text style={s.title}>My Game History</Text>
        <Text style={s.subtitle}>A personal record of your completed games, results and points. Your history stays with your account.</Text>

        {loading ? (
          <View style={s.loading}><ActivityIndicator size="large" color="#176B45" /><Text style={s.muted}>Loading your completed games…</Text></View>
        ) : (
          <>
            {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text><Pressable onPress={loadHistory} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable></View>}

            <View style={s.stats}>
              <View style={s.stat}><Text style={s.statValue}>{history.length}</Text><Text style={s.statLabel}>MATCHES</Text></View>
              <View style={s.stat}><Text style={s.statValue}>{counts.wins}</Text><Text style={s.statLabel}>WINS</Text></View>
              <View style={s.stat}><Text style={s.statValue}>{counts.draws}</Text><Text style={s.statLabel}>DRAWS</Text></View>
              <View style={s.stat}><Text style={s.statValue}>{counts.points}</Text><Text style={s.statLabel}>POINTS</Text></View>
            </View>

            <Text style={s.filterHeading}>Filter your history</Text>
            <Text style={s.filterLabel}>GAME</Text>
            <View style={s.chips}>
              {[{ label: "All games", value: "all" }, { label: "Word Play", value: "word_chain" }].map(option => (
                <Pressable key={option.value} onPress={() => setGameFilter(option.value)} style={[s.chip, gameFilter === option.value && s.chipActive]}>
                  <Text style={[s.chipText, gameFilter === option.value && s.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.filterLabel}>RESULT</Text>
            <View style={s.chips}>
              {([{ label: "All", value: "all" }, { label: "Wins", value: "win" }, { label: "Draws", value: "draw" }, { label: "Losses", value: "loss" }] as const).map(option => (
                <Pressable key={option.value} onPress={() => setResultFilter(option.value)} style={[s.chip, resultFilter === option.value && s.chipActive]}>
                  <Text style={[s.chipText, resultFilter === option.value && s.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.listHeading}>
              <Text style={s.sectionTitle}>Completed matches</Text>
              <Text style={s.muted}>{filteredHistory.length} {filteredHistory.length === 1 ? "match" : "matches"}</Text>
            </View>

            {filteredHistory.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>{history.length === 0 ? "No completed games yet" : "No matches for this filter"}</Text>
                <Text style={s.emptyText}>{history.length === 0 ? "When you finish a Word Play match, it will appear here with its result and points." : "Try selecting a different result or game."}</Text>
                {history.length === 0 && <Pressable onPress={() => router.push("/games")} style={s.playButton}><Text style={s.playButtonText}>Explore games</Text></Pressable>}
              </View>
            ) : filteredHistory.map(entry => {
              const expanded = expandedMatch === entry.match_id;
              const resultLabel = entry.result === "win" ? "Victory" : entry.result === "loss" ? "Defeat" : "Draw";
              return (
                <View key={entry.match_id} style={s.matchCard}>
                  <Pressable onPress={() => setExpandedMatch(expanded ? null : entry.match_id)} style={s.matchTop}>
                    <View style={s.matchMain}>
                      <View style={s.matchTitleRow}>
                        <Text style={s.gameName}>{entry.game_name || "Word Play"}</Text>
                        <View style={[s.resultBadge, entry.result === "win" ? s.winBadge : entry.result === "loss" ? s.lossBadge : s.drawBadge]}>
                          <Text style={[s.resultText, entry.result === "win" ? s.winText : entry.result === "loss" ? s.lossText : s.drawText]}>{resultLabel}</Text>
                        </View>
                      </View>
                      <Text style={s.opponent}>vs. {entry.opponents?.length ? entry.opponents.map(person => person.display_name).join(", ") : "Fellow member"}</Text>
                      <Text style={s.date}>{formatDate(entry.ended_at || entry.created_at)}</Text>
                    </View>
                    <View style={s.pointsBlock}><Text style={s.pointsValue}>{entry.points > 0 ? "+" : ""}{entry.points}</Text><Text style={s.pointsLabel}>POINTS</Text></View>
                  </Pressable>
                  <View style={s.metaRow}>
                    <Text style={s.metaText}>{representationLabels[entry.representation] || "Casual play"}</Text>
                    <Text style={s.detailsToggle}>{expanded ? "Hide details －" : "View details ＋"}</Text>
                  </View>
                  {expanded && (
                    <View style={s.details}>
                      <Text style={s.detailHeading}>Match details</Text>
                      <Text style={s.detailText}>Game: {entry.game_name || "Word Play"}</Text>
                      <Text style={s.detailText}>Result: {resultLabel}</Text>
                      <Text style={s.detailText}>Representation: {representationLabels[entry.representation] || "Casual play"}</Text>
                      <Text style={s.detailText}>Points earned: {entry.points}</Text>
                      {entry.details?.words?.length > 0 && (
                        <>
                          <Text style={s.detailSubheading}>Words played</Text>
                          {entry.details.words.map((word: any, index: number) => (
                            <Text key={index} style={s.detailText}>{typeof word === "string" ? word : word?.word || word?.text || JSON.stringify(word)}</Text>
                          ))}
                        </>
                      )}
                      {!!entry.details?.end_reason && <Text style={s.detailText}>How it ended: {entry.details.end_reason.replace(/_/g, " ")}</Text>}
                    </View>
                  )}
                </View>
              );
            })}
            <Pressable onPress={loadHistory} style={s.refresh}><Text style={s.refreshText}>Refresh history</Text></Pressable>
          </>
        )}
        <Link href="/dashboard" style={s.home}>Back to dashboard</Link>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: "#F4F7F3", padding: 18 },
  shell: { width: "100%", maxWidth: 850, alignSelf: "center", paddingVertical: 20 },
  back: { color: "#557168", fontWeight: "700", marginBottom: 24 },
  eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 31, fontWeight: "900", marginTop: 7 },
  subtitle: { color: "#66756D", lineHeight: 22, marginTop: 8, marginBottom: 20, maxWidth: 680 },
  loading: { padding: 35, alignItems: "center", gap: 12 },
  muted: { color: "#718078", fontSize: 11 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 22 },
  stat: { flex: 1, minWidth: 72, backgroundColor: "#FFFFFF", borderRadius: 13, borderWidth: 1, borderColor: "#E2E9E3", padding: 13 },
  statValue: { color: "#153B30", fontSize: 23, fontWeight: "900" },
  statLabel: { color: "#718078", marginTop: 4, fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  filterHeading: { color: "#153B30", fontSize: 17, fontWeight: "900", marginBottom: 12 },
  filterLabel: { color: "#718078", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginBottom: 7 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 13 },
  chip: { borderWidth: 1, borderColor: "#DCE5DE", backgroundColor: "#FFFFFF", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12 },
  chipActive: { backgroundColor: "#153B30", borderColor: "#153B30" },
  chipText: { color: "#36564A", fontSize: 11, fontWeight: "800" },
  chipTextActive: { color: "#FFFFFF" },
  listHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 10 },
  sectionTitle: { color: "#153B30", fontSize: 19, fontWeight: "900" },
  matchCard: { backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#E2E9E3", padding: 15, marginBottom: 10 },
  matchTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  matchMain: { flex: 1 },
  matchTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  gameName: { color: "#153B30", fontSize: 15, fontWeight: "900" },
  resultBadge: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 9 },
  winBadge: { backgroundColor: "#E7F4EA" },
  lossBadge: { backgroundColor: "#FCEDEC" },
  drawBadge: { backgroundColor: "#F3F1EC" },
  resultText: { fontSize: 9, fontWeight: "900" },
  winText: { color: "#176B45" },
  lossText: { color: "#B42318" },
  drawText: { color: "#8A6A36" },
  opponent: { color: "#405C50", fontSize: 12, marginTop: 7, fontWeight: "700" },
  date: { color: "#718078", fontSize: 10, marginTop: 5 },
  pointsBlock: { minWidth: 58, alignItems: "flex-end" },
  pointsValue: { color: "#176B45", fontSize: 21, fontWeight: "900" },
  pointsLabel: { color: "#718078", fontSize: 8, fontWeight: "900", letterSpacing: 0.7, marginTop: 2 },
  metaRow: { borderTopWidth: 1, borderTopColor: "#EEF1EE", marginTop: 13, paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  metaText: { color: "#718078", fontSize: 10, fontWeight: "700" },
  detailsToggle: { color: "#176B45", fontSize: 10, fontWeight: "900" },
  details: { backgroundColor: "#F7F9F6", borderRadius: 10, padding: 12, marginTop: 12 },
  detailHeading: { color: "#153B30", fontSize: 12, fontWeight: "900", marginBottom: 6 },
  detailSubheading: { color: "#153B30", fontSize: 11, fontWeight: "900", marginTop: 9, marginBottom: 3 },
  detailText: { color: "#5D6E64", fontSize: 11, lineHeight: 18 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 15, padding: 23, alignItems: "center", borderWidth: 1, borderColor: "#E2E9E3" },
  emptyTitle: { color: "#153B30", fontWeight: "900", fontSize: 16, textAlign: "center" },
  emptyText: { color: "#68776F", marginTop: 7, fontSize: 12, lineHeight: 19, textAlign: "center" },
  playButton: { backgroundColor: "#153B30", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, marginTop: 15 },
  playButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 11 },
  errorBox: { backgroundColor: "#FEF3F2", borderRadius: 10, padding: 13, marginBottom: 14 },
  errorText: { color: "#B42318", fontSize: 12 },
  retry: { alignSelf: "flex-start", marginTop: 9 },
  retryText: { color: "#176B45", fontWeight: "900", fontSize: 11 },
  refresh: { backgroundColor: "#153B30", borderRadius: 11, padding: 13, alignItems: "center", marginTop: 16 },
  refreshText: { color: "#FFFFFF", fontWeight: "800" },
  home: { color: "#557168", textAlign: "center", marginTop: 22, fontWeight: "700" },
});
