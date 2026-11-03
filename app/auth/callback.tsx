import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your email link…");

  useEffect(() => {
    let active = true;
    async function complete(url: string | null) {
      if (!url || !supabase) {
        if (active) setMessage("The confirmation link could not be opened. Return to Kimeza Play and sign in.");
        return;
      }
      try {
        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
        const tokenHash = typeof parsed.queryParams?.token_hash === "string" ? parsed.queryParams.token_hash : null;
        const type = typeof parsed.queryParams?.type === "string" ? parsed.queryParams.type : "signup";
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "signup" | "email" });
          if (error) throw error;
        } else {
          throw new Error("This confirmation link is incomplete or has expired.");
        }
        if (active) {
          setMessage("Email confirmed. Opening your member dashboard…");
          router.replace("/dashboard");
        }
      } catch (e) {
        if (active) setMessage(e instanceof Error ? e.message : "We could not verify this link. Please request a new one.");
      }
    }
    Linking.getInitialURL().then(complete);
    const sub = Linking.addEventListener("url", ({ url }) => complete(url));
    return () => { active = false; sub.remove(); };
  }, [router]);

  return <View style={styles.page}><ActivityIndicator color="#176B45" /><Text style={styles.text}>{message}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7F3", alignItems: "center", justifyContent: "center", padding: 28 },
  text: { color: "#153B30", textAlign: "center", lineHeight: 22, marginTop: 18 }
});
