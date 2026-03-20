/**
 * Admin Leads — list sorted by intent score. Tap for full detail.
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import api from "@/lib/api";

interface LeadItem {
  id: string;
  session_id: string;
  persona: string | null;
  intent_score: number;
  intent_state: string;
  signals: string[];
  updated_at: string | null;
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

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function getInitials(persona: string | null): string {
  if (!persona) return "?";
  return persona.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminLeads() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await api.get("/leads/");
      setLeads(res.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchLeads(); }, [fetchLeads]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  if (leads.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyIcon}>👥</Text>
        <Text style={styles.emptyText}>No leads yet</Text>
        <Text style={styles.emptySubtext}>Leads will appear here when buyers start chatting</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={leads}
      keyExtractor={(item) => item.id}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/(admin)/leads/${item.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.persona)}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.personaLabel}>{item.persona || "Unknown"}</Text>
              <View style={[styles.stateBadge, { backgroundColor: STATE_BG[item.intent_state] || "#F3F4F6" }]}>
                <Text style={[styles.stateText, { color: STATE_COLORS[item.intent_state] || "#6B7280" }]}>
                  {item.intent_state}
                </Text>
              </View>
            </View>
            <Text style={styles.timeAgo}>{timeAgo(item.updated_at)}</Text>
          </View>

          {/* Mini score bar */}
          <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${item.intent_score}%`, backgroundColor: STATE_COLORS[item.intent_state] || "#6B7280" }]} />
          </View>

          {/* Signal chips */}
          {item.signals.length > 0 && (
            <View style={styles.signalRow}>
              {item.signals.slice(0, 2).map((s, i) => (
                <View key={i} style={styles.signalChip}>
                  <Text style={styles.signalText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginBottom: 6, letterSpacing: -0.5 },
  emptySubtext: { fontSize: 14, color: "#999999", textAlign: "center", paddingHorizontal: 40 },
  card: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222222",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: {
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
  avatarText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  cardInfo: { flex: 1 },
  personaLabel: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 6, letterSpacing: -0.5 },
  stateBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start" },
  stateText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  timeAgo: { fontSize: 10, color: "#666666", textTransform: "uppercase", letterSpacing: 1, fontWeight: "800" },
  scoreBarBg: { height: 6, backgroundColor: "#222222", borderRadius: 3, marginBottom: 16 },
  scoreBarFill: { height: 6, borderRadius: 3 },
  signalRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  signalChip: { backgroundColor: "#1A1A1A", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#333333" },
  signalText: { fontSize: 12, color: "#999999", fontWeight: "600" },
});
