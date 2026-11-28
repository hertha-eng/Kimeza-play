import { useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { GAME_CATALOG, GAME_CATEGORIES, type GameCategory } from "../src/games/catalog";

export default function GamesLibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string }>();
  const [category, setCategory] = useState<GameCategory | "All games">("All games");
  const [search, setSearch] = useState("");

  // Keep existing room invitations and shared links working after the library is introduced.
  useEffect(() => {
    if (params.room) router.replace({ pathname: "/games/word-chain", params: { room: params.room } });
  }, [params.room, router]);

  const filteredGames = useMemo(() => {
    const term = search.trim().toLowerCase();
    return GAME_CATALOG.filter(game => {
      const matchesCategory = category === "All games" || game.category === category;
      const matchesSearch = !term || game.name.toLowerCase().includes(term) ||
        game.description.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const availableCount = GAME_CATALOG.filter(game => game.availability === "available").length;

  return <ScrollView contentContainerStyle={s.page}>
    <View style={s.shell}>
      <Link href="/dashboard" style={s.back}>‹  Back to dashboard</Link>
      <Text style={s.eyebrow}>KIMEZA PLAY • THE GAME COLLECTION</Text>
      <Text style={s.title}>Games Library</Text>
      <Text style={s.subtitle}>Choose a game, invite fellow members and enjoy some friendly competition. More games will be added over time.</Text>

      <Pressable onPress={() => router.push("/games/rooms")} style={s.roomHub}>
        <View style={s.roomHubCopy}>
          <Text style={s.roomHubTitle}>Universal Game Rooms</Text>
          <Text style={s.roomHubText}>Create a shared room, meet members, challenge players or watchers, and follow the queue.</Text>
        </View>
        <Text style={s.roomHubArrow}>OPEN  ›</Text>
      </Pressable>

      <View style={s.summary}>
        <View><Text style={s.summaryNumber}>{GAME_CATALOG.length}</Text><Text style={s.summaryLabel}>GAMES IN THE COLLECTION</Text></View>
        <View style={s.summaryDivider} />
        <View><Text style={s.summaryNumber}>{GAME_CATEGORIES.length}</Text><Text style={s.summaryLabel}>GAME CATEGORIES</Text></View>
        <View style={s.summaryDivider} />
        <View><Text style={s.summaryNumber}>{availableCount}</Text><Text style={s.summaryLabel}>READY TO PLAY</Text></View>
      </View>

      <TextInput value={search} onChangeText={setSearch} placeholder="Search games…" placeholderTextColor="#829087"
        autoCapitalize="none" style={s.search} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {(["All games", ...GAME_CATEGORIES] as const).map(item => {
          const selected = category === item;
          return <Pressable key={item} onPress={() => setCategory(item)} style={[s.filter, selected && s.filterActive]}>
            <Text style={[s.filterText, selected && s.filterTextActive]}>{item}</Text>
          </Pressable>;
        })}
      </ScrollView>

      <View style={s.resultsHead}>
        <Text style={s.sectionTitle}>{category === "All games" ? "Explore all games" : category}</Text>
        <Text style={s.resultCount}>{filteredGames.length} {filteredGames.length === 1 ? "game" : "games"}</Text>
      </View>

      {filteredGames.length === 0 ? <View style={s.empty}>
        <Text style={s.emptyTitle}>No games found</Text>
        <Text style={s.emptyText}>Try another search or choose a different category.</Text>
      </View> : filteredGames.map(game => {
        const playable = game.availability === "available" && !!game.route;
        return <Pressable key={game.id} disabled={!playable} onPress={() => game.route && router.push(game.route as any)}
          style={[s.gameCard, playable && s.gameCardAvailable, !playable && s.gameCardSoon]}>
          <View style={s.gameMain}>
            <View style={s.gameTitleRow}>
              <Text style={s.gameName}>{game.name}</Text>
              <View style={[s.status, playable ? s.statusAvailable : s.statusSoon]}>
                <Text style={[s.statusText, playable ? s.statusAvailableText : s.statusSoonText]}>
                  {playable ? "AVAILABLE" : "COMING SOON"}
                </Text>
              </View>
            </View>
            <Text style={s.gameCategory}>{game.category}</Text>
            <Text style={s.gameDescription}>{game.description}</Text>
          </View>
          {playable && <Text style={s.playArrow}>PLAY  ›</Text>}
        </Pressable>;
      })}

      <View style={s.footerNote}>
        <Text style={s.footerTitle}>The collection will keep growing</Text>
        <Text style={s.footerText}>New games can be added as Kimeza Play develops. Some games may share reliable gameplay systems where it makes sense, while keeping their own rules and feel.</Text>
      </View>
      <Link href="/dashboard" style={s.home}>Back to dashboard</Link>
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: "#F4F7F3", padding: 18 },
  shell: { width: "100%", maxWidth: 850, alignSelf: "center", paddingVertical: 20 },
  back: { color: "#557168", fontWeight: "700", marginBottom: 24 },
  eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 31, fontWeight: "900", marginTop: 7 },
  subtitle: { color: "#66756D", lineHeight: 22, marginTop: 8, marginBottom: 18, maxWidth: 680 },
  roomHub: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#9BC6A9", borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  roomHubCopy: { flex: 1 },
  roomHubTitle: { color: "#153B30", fontSize: 15, fontWeight: "900" },
  roomHubText: { color: "#68776F", fontSize: 11, lineHeight: 17, marginTop: 5 },
  roomHubArrow: { color: "#176B45", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#102A24", borderRadius: 16, padding: 16, marginBottom: 16 },
  summaryNumber: { color: "#E2B55F", fontSize: 24, fontWeight: "900", textAlign: "center" },
  summaryLabel: { color: "#D6E2DA", fontSize: 8, fontWeight: "900", letterSpacing: 0.7, textAlign: "center", marginTop: 4 },
  summaryDivider: { width: 1, height: 34, backgroundColor: "#456157" },
  search: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 11, padding: 14, color: "#18352C", marginBottom: 13 },
  filters: { gap: 8, paddingBottom: 8 },
  filter: { borderWidth: 1, borderColor: "#DCE5DE", backgroundColor: "#FFFFFF", borderRadius: 20, paddingVertical: 9, paddingHorizontal: 13 },
  filterActive: { backgroundColor: "#153B30", borderColor: "#153B30" },
  filterText: { color: "#36564A", fontSize: 11, fontWeight: "800" },
  filterTextActive: { color: "#FFFFFF" },
  resultsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 17, marginBottom: 10 },
  sectionTitle: { color: "#153B30", fontSize: 19, fontWeight: "900" },
  resultCount: { color: "#68776F", fontSize: 11, fontWeight: "700" },
  gameCard: { backgroundColor: "#FFFFFF", borderRadius: 14, borderWidth: 1, padding: 15, marginBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  gameCardAvailable: { borderColor: "#9BC6A9" },
  gameCardSoon: { borderColor: "#E2E9E3" },
  gameMain: { flex: 1 },
  gameTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  gameName: { color: "#153B30", fontSize: 15, fontWeight: "900", flexShrink: 1 },
  status: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 8 },
  statusAvailable: { backgroundColor: "#E7F4EA" },
  statusSoon: { backgroundColor: "#F3F1EC" },
  statusText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  statusAvailableText: { color: "#176B45" },
  statusSoonText: { color: "#8A6A36" },
  gameCategory: { color: "#B17B27", fontSize: 9, fontWeight: "900", letterSpacing: 0.7, marginTop: 7 },
  gameDescription: { color: "#68776F", fontSize: 12, lineHeight: 18, marginTop: 5 },
  playArrow: { color: "#176B45", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  empty: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 20, alignItems: "center" },
  emptyTitle: { color: "#153B30", fontWeight: "900", fontSize: 16 },
  emptyText: { color: "#68776F", marginTop: 6, fontSize: 12 },
  footerNote: { backgroundColor: "#EAF0EA", borderRadius: 14, padding: 16, marginTop: 18 },
  footerTitle: { color: "#153B30", fontWeight: "900" },
  footerText: { color: "#68776F", fontSize: 12, lineHeight: 19, marginTop: 5 },
  home: { color: "#557168", textAlign: "center", marginTop: 22, fontWeight: "700" },
});
