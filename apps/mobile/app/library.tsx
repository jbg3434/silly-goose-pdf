// Library browse — filtered, paginated document list.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { documents, type DocumentRow } from "../src/api";

export default function LibraryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    try {
      const res = await documents({ page: String(p), edition: "all" });
      setRows((prev) => (p === 1 ? res.documents : [...prev, ...res.documents]));
      setTotal(res.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.count}>{total} guides</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(d) => d.document_id}
        onEndReached={() => !busy && rows.length < total && load(page + 1)}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/doc/${item.document_id}`)}>
            <Text style={styles.title}>{item.display_name}</Text>
            <Text style={styles.meta}>
              {item.state_name} ({item.state}) · Edition {item.edition_number} · {item.publication_state}
            </Text>
            <Text style={styles.meta2}>
              {item.page_count ?? "?"} pages · index: {item.index_state ?? "—"}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={busy ? <ActivityIndicator style={{ margin: 12 }} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12 },
  count: { color: "#53616A", marginBottom: 8 },
  err: { color: "#B91C1C" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginVertical: 4, borderWidth: 1, borderColor: "#e5e1d5" },
  title: { fontWeight: "700", color: "#172B3A" },
  meta: { color: "#168F88", fontSize: 12, marginTop: 2 },
  meta2: { color: "#53616A", fontSize: 11 },
});
