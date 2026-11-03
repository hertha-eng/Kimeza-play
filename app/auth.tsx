import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Mode = "register" | "login" | "forgot";

export default function AuthScreen() {\n  const router = useRouter();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function clearFeedback() { setMessage(""); setError(""); }

  async function submit() {
    clearFeedback();
    if (!supabase) { setError("Account services are not configured yet. Please try again later."); return; }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) { setError("Enter your email address."); return; }
    if (mode !== "forgot" && password.length < 8) { setError("Your password must contain at least 8 characters."); return; }
    if (mode === "register" && !name.trim()) { setError("Enter your full name."); return; }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (e) throw e;
        setMessage("If an account exists for that email, password reset instructions will be sent.");
      } else if (mode === "login") {
        const { error: e } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (e) throw e;
        setMessage("You are signed in successfully.");\n        router.replace("/");
      } else {
        const { data, error: e } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim() } }
        });
        if (e) throw e;
        setMessage(data.session
          ? "Your account has been created and you are signed in."
          : "Registration received. Check your email for the confirmation link before signing in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Link href="/" style={styles.back}>‹  Back to Kimeza Play</Link>
          <Text style={styles.eyebrow}>YOUR FELLOWSHIP, CONNECTED</Text>
          <Text style={styles.title}>{mode === "register" ? "Create your account" : mode === "login" ? "Welcome back" : "Reset your password"}</Text>
          <Text style={styles.subtitle}>For now, Kimeza Play account access uses email and password. Phone registration will be added later.</Text>
          <View style={styles.modeRow}>
            <Pressable onPress={() => { setMode("register"); clearFeedback(); }}><Text style={[styles.modeText, mode === "register" && styles.modeActive]}>Create account</Text></Pressable>
            <Pressable onPress={() => { setMode("login"); clearFeedback(); }}><Text style={[styles.modeText, mode === "login" && styles.modeActive]}>Sign in</Text></Pressable>
          </View>
          {mode === "register" && <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor="#8A9891" style={styles.input} autoCapitalize="words" />}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#8A9891" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          {mode !== "forgot" && <TextInput value={password} onChangeText={setPassword} placeholder="Password (at least 8 characters)" placeholderTextColor="#8A9891" style={styles.input} secureTextEntry autoCapitalize="none" />}
          {mode === "login" && <Pressable onPress={() => { setMode("forgot"); clearFeedback(); }}><Text style={styles.forgot}>Forgot your password?</Text></Pressable>}
          {mode === "forgot" && <Pressable onPress={() => { setMode("login"); clearFeedback(); }}><Text style={styles.forgot}>Back to sign in</Text></Pressable>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Pressable disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{mode === "register" ? "Create account" : mode === "login" ? "Sign in" : "Send reset email"}</Text>}
          </Pressable>
          <Text style={styles.hint}>Email verification and password reset delivery depend on the email settings configured in Supabase.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { flexGrow: 1, backgroundColor: "#F4F7F3", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E2E9E3" },
  back: { color: "#557168", fontWeight: "700", marginBottom: 28 }, eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 28, fontWeight: "900", marginTop: 10 }, subtitle: { color: "#66756D", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  modeRow: { flexDirection: "row", gap: 24, marginBottom: 18 }, modeText: { color: "#89958E", fontWeight: "700", paddingBottom: 7 },
  modeActive: { color: "#153B30", borderBottomWidth: 2, borderBottomColor: "#D69A36" },
  input: { borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: "#18352C", marginBottom: 12, fontSize: 15 },
  forgot: { color: "#176B45", fontWeight: "700", marginBottom: 12 }, button: { backgroundColor: "#153B30", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  pressed: { opacity: 0.85 }, disabled: { opacity: 0.6 }, buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 10, borderRadius: 9, marginBottom: 8, lineHeight: 19 },
  message: { color: "#176B45", backgroundColor: "#ECFDF3", padding: 10, borderRadius: 9, marginBottom: 8, lineHeight: 19 },
  hint: { color: "#87948D", fontSize: 11, lineHeight: 17, marginTop: 18 }
});
