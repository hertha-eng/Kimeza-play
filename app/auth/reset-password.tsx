import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function handleLink(url: string | null) {
      if (!url || !supabase) return;
      try {
        const parsed = Linking.parse(url);
        const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        if (active) setReady(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "This reset link could not be verified. Request a new one.");
      }
    }
    Linking.getInitialURL().then(handleLink);
    const subscription = Linking.addEventListener("url", ({ url }) => handleLink(url));
    const { data } = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) setReady(true);
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };
    return () => {
      active = false;
      subscription.remove();
      data.subscription.unsubscribe();
    };
  }, []);

  async function savePassword() {
    setError(""); setMessage("");
    if (!supabase) { setError("Account services are not configured."); return; }
    if (password.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else {
      setMessage("Your password has been updated. You can now sign in.");
      await supabase.auth.signOut();
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>KIMEZA PLAY ACCOUNT</Text>
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>Open this screen from the password reset email sent to your address.</Text>
        {!ready && !error ? <ActivityIndicator color="#176B45" /> : null}
        {ready && <>
          <TextInput value={password} onChangeText={setPassword} placeholder="New password (8+ characters)" secureTextEntry style={styles.input} />
          <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry style={styles.input} />
          <Pressable onPress={savePassword} disabled={busy} style={styles.button}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Update password</Text>}
          </Pressable>
        </>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!message && <Text style={styles.success}>{message}</Text>}
        <Pressable onPress={() => router.replace("/auth")}><Text style={styles.link}>Return to sign in</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F7F3", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 460, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 22, padding: 24, borderWidth: 1, borderColor: "#E2E9E3" },
  eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 26, fontWeight: "900", marginTop: 10 },
  subtitle: { color: "#66756D", lineHeight: 21, marginVertical: 16 },
  input: { borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 12, padding: 14, color: "#18352C", marginBottom: 12 },
  button: { backgroundColor: "#153B30", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 10, borderRadius: 9, marginTop: 12 },
  success: { color: "#176B45", backgroundColor: "#ECFDF3", padding: 10, borderRadius: 9, marginTop: 12 },
  link: { color: "#176B45", fontWeight: "700", marginTop: 18, textAlign: "center" }
});
