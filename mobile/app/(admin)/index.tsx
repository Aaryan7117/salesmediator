/**
 * Admin Overview — 4 metric cards in a 2x2 grid.
 */

import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from "react-native";
import api from "@/lib/api";

interface Analytics {
  total_leads: number;
  avg_intent_score: number;
  decision_ready_count: number;
  conversion_rate: number;
}

export default function AdminOverview() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get("/analytics/");
      setData(res.data);
    } catch {
      // Silent fail — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  const metrics = [
    { label: "Total leads", value: String(data?.total_leads ?? 0), color: "#FFFFFF" },
    { label: "Avg intent score", value: String(data?.avg_intent_score ?? 0), color: "#FFFFFF" },
    { label: "Decision-ready", value: String(data?.decision_ready_count ?? 0), color: "#FFFFFF" },
    { label: "Conversion rate", value: `${data?.conversion_rate ?? 0}%`, color: "#FFFFFF" },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
    >
      <Text style={styles.heading}>Dashboard</Text>
      <View style={styles.grid}>
        {metrics.map((m, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardLabel}>{m.label}</Text>
            <Text style={[styles.cardValue, { color: m.color }]}>{m.value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  heading: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginBottom: 20, marginTop: 8, letterSpacing: -1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#222222",
  },
  cardLabel: { fontSize: 10, color: "#666666", marginBottom: 16, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2 },
  cardValue: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
});
