// Search-first home screen — dominant interaction is the query field.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { catalog, logout, search, type Catalog, type SearchHit } from "../src/api";

const EXAMPLES = [
  "watercraft liability limit",
  "cyber waiting period",
  "deductible options homeowners",
  "uninsured motorist",
];

export default function HomeScreen() {
  const router = useRouter();
  const [cat, setCat] = useState<Catalog | null>(null);
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<string | undefined>();
  const [state, setState] = useState<string | undefined>();
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [coverage, setCoverage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalog().then(setCat).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await search({ query, mode: "lexical", product_id: product, states: state ? [state] : undefined });
      setResults(res.results);
      setCoverage(`${res.coverage.documents_indexed}/${res.coverage.documents_in_scope} guides indexed · ${res.latency_ms} ms`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults(null);
    } finally {
      setBusy(false);
    }
  }, [query, product, state]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search or ask — e.g. watercraft limit"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.btn} onPress={runSearch} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Search</Text>}
        </Pressable>
      </View>

      <View style={styles.scopeRow}>
        <Text style={styles.scopeLabel}>Scope: all published guides</Text>
        {product || state ? (
          <Pressable onPress={() => { setProduct(undefined); setState(undefined); }}>
            <Text style={styles.clear}>clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {(cat?.products ?? []).map((p) => (
          <Pressable key={p.id} onPress={() => setProduct(product === p.id ? undefined : p.id)} style={[styles.chip, product === p.id && styles.chipOn]}>
            <Text style={[styles.chipText, product === p.id && styles.chipTextOn]}>{p.family}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {(cat?.states ?? []).map((s) => (
          <Pressable key={s.code} onPress={() => setState(state === s.code ? undefined : s.code)} style={[styles.chip, state === s.code && styles.chipOn]}>
            <Text style={[styles.chipText, state === s.code && styles.chipTextOn]}>{s.code}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? <Text style={styles.err}>{error}</Text> : null}
      {coverage ? <Text style={styles.cov}>{coverage}</Text> : null}

      {results === null ? (
        <ScrollView style={styles.examples}>
          <Text style={styles.examplesTitle}>Try:</Text>
          {EXAMPLES.map((e) => (
            <Pressable key={e} onPress={() => setQuery(e)}>
              <Text style={styles.example}>“{e}”</Text>
            </Pressable>
          ))}
          <Link href="/library" style={styles.libLink}>Browse the full library →</Link>
          <Pressable onPress={async () => { await logout(); router.replace("/login"); }}>
            <Text style={styles.signout}>Sign out</Text>
          </Pressable>
        </ScrollView>
      ) : results.length === 0 ? (
        <Text style={styles.empty}>No matching passages. Gus is stumped — try different terms or widen the scope.</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(h) => h.chunk_id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/doc/${item.document_id}`)}>
              <Text style={styles.cardTitle}>
                {item.document_id} · E{item.edition_number} {!item.is_current ? "(prior)" : ""}
              </Text>
              <Text style={styles.cardMeta}>
                {item.section_title} · p.{item.page_start}
                {item.page_end !== item.page_start ? `–${item.page_end}` : ""}
              </Text>
              <Text style={styles.cardText} numberOfLines={3}>{item.text}</Text>
            </Pressable>
          )}
        />
      )}
      <Text style={styles.disc}>Synthetic demo content — not an insurance contract or coverage advice.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 8 },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, backgroundColor: "#fff", fontSize: 16 },
  btn: { backgroundColor: "#168F88", borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  scopeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scopeLabel: { color: "#53616A", fontSize: 12 },
  clear: { color: "#168F88", fontSize: 12 },
  chips: { flexGrow: 0 },
  chip: { borderWidth: 1, borderColor: "#168F88", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12, marginRight: 6, marginVertical: 2 },
  chipOn: { backgroundColor: "#168F88" },
  chipText: { color: "#168F88", fontSize: 12 },
  chipTextOn: { color: "#fff" },
  err: { color: "#B91C1C" },
  cov: { color: "#53616A", fontSize: 11 },
  examples: { marginTop: 16 },
  examplesTitle: { fontWeight: "700", marginBottom: 8, color: "#172B3A" },
  example: { color: "#168F88", marginBottom: 6 },
  libLink: { marginTop: 24, color: "#172B3A", fontWeight: "600" },
  signout: { marginTop: 24, color: "#9ca3af" },
  empty: { color: "#53616A", marginTop: 24, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginVertical: 5, borderWidth: 1, borderColor: "#e5e1d5" },
  cardTitle: { fontWeight: "700", color: "#172B3A" },
  cardMeta: { color: "#168F88", fontSize: 12, marginVertical: 2 },
  cardText: { color: "#374151", fontSize: 13 },
  disc: { color: "#9ca3af", fontSize: 10, textAlign: "center", marginTop: 8 },
});
