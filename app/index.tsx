import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

const features = [
  { title: "Play", detail: "Enjoy friendly games with members across clubs." },
  { title: "Connect", detail: "Build Buddy Groups and strengthen fellowship." },
  { title: "Compete", detail: "Take part in individual, club, zone and district competitions." }
];

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>ROTARY • ROTARACT • FELLOWSHIP</Text>
        <Text style={styles.logo}>KIMEZA <Text style={styles.logoAccent}>PLAY</Text></Text>
        <Text style={styles.tagline}>Bring the fellowship to life.</Text>
        <Text style={styles.intro}>
          A shared space for Rotary and Rotaract members to play, connect and
          celebrate friendly competition — wherever they are.
        </Text>

        <View style={[styles.cards, wide && styles.cardsWide]}>
          {features.map((feature, index) => (
            <View key={feature.title} style={styles.card}>
              <Text style={styles.number}>0{index + 1}</Text>
              <Text style={styles.cardTitle}>{feature.title}</Text>
              <Text style={styles.cardText}>{feature.detail}</Text>
            </View>
          ))}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Your fellowship, connected.</Text>
          <Text style={styles.noticeText}>
            Kimeza Play is being built for phones, tablets and the web using
            one account and one shared platform.
          </Text>
        </View>
        <Text style={styles.footer}>A platform for Rotary and Rotaract clubs.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: "#F5F7F4", padding: 22, justifyContent: "center" },
  shell: { width: "100%", maxWidth: 1080, alignSelf: "center", paddingVertical: 36 },
  eyebrow: { color: "#547267", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  logo: { color: "#102A24", fontSize: 42, fontWeight: "900", letterSpacing: -1.5, marginTop: 22 },
  logoAccent: { color: "#D69A36" },
  tagline: { color: "#102A24", fontSize: 25, fontWeight: "700", marginTop: 8 },
  intro: { color: "#53645D", fontSize: 16, lineHeight: 25, maxWidth: 650, marginTop: 14 },
  cards: { marginTop: 34, gap: 14 },
  cardsWide: { flexDirection: "row" },
  card: { flex: 1, minHeight: 150, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 20, borderWidth: 1, borderColor: "#E2E9E3" },
  number: { color: "#C18A2E", fontWeight: "800", fontSize: 12 },
  cardTitle: { color: "#102A24", fontWeight: "800", fontSize: 20, marginTop: 14 },
  cardText: { color: "#64736C", lineHeight: 21, marginTop: 7 },
  notice: { backgroundColor: "#102A24", borderRadius: 18, padding: 22, marginTop: 22 },
  noticeTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  noticeText: { color: "#D6E2DA", lineHeight: 22, marginTop: 8 },
  footer: { color: "#7A8981", fontSize: 12, marginTop: 30 }
});