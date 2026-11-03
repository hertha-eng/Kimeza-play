import { useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { supabase } from "../src/lib/supabase";

type Method = "email" | "phone";
type Mode = "register" | "login";

export default function AuthScreen() {
  const [method, setMethod] = useState<Method>("email");
  const [mode, setMode] = useState<Mode>("register");
  const [displayName, setDisplayName] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const cleanIdentity = method === "email" ? identity.trim().toLowerCase() : identity.trim();

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  async function submit() {
    resetFeedback();
    if (!supabase) {
      setError("The app is not connected yet. Its private Supabase Publishable Key still needs to be configured.");
      return;
    }
    if (!cleanIdentity || !password) {
      setError(method === "email" ? "Enter your email address and password." : "Enter your phone number and password.");
      return;
    }
    if (method === "phone" && !/^\+[1-9]\d{7,14}$/.test(cleanIdentity)) {
      setError("Enter your phone number in international format, for example +2567XXXXXXXX.");
      return;
    }
    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }
    if (mode === "register" && !displayName.trim()) {
      setError("Enter the name you want members to see.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const credentials = method === "email"
          ? { email: cleanIdentity, password }
          : { phone: cleanIdentity, password };
        const { error: authError } = await supabase.auth.signInWithPassword(credentials);
        if (authError) throw authError;
        setMessage("You are signed in. Your Kimeza Play account is ready.");
        return;
      }

      const options = { data: { display_name: displayName.trim() } };
      const result = method === "email"
        ? await supabase.auth.signUp({ email: cleanIdentity, password, options })
        : await supabase.auth.signUp({ phone: cleanIdentity, password, options });
      if (result.error) throw result.error;

      if (result.data.session) {
        setMessage("Your account has been created and you are signed in.");
      } else {
        setAwaitingOtp(true);
        setMessage(method === "email"
          ? "We sent a confirmation code to your email. Enter it below to verify your account."
          : "We sent an SMS confirmation code to your phone. Enter it below to verify your account.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    resetFeedback();
    if (!supabase) return setError("Supabase is not configured yet.");
    if (otp.trim().length < 6) return setError("Enter the verification code you received.");
    setBusy(true);
    try {
      const result = method === "email"
        ? await supabase.auth.verifyOtp({ email: cleanIdentity, token: otp.trim(), type: "signup" })
        : await supabase.auth.verifyOtp({ phone: cleanIdentity, token: otp.trim(), type: "sms" });
      if (result.error) throw result.error;
      setAwaitingOtp(false);
      setMessage("Your account is verified. Welcome to Kimeza Play!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not verify that code.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    resetFeedback();
    if (!supabase) return setError("Supabase is not configured yet.");
    setBusy(true);
    try {
      const result = method === "email"
        ? await supabase.auth.resend({ type: "signup", email: cleanIdentity })
        : await supabase.auth.resend({ type: "sms", phone: cleanIdentity });
      if (result.error) throw result.error;
      setMessage("A new verification code has been sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Link href="/" style={styles.back}>‹  Back to Kimeza Play</Link>
          <Text style={styles.eyebrow}>YOUR FELLOWSHIP, CONNECTED</Text>
          <Text style={styles.title}>{mode === "register" ? "Create your account" : "Welcome back"}</Text>
          <Text style={styles.subtitle}>Use your email address or mobile number to access Kimeza Play.</Text>

          <View style={styles.switchRow}>
            <Pressable onPress={() => { setMethod("email"); setIdentity(""); setAwaitingOtp(false); resetFeedback(); }} style={[styles.switch, method === "email" && styles.switchActive]}>
              <Text style={[styles.switchText, method === "email" && styles.switchTextActive]}>Email</Text>
            </Pressable>
            <Pressable onPress={() => { setMethod("phone"); setIdentity(""); setAwaitingOtp(false); resetFeedback(); }} style={[styles.switch, method === "phone" && styles.switchActive]}>
              <Text style={[styles.switchText, method === "phone" && styles.switchTextActive]}>Phone</Text>
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            <Pressable onPress={() => { setMode("register"); setAwaitingOtp(false); resetFeedback(); }}>
              <Text style={[styles.modeText, mode === "register" && styles.modeActive]}>Create account</Text>
            </Pressable>
            <Pressable onPress={() => { setMode("login"); setAwaitingOtp(false); resetFeedback(); }}>
              <Text style={[styles.modeText, mode === "login" && styles.modeActive]}>Sign in</Text>
            </Pressable>
          </View>

          {mode === "register" && !awaitingOtp && (
            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Your full name" placeholderTextColor="#8A9891" style={styles.input} autoCapitalize="words" />
          )}
          {!awaitingOtp ? (
            <>
              <TextInput
                value={identity}
                onChangeText={setIdentity}
                placeholder={method === "email" ? "Email address" : "Phone number, e.g. +2567XXXXXXXX"}
                placeholderTextColor="#8A9891"
                style={styles.input}
                keyboardType={method === "email" ? "email-address" : "phone-pad"}
                autoCapitalize="none"
                autoComplete={method === "email" ? "email" : "tel"}
              />
              <TextInput value={password} onChangeText={setPassword} placeholder="Password (at least 8 characters)" placeholderTextColor="#8A9891" style={styles.input} secureTextEntry autoCapitalize="none" />
            </>
          ) : (
            <TextInput value={otp} onChangeText={setOtp} placeholder="6-digit verification code" placeholderTextColor="#8A9891" style={styles.input} keyboardType="number-pad" />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable disabled={busy} onPress={awaitingOtp ? verifyCode : submit} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{awaitingOtp ? "Verify account" : mode === "register" ? "Create account" : "Sign in"}</Text>}
          </Pressable>
          {awaitingOtp && <Pressable onPress={resendCode} disabled={busy}><Text style={styles.resend}>Resend verification code</Text></Pressable>}
          <Text style={styles.hint}>
            {method === "phone"
              ? "Use the full international number, including +256 for Uganda. SMS sign-up requires an SMS provider enabled by the project administrator."
              : "Email sign-up may require you to confirm your email before you can sign in."}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flexGrow: 1, backgroundColor: "#F4F7F3", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 480, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#E2E9E3" },
  back: { color: "#557168", fontWeight: "700", marginBottom: 28 },
  eyebrow: { color: "#B17B27", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: "#102A24", fontSize: 28, fontWeight: "900", marginTop: 10 },
  subtitle: { color: "#66756D", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  switchRow: { flexDirection: "row", backgroundColor: "#EFF3EF", borderRadius: 12, padding: 4, marginBottom: 18 },
  switch: { flex: 1, padding: 11, alignItems: "center", borderRadius: 9 },
  switchActive: { backgroundColor: "#FFFFFF", elevation: 2 },
  switchText: { color: "#68776F", fontWeight: "700" },
  switchTextActive: { color: "#153B30" },
  modeRow: { flexDirection: "row", gap: 24, marginBottom: 16 },
  modeText: { color: "#89958E", fontWeight: "700", paddingBottom: 7 },
  modeActive: { color: "#153B30", borderBottomWidth: 2, borderBottomColor: "#D69A36" },
  input: { borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: "#18352C", marginBottom: 12, fontSize: 15 },
  button: { backgroundColor: "#153B30", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 8 },
  buttonPressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  error: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 10, borderRadius: 9, marginBottom: 8, lineHeight: 19 },
  message: { color: "#176B45", backgroundColor: "#ECFDF3", padding: 10, borderRadius: 9, marginBottom: 8, lineHeight: 19 },
  resend: { color: "#176B45", textAlign: "center", fontWeight: "700", marginTop: 16 },
  hint: { color: "#87948D", fontSize: 11, lineHeight: 17, marginTop: 18 }
});
