import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../src/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type Mode = "register" | "login" | "forgot";

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function clearFeedback() { setMessage(""); setError(""); }

  async function signInWithGoogle() {
    clearFeedback();
    if (!supabase) { setError("Account services are not configured yet."); return; }
    setBusy(true);
    try {
      const redirectTo = Linking.createURL("/auth/callback");
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true }
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error("Google sign-in could not be started.");
      if (Platform.OS === "web") {
        window.location.assign(data.url);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success" || !result.url) {
        if (result.type === "cancel" || result.type === "dismiss") return;
        throw new Error("Google sign-in was not completed. Please try again.");
      }
      const callback = new URL(result.url);
      const code = callback.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
      } else {
        const hash = new URLSearchParams(callback.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (!access_token || !refresh_token) throw new Error("Google returned without a valid sign-in session.");
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        if (sessionError) throw sessionError;
      }
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
        const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: Linking.createURL("/auth/reset-password")
        });
        if (e) throw e;
        setMessage("If an account exists for that email, password reset instructions will be sent.");
      } else if (mode === "login") {
        const { error: e } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (e) throw e;
        router.replace("/dashboard");
      } else {
        const { data, error: e } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: "kimezaplay://auth/callback"
          }
        });
        if (e) throw e;
        if (data.session) router.replace("/dashboard");
        else setMessage("Registration received. Check your email for the confirmation link before signing in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets>
        <View style={styles.card}>
          <Link href="/" style={styles.back}>‹  Back to Kimeza Play</Link>
          <Text style={styles.eyebrow}>YOUR FELLOWSHIP, CONNECTED</Text>
          <Text style={styles.title}>{mode === "register" ? "Create your account" : mode === "login" ? "Welcome back" : "Reset your password"}</Text>
          <Text style={styles.subtitle}>Sign in with Google or use your email and password. Phone verification will be added at a later stage.</Text>
          {mode !== "forgot" && <>
            <Pressable disabled={busy} onPress={signInWithGoogle} style={[styles.googleButton, busy && styles.disabled]}>
              <Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>
            <View style={styles.separator}><View style={styles.line} /><Text style={styles.orText}>OR CONTINUE WITH EMAIL</Text><View style={styles.line} /></View>
            <View style={styles.modeRow}>
              <Pressable onPress={() => { setMode("register"); clearFeedback(); }}><Text style={[styles.modeText, mode === "register" && styles.modeActive]}>Create account</Text></Pressable>
              <Pressable onPress={() => { setMode("login"); clearFeedback(); }}><Text style={[styles.modeText, mode === "login" && styles.modeActive]}>Sign in</Text></Pressable>
            </View>
          </>}
          {mode === "register" && <TextInput value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor="#8A9891" style={styles.input} autoCapitalize="words" />}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#8A9891" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          {mode !== "forgot" && <View style={styles.passwordRow}><TextInput value={password} onChangeText={setPassword} placeholder="Password (at least 8 characters)" placeholderTextColor="#8A9891" style={styles.passwordInput} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete={mode === "register" ? "new-password" : "current-password"} textContentType={mode === "register" ? "newPassword" : "password"} returnKeyType="done" /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword(value => !value)} hitSlop={10} style={styles.showPassword}><Text style={styles.showPasswordText}>{showPassword ? "Hide" : "Show"}</Text></Pressable></View>}
          {mode === "login" && <Pressable onPress={() => { setMode("forgot"); clearFeedback(); }}><Text style={styles.forgot}>Forgot your password?</Text></Pressable>}
          {mode === "forgot" && <Pressable onPress={() => { setMode("login"); clearFeedback(); }}><Text style={styles.forgot}>Back to sign in</Text></Pressable>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Pressable disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{mode === "register" ? "Create account" : mode === "login" ? "Sign in" : "Send reset email"}</Text>}
          </Pressable>
          <Text style={styles.hint}>Google sign-in must also be enabled in your Supabase Authentication provider settings.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { flexGrow: 1, backgroundColor: "#F4F7F3", justifyContent: "center", padding: 20, paddingVertical: 28 },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E2E9E3" },
  back: { color: "#557168", fontWeight: "700", marginBottom: 28 }, eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 28, fontWeight: "900", marginTop: 10 }, subtitle: { color: "#66756D", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 12, padding: 14, backgroundColor: "#FFFFFF" },
  googleMark: { color: "#4285F4", fontSize: 20, fontWeight: "900" }, googleText: { color: "#18352C", fontWeight: "800", fontSize: 15 },
  separator: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 }, line: { flex: 1, height: 1, backgroundColor: "#E2E9E3" },
  orText: { color: "#87948D", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  modeRow: { flexDirection: "row", gap: 24, marginBottom: 18 }, modeText: { color: "#89958E", fontWeight: "700", paddingBottom: 7 },
  modeActive: { color: "#153B30", borderBottomWidth: 2, borderBottomColor: "#D69A36" },
  input: { borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: "#18352C", marginBottom: 12, fontSize: 15 },
  passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 12, marginBottom: 12, backgroundColor: "#FFFFFF" },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, color: "#18352C", fontSize: 15, minWidth: 0 },
  showPassword: { paddingHorizontal: 14, paddingVertical: 12 }, showPasswordText: { color: "#176B45", fontWeight: "800", fontSize: 13 },
  forgot: { color: "#176B45", fontWeight: "700", marginBottom: 12 }, button: { backgroundColor: "#153B30", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  pressed: { opacity: 0.85 }, disabled: { opacity: 0.6 }, buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 10, borderRadius: 9, marginBottom: 8, lineHeight: 19 },
  message: { color: "#176B45", backgroundColor: "#ECFDF3", padding: 10, borderRadius: 9, marginBottom: 8, lineHeight: 19 },
  hint: { color: "#87948D", fontSize: 11, lineHeight: 17, marginTop: 18 }
});
