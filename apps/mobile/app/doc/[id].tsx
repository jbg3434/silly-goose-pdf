// Guide detail: metadata, lineage, artifact links, in-app source PDF.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Pdf from "react-native-pdf";
import { documentDetail, getSession, pdfUrl, type DocumentDetail } from "../../src/api";

export default function DocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfSource, setPdfSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    documentDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [id]);

  const pdfArtifact = detail?.artifacts.find((a) => a.format === "pdf");

  async function openPdf() {
    const headers: Record<string, string> = {};
    const token = await getSession();
    if (token) headers.Cookie = `sgm_auth=${token}`;
    setPdfSource({ uri: pdfUrl(pdfArtifact!.artifact_id), headers });
    setShowPdf(true);
  }

  if (error) return <Text style={styles.err}>{error}</Text>;
  if (!detail) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const d = detail.document;
  if (showPdf && pdfSource) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable style={styles.backBtn} onPress={() => setShowPdf(false)}>
          <Text style={styles.backText}>‹ Back to guide</Text>
        </Pressable>
        <Pdf
          source={pdfSource}
          style={{ flex: 1 }}
          onError={(e) => setError(`PDF error: ${String(e)}`)}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.title}>{d.display_name}</Text>
      <Text style={styles.meta}>
        {d.state_name} ({d.state}) · Edition {d.edition_number} · {d.effective_date}
      </Text>
      <View style={styles.badge}><Text style={styles.badgeText}>Synthetic</Text></View>

      {pdfArtifact ? (
        <Pressable style={styles.pdfBtn} onPress={openPdf}>
          <Text style={styles.pdfBtnText}>View source PDF</Text>
        </Pressable>
      ) : null}

      <Text style={styles.h}>Versions</Text>
      {detail.lineage.map((e) => (
        <Text key={e.document_id} style={styles.row}>
          Edition {e.edition_number} {e.document_id === d.document_id ? "· this guide" : ""}
        </Text>
      ))}

      <Text style={styles.h}>Approvals (simulated DOI workflow)</Text>
      {detail.approvals.map((a, i) => (
        <Text key={i} style={styles.row}>
          {a.stage} — {a.actor} ({a.timestamp})
        </Text>
      ))}

      <Text style={styles.h}>State differences</Text>
      {detail.differences.slice(0, 20).map((f, i) => (
        <Text key={i} style={styles.row}>
          {f.topic}: {f.replacement_value ?? f.baseline}
        </Text>
      ))}

      <Text style={styles.disc}>Synthetic demo content — not an insurance contract or coverage advice.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#172B3A" },
  meta: { color: "#168F88", marginTop: 4 },
  badge: { alignSelf: "flex-start", backgroundColor: "#E7A63B", borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginTop: 8 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#172B3A" },
  pdfBtn: { backgroundColor: "#168F88", borderRadius: 8, padding: 12, marginTop: 12, alignItems: "center" },
  pdfBtnText: { color: "#fff", fontWeight: "700" },
  h: { fontWeight: "700", color: "#172B3A", marginTop: 20, marginBottom: 6 },
  row: { color: "#374151", fontSize: 13, marginBottom: 3 },
  err: { color: "#B91C1C", padding: 20 },
  backBtn: { padding: 10, backgroundColor: "#172B3A" },
  backText: { color: "#F8F5EC", fontWeight: "600" },
  disc: { color: "#9ca3af", fontSize: 10, marginTop: 24, marginBottom: 24, textAlign: "center" },
});
