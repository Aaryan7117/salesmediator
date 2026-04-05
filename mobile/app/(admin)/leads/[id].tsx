/**
 * Lead detail screen — full conversation transcript + all signals + actions.
 * Now supports human takeover display and inline takeover input.
 */

import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface ConversationTurn {
  role: string;
  content: string;
  timestamp?: string;
  human_takeover?: boolean;
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
  qualification_status?: string;
  qualification_checklist?: Record<string, any> | null;
}

const STATE_COLORS: Record<string, string> = {
  Exploring: "#FFFFFF",
  Comparing: "#FFFFFF",
  "Decision-Ready": "#FFFFFF",
};

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useAuthStore((s) => s.role);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [takeoverInput, setTakeoverInput] = useState("");
  const [takingOver, setTakingOver] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const fetchLead = async () => {
    try {
      const res = await api.get(`/leads/${id}`);
      setLead(res.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  // Auto-scroll chat on update
  useEffect(() => {
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [lead]);

  // ─── Human Takeover ───
  const handleTakeover = async () => {
    if (!takeoverInput.trim() || !id || takingOver) return;
    setTakingOver(true);
    try {
      const res = await api.post(`/live/takeover/${id}`, {
        message: takeoverInput,
      });
      if (res.status === 200) {
        setTakeoverInput("");
        fetchLead();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTakingOver(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  if (!lead) {
    return <View style={styles.centered}><Text style={styles.errorText}>Lead not found</Text></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.containerFlex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        ref={chatScrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
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

        {/* Qualification Status */}
        {lead.qualification_status && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Qualification</Text>
            <View style={[styles.qualBadge, {
              backgroundColor: lead.qualification_status === "qualified"
                ? "rgba(16,185,129,0.12)"
                : lead.qualification_status === "unqualified"
                ? "rgba(239,68,68,0.12)"
                : "rgba(245,158,11,0.12)",
            }]}>
              <Text style={[styles.qualBadgeText, {
                color: lead.qualification_status === "qualified"
                  ? "#10B981"
                  : lead.qualification_status === "unqualified"
                  ? "#EF4444"
                  : "#F59E0B",
              }]}>
                {lead.qualification_status === "qualified" ? "🟢 Qualified" :
                 lead.qualification_status === "unqualified" ? "🔴 Unqualified" :
                 "🟡 Collecting"}
              </Text>
            </View>

            {/* Checklist items */}
            {lead.qualification_checklist && (
              <View style={styles.checklistGrid}>
                {["name", "company", "role", "use_case", "company_size", "timeline"].map((field) => {
                  const value = lead.qualification_checklist?.[field];
                  const label = field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
                  return (
                    <View key={field} style={[styles.checklistItem, {
                      backgroundColor: value ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)",
                      borderColor: value ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                    }]}>
                      <Text style={styles.checklistLabel}>
                        {value ? "✅" : "⬜"} {label}
                      </Text>
                      <Text style={[styles.checklistValue, {
                        color: value ? "#FFFFFF" : "#666666",
                        fontWeight: value ? "700" : "400",
                      }]} numberOfLines={1}>
                        {value ?? "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

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
                turn.role === "user"
                  ? styles.userBubble
                  : turn.human_takeover
                  ? styles.takeoverBubble
                  : styles.aiBubble,
              ]}
            >
              {turn.human_takeover && (
                <Text style={styles.takeoverLabel}>👤 HUMAN TAKEOVER</Text>
              )}
              <Text style={styles.bubbleRole}>
                {turn.role === "user"
                  ? "Buyer"
                  : turn.human_takeover
                  ? "You (Admin)"
                  : "AI"}
              </Text>
              <Text style={[
                styles.bubbleText,
                turn.role === "user" ? styles.userBubbleText : styles.aiBubbleText,
              ]}>
                {turn.content}
              </Text>
              {turn.timestamp && (
                <Text style={styles.bubbleTimestamp}>
                  {new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Human Takeover Input (admin only) */}
      {role === "admin" && (
        <View style={styles.takeoverBar}>
          <TextInput
            style={styles.takeoverInput}
            placeholder="Take over — type as the AI..."
            placeholderTextColor="#555555"
            value={takeoverInput}
            onChangeText={setTakeoverInput}
            onSubmitEditing={handleTakeover}
            returnKeyType="send"
            editable={!takingOver}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!takeoverInput.trim() || takingOver) && styles.sendBtnDisabled,
            ]}
            onPress={handleTakeover}
            disabled={!takeoverInput.trim() || takingOver}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>
              {takingOver ? "..." : "Send"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  containerFlex: { flex: 1, backgroundColor: "#000000" },
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

  // Qualification
  qualBadge: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16 },
  qualBadgeText: { fontSize: 14, fontWeight: "800" },
  checklistGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  checklistItem: { width: "48%", padding: 10, borderRadius: 10, borderWidth: 1 },
  checklistLabel: { fontSize: 9, color: "#888888", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  checklistValue: { fontSize: 13, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { backgroundColor: "#1A1A1A", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#333333" },
  chipText: { fontSize: 14, color: "#999999", fontWeight: "600" },
  actionRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#111111" },
  actionLabel: { fontSize: 15, color: "#999999", fontWeight: "500" },
  actionValue: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },

  // Conversation bubbles
  bubble: { borderRadius: 24, padding: 20, marginBottom: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: "#111111", borderWidth: 1, borderColor: "#222222", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: "#000000", borderWidth: 1, borderColor: "#111111", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  takeoverBubble: {
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  takeoverLabel: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  userBubbleText: { color: "#FFFFFF", fontWeight: "500" },
  aiBubbleText: { color: "#CCCCCC" },
  bubbleRole: { fontSize: 10, color: "#666666", marginBottom: 6, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTimestamp: { fontSize: 10, color: "#555555", marginTop: 6, fontWeight: "500" },

  // Takeover bar
  takeoverBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#111111",
    backgroundColor: "#000000",
    gap: 10,
  },
  takeoverInput: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#222222",
  },
  sendBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
  sendBtnText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "800",
  },
});
