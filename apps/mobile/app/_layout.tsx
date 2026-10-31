// Silly Goose Mutual — root layout + demo-gate session guard.
// Synthetic demo content — not an insurance contract or coverage advice.
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { sessionInfo } from "../src/api";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    sessionInfo()
      .then((s) => setAuthed(!s.gate_enabled || s.authenticated))
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inLogin = segments[0] === "login";
    if (!authed && !inLogin) router.replace("/login");
  }, [ready, authed, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172B3A" },
        headerTintColor: "#F8F5EC",
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: "#F8F5EC" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Silly Goose Mutual" }} />
      <Stack.Screen name="login" options={{ title: "Sign in", headerBackVisible: false }} />
      <Stack.Screen name="library" options={{ title: "Library" }} />
      <Stack.Screen name="doc/[id]" options={{ title: "Guide" }} />
    </Stack>
  );
}
