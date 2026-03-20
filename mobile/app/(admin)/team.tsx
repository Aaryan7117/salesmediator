/**
 * Admin Team — generate invite code, list members.
 */

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import api from "@/lib/api";

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
  leads_count: number;
  created_at: string | null;
}

export default function AdminTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await api.get("/team/members");
      setMembers(res.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchMembers(); }, [fetchMembers]);

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/team/invite");
      setInviteCode(res.data.code);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to generate invite.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert("Copied!", "Invite code copied to clipboard.");
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#FFFFFF" /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Invite section */}
      <TouchableOpacity
        style={[styles.inviteBtn, generating && styles.inviteBtnDisabled]}
        onPress={handleGenerateInvite}
        disabled={generating}
        activeOpacity={0.85}
      >
        {generating ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <Text style={styles.inviteBtnText}>Generate invite link</Text>
        )}
      </TouchableOpacity>

      {inviteCode && (
        <TouchableOpacity style={styles.codeCard} onPress={handleCopyCode} activeOpacity={0.85}>
          <Text style={styles.codeLabel}>Invite code (tap to copy):</Text>
          <Text style={styles.codeText}>{inviteCode}</Text>
          <Text style={styles.codeHint}>Share this with your sales rep to join your team</Text>
        </TouchableOpacity>
      )}

      {/* Members list */}
      <Text style={styles.sectionLabel}>TEAM MEMBERS</Text>
      {members.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No team members yet. Generate an invite to add reps.</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
          renderItem={({ item }) => (
            <View style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {(item.full_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.full_name || "Unnamed"}</Text>
                <View style={styles.memberMeta}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {item.role}
                    </Text>
                  </View>
                  {item.role === "rep" && (
                    <Text style={styles.leadsCount}>{item.leads_count} leads</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" },
  inviteBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  inviteBtnDisabled: { opacity: 0.7 },
  inviteBtnText: { color: "#000000", fontSize: 16, fontWeight: "800", letterSpacing: -0.5 },
  codeCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222222",
  },
  codeLabel: { fontSize: 10, color: "#666666", marginBottom: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 2 },
  codeText: { fontSize: 28, fontWeight: "900", color: "#FFFFFF", letterSpacing: 2 },
  codeHint: { fontSize: 13, color: "#999999", marginTop: 12 },
  sectionLabel: { fontSize: 10, fontWeight: "800", color: "#666666", letterSpacing: 2, marginBottom: 12, marginTop: 8, textTransform: "uppercase" },
  emptyState: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#999999", textAlign: "center" },
  memberCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222222",
    flexDirection: "row",
    alignItems: "center",
  },
  memberAvatar: {
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
  memberAvatarText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 6, letterSpacing: -0.5 },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  roleBadge: { backgroundColor: "#222222", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  roleBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  leadsCount: { fontSize: 13, color: "#999999" },
});
