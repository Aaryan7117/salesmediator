/**
 * Admin Live Monitor — SSE-powered real-time session viewer with human takeover.
 * Mobile adaptation of the web dashboard's LiveMonitor.tsx.
 *
 * Features:
 *   - SSE connection to /live/stream for real-time lead updates
 *   - Active sessions list with qualification status + checklist progress
 *   - Full conversation viewer with role-colored bubbles
 *   - Human takeover: type a message that appears as the AI's reply
 *   - In-app notifications for new leads and status changes
 */

import { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import api, { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import NotificationBanner from "./components/NotificationBanner";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Types ──────────────────────────────────────────────────────────
interface LiveLead {
  id: string;
  session_id: string;
  persona: string | null;
  intent_score: number;
  intent_state: string;
  signals: string[];
  calendly_shown: boolean;
  updated_at: string | null;
  qualification_status?: string;
  qualification_checklist?: Record<string, any> | null;
  conversation?: ConversationTurn[];
}

interface ConversationTurn {
  role: string;
  content: string;
  timestamp?: string;
  human_takeover?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────
const CHECKLIST_FIELDS = ["name", "company", "role", "use_case", "company_size", "timeline"];

function getChecklistProgress(checklist: Record<string, any> | null | undefined) {
  if (!checklist) return { filled: 0, total: CHECKLIST_FIELDS.length };
  const filled = CHECKLIST_FIELDS.filter(
    (f) => checklist[f] != null && checklist[f] !== ""
  ).length;
  return { filled, total: CHECKLIST_FIELDS.length };
}

function qualStatusColor(s: string | undefined): string {
  if (s === "qualified") return "#10B981";
  if (s === "unqualified") return "#EF4444";
  return "#F59E0B";
}

function qualStatusLabel(s: string | undefined): string {
  if (s === "qualified") return "🟢 Qualified";
  if (s === "unqualified") return "🔴 Unqualified";
  return "🟡 Collecting";
}

function qualStatusBg(s: string | undefined): string {
  if (s === "qualified") return "rgba(16,185,129,0.12)";
  if (s === "unqualified") return "rgba(239,68,68,0.12)";
  return "rgba(245,158,11,0.12)";
}

function timeSince(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// ─── Component ──────────────────────────────────────────────────────
export default function LiveMonitor() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [sessions, setSessions] = useState<LiveLead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [takeoverInput, setTakeoverInput] = useState("");
  const [takingOver, setTakingOver] = useState(false);

  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  const prevStatusMapRef = useRef<Map<string, string>>(new Map());
  const chatScrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Pulse animation for connection indicator ───
  useEffect(() => {
    if (!connected) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [connected]);

  // ─── SSE Connection ───
  useEffect(() => {
    if (!accessToken) return;
    let aborted = false;

    async function connectSSE() {
      try {
        const res = await fetch(`${API_BASE_URL}/live/stream`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || !res.body) {
          setConnected(false);
          if (!aborted) setTimeout(connectSSE, 5000);
          return;
        }
        setConnected(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data && data !== "{}") {
                try {
                  const leads: LiveLead[] = JSON.parse(data);
                  setSessions(leads);
                  processNotifications(leads);
                } catch {}
              }
            }
          }
        }
      } catch (err) {
        console.error("SSE connection error:", err);
        setConnected(false);
        if (!aborted) setTimeout(connectSSE, 5000);
      }
    }

    connectSSE();

    return () => {
      aborted = true;
      setConnected(false);
    };
  }, [accessToken]);

  // ─── Notification Processor ───
  const processNotifications = useCallback(
    (leads: LiveLead[]) => {
      const currentIds = new Set(leads.map((l) => l.id));
      const prevIds = prevSessionIdsRef.current;
      const prevStatusMap = prevStatusMapRef.current;

      for (const lead of leads) {
        const leadName =
          lead.qualification_checklist?.name || lead.persona || "New Visitor";

        // New lead detected
        if (!prevIds.has(lead.id)) {
          addNotification({
            leadId: lead.id,
            leadName,
            type: "new_lead",
            message: "New buyer started a conversation",
          });
        }

        // Qualification status changed
        const prevStatus = prevStatusMap.get(lead.id);
        if (
          prevStatus &&
          lead.qualification_status &&
          prevStatus !== lead.qualification_status
        ) {
          if (lead.qualification_status === "qualified") {
            addNotification({
              leadId: lead.id,
              leadName,
              type: "qualified",
              message: "Lead has been fully qualified!",
            });
          } else {
            addNotification({
              leadId: lead.id,
              leadName,
              type: "status_change",
              message: `Status changed to ${lead.qualification_status}`,
            });
          }
        }
      }

      // Update refs
      prevSessionIdsRef.current = currentIds;
      const newStatusMap = new Map<string, string>();
      for (const lead of leads) {
        if (lead.qualification_status) {
          newStatusMap.set(lead.id, lead.qualification_status);
        }
      }
      prevStatusMapRef.current = newStatusMap;
    },
    [addNotification]
  );

  // ─── Fetch selected lead detail ───
  useEffect(() => {
    if (!selectedId) return;
    fetchDetail(selectedId);
    const interval = setInterval(() => fetchDetail(selectedId), 4000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const fetchDetail = async (leadId: string) => {
    try {
      const res = await api.get(`/leads/${leadId}`);
      setSelectedDetail(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Auto-scroll chat ───
  useEffect(() => {
    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [selectedDetail]);

  // ─── Human Takeover ───
  const handleTakeover = async () => {
    if (!takeoverInput.trim() || !selectedId || takingOver) return;
    setTakingOver(true);
    try {
      const res = await api.post(`/live/takeover/${selectedId}`, {
        message: takeoverInput,
      });
      if (res.status === 200) {
        setTakeoverInput("");
        fetchDetail(selectedId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTakingOver(false);
    }
  };

  // ─── Handle notification tap ───
  const handleNotifTap = (notif: any) => {
    setSelectedId(notif.leadId);
  };

  // ─── Session List Item ───
  const renderSessionItem = ({ item }: { item: LiveLead }) => {
    const progress = getChecklistProgress(item.qualification_checklist);
    const isSelected = selectedId === item.id;
    const displayName =
      item.qualification_checklist?.name || item.persona || "New Visitor";
    const company =
      item.qualification_checklist?.company || "Unknown company";

    return (
      <TouchableOpacity
        style={[
          styles.sessionCard,
          isSelected && styles.sessionCardSelected,
        ]}
        onPress={() => setSelectedId(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.sessionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.sessionCompany} numberOfLines={1}>
              {company}
            </Text>
          </View>
          <View
            style={[
              styles.qualBadge,
              { backgroundColor: qualStatusBg(item.qualification_status) },
            ]}
          >
            <Text
              style={[
                styles.qualBadgeText,
                { color: qualStatusColor(item.qualification_status) },
              ]}
            >
              {qualStatusLabel(item.qualification_status)}
            </Text>
          </View>
        </View>

        {/* Checklist progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(progress.filled / progress.total) * 100}%`,
                  backgroundColor:
                    progress.filled === progress.total
                      ? "#10B981"
                      : "#6366F1",
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.filled}/{progress.total}
          </Text>
        </View>

        <View style={styles.sessionFooter}>
          <Text style={styles.sessionTime}>{timeSince(item.updated_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Detail Panel ───
  const renderDetail = () => {
    if (!selectedId || !selectedDetail) {
      return (
        <View style={styles.emptyDetail}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>Select a session</Text>
          <Text style={styles.emptySubtext}>
            Tap an active session to see the AI agent's conversation and take
            over if needed.
          </Text>
        </View>
      );
    }

    const conversation: ConversationTurn[] =
      selectedDetail.conversation || [];

    return (
      <KeyboardAvoidingView
        style={styles.detailContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={140}
      >
        {/* Qualification Header */}
        <View style={styles.detailHeader}>
          <View style={styles.detailHeaderRow}>
            <View
              style={[
                styles.qualBadgeLg,
                {
                  backgroundColor: qualStatusBg(
                    selectedDetail.qualification_status
                  ),
                },
              ]}
            >
              <Text
                style={[
                  styles.qualBadgeLgText,
                  {
                    color: qualStatusColor(
                      selectedDetail.qualification_status
                    ),
                  },
                ]}
              >
                {qualStatusLabel(selectedDetail.qualification_status)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedId(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Checklist grid — 2 columns */}
          <View style={styles.checklistGrid}>
            {CHECKLIST_FIELDS.map((field) => {
              const value =
                selectedDetail.qualification_checklist?.[field];
              return (
                <View
                  key={field}
                  style={[
                    styles.checklistItem,
                    {
                      backgroundColor: value
                        ? "rgba(16,185,129,0.06)"
                        : "rgba(255,255,255,0.03)",
                      borderColor: value
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(255,255,255,0.06)",
                    },
                  ]}
                >
                  <Text style={styles.checklistLabel}>
                    {value ? "✅" : "⬜"} {formatFieldLabel(field)}
                  </Text>
                  <Text
                    style={[
                      styles.checklistValue,
                      {
                        color: value ? "#FFFFFF" : "#666666",
                        fontWeight: value ? "700" : "400",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {value ?? "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Conversation */}
        <ScrollView
          ref={chatScrollRef}
          style={styles.chatContainer}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
        >
          {conversation.map((turn, i) => (
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
              <Text
                style={[
                  styles.bubbleText,
                  turn.role === "user"
                    ? styles.userBubbleText
                    : styles.aiBubbleText,
                ]}
              >
                {turn.content}
              </Text>
              <Text style={styles.bubbleMeta}>
                {turn.role === "user"
                  ? "Buyer"
                  : turn.human_takeover
                  ? "You (Admin)"
                  : "AI Agent"}
                {turn.timestamp &&
                  ` · ${new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Takeover Input */}
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
      </KeyboardAvoidingView>
    );
  };

  // ─── Render ───
  return (
    <View style={styles.container}>
      {/* Notification Banner */}
      <NotificationBanner onTapNotification={handleNotifTap} />

      {/* Connection Status */}
      <View style={styles.statusBar}>
        <Animated.View
          style={[
            styles.statusDot,
            {
              backgroundColor: connected ? "#10B981" : "#EF4444",
              opacity: connected ? pulseAnim : 1,
            },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: connected ? "#10B981" : "#EF4444" },
          ]}
        >
          {connected ? "Live • Streaming" : "Connecting..."}
        </Text>
        <Text style={styles.sessionCount}>
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* If no session is selected, show session list */}
      {!selectedId ? (
        <View style={styles.listContainer}>
          {sessions.length === 0 ? (
            <View style={styles.emptyDetail}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyTitle}>No active sessions</Text>
              <Text style={styles.emptySubtext}>
                Sessions will appear here when buyers start chatting with your
                AI agent.
              </Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              renderItem={renderSessionItem}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        renderDetail()
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  // Status bar
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sessionCount: {
    marginLeft: "auto",
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
  },

  // Session list
  listContainer: {
    flex: 1,
  },
  sessionCard: {
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#222222",
  },
  sessionCardSelected: {
    borderColor: "#6366F1",
    backgroundColor: "rgba(99,102,241,0.06)",
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  sessionCompany: {
    fontSize: 13,
    color: "#888888",
    fontWeight: "500",
  },
  qualBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qualBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  progressBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: "#666666",
    fontWeight: "700",
  },
  sessionFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  sessionTime: {
    fontSize: 11,
    color: "#555555",
    fontWeight: "600",
  },

  // Detail view
  detailContainer: {
    flex: 1,
  },
  detailHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  qualBadgeLg: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  qualBadgeLgText: {
    fontSize: 14,
    fontWeight: "800",
  },
  closeBtn: {
    fontSize: 20,
    color: "#666666",
    fontWeight: "700",
  },

  // Checklist grid
  checklistGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  checklistItem: {
    width: "48%",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  checklistLabel: {
    fontSize: 9,
    color: "#888888",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  checklistValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Chat
  chatContainer: {
    flex: 1,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(99,102,241,0.15)",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderBottomLeftRadius: 4,
  },
  takeoverBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.12)",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
  },
  takeoverLabel: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  aiBubbleText: {
    color: "#CCCCCC",
  },
  bubbleMeta: {
    fontSize: 10,
    color: "#666666",
    marginTop: 6,
    fontWeight: "500",
  },

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

  // Empty states
  emptyDetail: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    lineHeight: 22,
  },
});
