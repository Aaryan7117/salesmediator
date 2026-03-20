/**
 * Lead detail screen — full conversation transcript + all signals + actions.
 */

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import api from "@/lib/api";

interface ConversationTurn {
  role: string;
  content: string;
  timestamp?: string;
}

interface LeadDetail {
  id: string;
  session_id: string;
  persona: string | null;
  intent_score: number;
  intent_state: string;
  signals: string[];
  resources_served: { title: string; source_file: string; relevance_score: number }[];
  conversation: ConversationTurn[];
  crm_filed: boolean;
  github_issue_url: string | null;
  calendly_shown: boolean;
}

const STATE_COLORS: Record<string, string> = {
  Exploring: "#FFFFFF",
  Comparing: "#FFFFFF",
  "Decision-Ready": "#FFFFFF",
};

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/leads/${id}`);
        setLead(res.data);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  if (!lead) {
    return <View style={styles.centered}><Text style={styles.errorText}>Lead not found</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.personaTitle}>{lead.persona || "Unknown Persona"}</Text>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{lead.intent_state}</Text>
          </View>
          <Text style={styles.scoreText}>Score: {lead.intent_score}/100</Text>
        </View>

        {/* Score bar */}
        <View style={styles.scoreBarBg}>
          <View style={[styles.scoreBarFill, {
            width: `${lead.intent_score}%`,
            backgroundColor: STATE_COLORS[lead.intent_state] || "#6B7280",
          }]} />
        </View>
      </View>

      {/* Signals */}
      {lead.signals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signals detected</Text>
          <View style={styles.chipRow}>
            {lead.signals.map((s, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.actionRow}>
          <Text style={styles.actionLabel}>CRM filed:</Text>
          <Text style={[styles.actionValue, { color: lead.crm_filed ? "#1D9E75" : "#6B7280" }]}>
            {lead.crm_filed ? "Yes ✓" : "No"}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <Text style={styles.actionLabel}>Calendly shown:</Text>
          <Text style={[styles.actionValue, { color: lead.calendly_shown ? "#1D9E75" : "#6B7280" }]}>
            {lead.calendly_shown ? "Yes ✓" : "No"}
          </Text>
        </View>
        {lead.github_issue_url && (
          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>GitHub issue:</Text>
            <Text style={[styles.actionValue, { color: "#534AB7" }]}>Created ✓</Text>
          </View>
        )}
      </View>

      {/* Conversation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversation</Text>
        {lead.conversation.map((turn, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              turn.role === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text style={styles.bubbleRole}>{turn.role === "user" ? "Buyer" : "AI"}</Text>
            <Text style={[styles.bubbleText, turn.role === "user" ? styles.userBubbleText : styles.aiBubbleText]}>
              {turn.content}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  errorText: { fontSize: 16, color: "#FF4444" },
  header: { padding: 24, backgroundColor: "#000000", borderBottomWidth: 1, borderBottomColor: "#111111" },
  personaTitle: { fontSize: 32, fontWeight: "900", color: "#FFFFFF", marginBottom: 16, letterSpacing: -2 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#111111", borderWidth: 1, borderColor: "#333333" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 2 },
  scoreText: { fontSize: 15, color: "#999999", fontWeight: "600" },
  scoreBarBg: { height: 8, backgroundColor: "#222222", borderRadius: 4 },
  scoreBarFill: { height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  section: { padding: 24, backgroundColor: "#000000", marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#111111" },
  sectionTitle: { fontSize: 10, fontWeight: "800", color: "#666666", marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { backgroundColor: "#1A1A1A", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#333333" },
  chipText: { fontSize: 14, color: "#999999", fontWeight: "600" },
  actionRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#111111" },
  actionLabel: { fontSize: 15, color: "#999999", fontWeight: "500" },
  actionValue: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  bubble: { borderRadius: 24, padding: 20, marginBottom: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: "#111111", borderWidth: 1, borderColor: "#222222", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: "#000000", borderWidth: 1, borderColor: "#111111", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  userBubbleText: { color: "#FFFFFF", fontWeight: "500" },
  aiBubbleText: { color: "#CCCCCC" },
  bubbleRole: { fontSize: 10, color: "#666666", marginBottom: 6, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
});
