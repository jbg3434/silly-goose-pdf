import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { login } from "../src/api";

export default function LoginScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await login(password);
    setBusy(false);
    if (res.ok) router.replace("/");
    else setError(res.error === "invalid password" ? "Wrong password — try again." : res.error ?? "Login failed");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Silly Goose Mutual</Text>
      <Text style={styles.sub}>Enter the demo password to continue.</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        autoFocus
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />
      <Pressable style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Unlock</Text>}
      </Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Text style={styles.disc}>Synthetic demo content — not an insurance contract or coverage advice.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#172B3A" },
  sub: { color: "#53616A" },
  input: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, backgroundColor: "#fff" },
  btn: { backgroundColor: "#168F88", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, width: "100%", alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  err: { color: "#B91C1C" },
  disc: { color: "#9ca3af", fontSize: 11, marginTop: 16, textAlign: "center" },
});
