/**
 * Rep Live Feed — full-screen view of the most recently active buyer session.
 * Shows animated intent bar, persona, signals, resource served, suggested reply.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface LeadData {
  id: string;
  session_id: string;
  persona: string | null;
  intent_score: number;
  intent_state: string;
  signals: string[];
  resources_served: { title: string; source_file: string; relevance_score: number }[];
  conversation: { role: string; content: string; timestamp?: string }[];
}

const STATE_COLORS: Record<string, string> = {
  Exploring: "#FFFFFF",
  Comparing: "#FFFFFF",
  "Decision-Ready": "#FFFFFF",
};

const STATE_BG: Record<string, string> = {
  Exploring: "#222222",
  Comparing: "#222222",
  "Decision-Ready": "#222222",
};

export default function RepLiveFeed() {
  const [lead, setLead] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const barWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchLatestLead = useCallback(async () => {
    try {
      const res = await api.get("/leads/");
      const leads = res.data;
      if (leads.length > 0) {
        // Get full detail of the most recently updated lead
        const latestId = leads[0].id;
        const detail = await api.get(`/leads/${latestId}`);
        setLead(detail.data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLatestLead(); }, [fetchLatestLead]);

  // Poll every 5 seconds for live updates
  useEffect(() => {
    const interval = setInterval(fetchLatestLead, 5000);
    return () => clearInterval(interval);
  }, [fetchLatestLead]);

  // Animate intent bar
  useEffect(() => {
    if (!lead) return;
    Animated.timing(barWidth, {
      toValue: lead.intent_score,
      duration: 600,
      useNativeDriver: false,
    }).start();

    // Pulse animation at 76+
    if (lead.intent_score >= 76) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [lead?.intent_score]);

  const handleCopyReply = async () => {
    if (!lead) return;
    const lastAI = [...lead.conversation].reverse().find(t => t.role === "assistant");
    if (lastAI) {
      await Clipboard.setStringAsync(lastAI.content);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  if (!lead) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>⚡</Text>
        <Text style={styles.emptyText}>Waiting for a buyer to start chatting...</Text>
      </View>
    );
  }

  const lastResource = lead.resources_served.length > 0 ? lead.resources_served[lead.resources_served.length - 1] : null;
  const lastAI = [...lead.conversation].reverse().find(t => t.role === "assistant");
  const initials = lead.persona ? lead.persona.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Intent Bar */}
      <Animated.View style={[styles.intentBarContainer, { transform: [{ scaleX: pulseAnim }] }]}>
        <View style={styles.intentBarBg}>
          <Animated.View style={[styles.intentBarFill, {
            width: barWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
            backgroundColor: STATE_COLORS[lead.intent_state] || "#6B7280",
          }]} />
        </View>
        <View style={styles.intentBarLabels}>
          <Text style={styles.intentScore}>{lead.intent_score}/100</Text>
          <View style={styles.stateBadge}>
            <Text style={styles.stateText}>{lead.intent_state}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Persona Card */}
      <View style={styles.personaCard}>
        <View style={styles.personaAvatar}>
          <Text style={styles.personaAvatarText}>{initials}</Text>
        </View>
        <View style={styles.personaInfo}>
          <Text style={styles.personaLabel}>{lead.persona || "Unknown persona"}</Text>
          <Text style={styles.personaAuthority}>
            {lead.intent_state === "Decision-Ready" ? "Decision authority · Budget aware" : "Evaluating options"}
          </Text>
        </View>
      </View>

      {/* Signal Chips */}
      {lead.signals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Signals detected</Text>
          <View style={styles.chipRow}>
            {lead.signals.map((s, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Resource Served */}
      {lastResource && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recommended by agent</Text>
          <View style={styles.resourceCard}>
            <View style={styles.resourceHeader}>
              <Text style={styles.resourceTitle}>{lastResource.title}</Text>
              <View style={styles.relevanceBadge}>
                <Text style={styles.relevanceText}>{lastResource.relevance_score}%</Text>
              </View>
            </View>
            <Text style={styles.resourceSource}>Source: {lastResource.source_file}</Text>
          </View>
        </View>
      )}

      {/* Suggested Reply */}
      {lastAI && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Suggested reply</Text>
          <View style={styles.replyBox}>
            <Text style={styles.replyText}>{lastAI.content}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyReply} activeOpacity={0.85}>
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, color: "#999999", textAlign: "center", paddingHorizontal: 40 },

  intentBarContainer: { padding: 24, backgroundColor: "#000000", borderBottomWidth: 1, borderBottomColor: "#111111" },
  intentBarBg: { height: 8, backgroundColor: "#222222", borderRadius: 4, overflow: "hidden" },
  intentBarFill: { height: 8, borderRadius: 4 },
  intentBarLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  intentScore: { fontSize: 28, fontWeight: "900", color: "#FFFFFF", letterSpacing: -1 },
  stateBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#111111", borderWidth: 1, borderColor: "#333333" },
  stateText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 2 },

  personaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  personaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  personaAvatarText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  personaInfo: { flex: 1 },
  personaLabel: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 4, letterSpacing: -0.5 },
  personaAuthority: { fontSize: 14, color: "#999999", fontWeight: "500" },

  section: { padding: 24, backgroundColor: "#000000", marginTop: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#111111" },
  sectionLabel: { fontSize: 10, fontWeight: "800", color: "#666666", marginBottom: 16, letterSpacing: 2, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { backgroundColor: "#1A1A1A", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#333333" },
  chipText: { fontSize: 14, color: "#999999", fontWeight: "600" },

  resourceCard: { backgroundColor: "#111111", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#222222" },
  resourceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  resourceTitle: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", flex: 1, letterSpacing: -0.3 },
  relevanceBadge: { backgroundColor: "#222222", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  relevanceText: { fontSize: 12, color: "#FFFFFF", fontWeight: "800" },
  resourceSource: { fontSize: 13, color: "#999999", fontWeight: "500" },

  replyBox: { backgroundColor: "#111111", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#222222" },
  replyText: { fontSize: 15, color: "#CCCCCC", lineHeight: 22, marginBottom: 16 },
  copyBtn: { backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  copyBtnText: { color: "#000000", fontSize: 15, fontWeight: "800" },
});
