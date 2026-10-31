// Guide detail: structured guide view (blocks), metadata, in-app source PDF.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Pdf from "react-native-pdf";
import {
  documentBlocks, documentDetail, getSession, pdfUrl,
  type DocumentDetail, type GuideBlock,
} from "../../src/api";

function pageRef(b: GuideBlock): string | null {
  if (b.page_start == null) return null;
  return b.page_end && b.page_end !== b.page_start ? `source p. ${b.page_start}–${b.page_end}` : `source p. ${b.page_start}`;
}

function Block({ b }: { b: GuideBlock }) {
  const c = b.content;
  if (b.kind === "heading") {
    return (
      <Text style={styles.heading}>
        {c.number ? `§${c.number} ` : ""}{c.title}
      </Text>
    );
  }
  if (b.kind === "table") {
    return (
      <View style={styles.table} key={b.block_id}>
        {c.caption ? <Text style={styles.tableCaption}>{c.caption}</Text> : null}
        <View style={[styles.trow, styles.thead]}>
          {(c.columns ?? []).map((col, i) => (
            <Text key={i} style={[styles.tcell, styles.theadText, i === 0 && styles.tcellFirst]}>{col}</Text>
          ))}
        </View>
        {(c.rows ?? []).map((row, ri) => (
          <View key={ri} style={styles.trow}>
            {row.map((cell, ci) => (
              <Text key={ci} style={[styles.tcell, ci === 0 && styles.tcellFirst]}>{cell}</Text>
            ))}
          </View>
        ))}
        {pageRef(b) ? <Text style={styles.src}>{pageRef(b)}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.termCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={styles.termTopic}>{c.topic}</Text>
        {c.overridden ? (
          <View style={styles.ovBadge}><Text style={styles.ovBadgeText}>State override</Text></View>
        ) : null}
      </View>
      {c.statement ? <Text style={styles.termStmt}>{c.statement}</Text> : null}
      {(c.footnotes ?? []).map((f, i) => (
        <Text key={i} style={styles.footnote}>{f}</Text>
      ))}
      {pageRef(b) ? <Text style={styles.src}>{pageRef(b)}</Text> : null}
    </View>
  );
}

export default function DocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [blocks, setBlocks] = useState<GuideBlock[] | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfSource, setPdfSource] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    documentDetail(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    documentBlocks(id)
      .then((r) => setBlocks(r.blocks))
      .catch(() => setBlocks([]));
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

      {blocks === null ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : blocks.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          {blocks.map((b) => <Block key={b.block_id} b={b} />)}
        </View>
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
  heading: { fontSize: 17, fontWeight: "700", color: "#172B3A", marginTop: 18, marginBottom: 6 },
  termCard: { backgroundColor: "#F8F5EC", borderRadius: 8, padding: 10, marginBottom: 8 },
  termTopic: { fontWeight: "700", color: "#172B3A", flexShrink: 1 },
  ovBadge: { backgroundColor: "#E7A63B", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  ovBadgeText: { fontSize: 10, fontWeight: "700", color: "#172B3A" },
  termStmt: { color: "#374151", fontSize: 13, marginTop: 4 },
  footnote: { color: "#6b7280", fontSize: 11, marginTop: 3, fontStyle: "italic" },
  src: { color: "#168F88", fontSize: 11, marginTop: 4 },
  table: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, marginBottom: 10, overflow: "hidden" },
  tableCaption: { fontWeight: "700", color: "#172B3A", padding: 8, fontSize: 13 },
  trow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  thead: { backgroundColor: "#172B3A" },
  theadText: { color: "#F8F5EC", fontWeight: "700" },
  tcell: { flex: 1, padding: 6, fontSize: 12, color: "#374151" },
  tcellFirst: { flex: 1.6 },
  h: { fontWeight: "700", color: "#172B3A", marginTop: 20, marginBottom: 6 },
  row: { color: "#374151", fontSize: 13, marginBottom: 3 },
  err: { color: "#B91C1C", padding: 20 },
  backBtn: { padding: 10, backgroundColor: "#172B3A" },
  backText: { color: "#F8F5EC", fontWeight: "600" },
  disc: { color: "#9ca3af", fontSize: 10, marginTop: 24, marginBottom: 24, textAlign: "center" },
});
