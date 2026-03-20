/**
 * Buyer chat screen — public, no auth required.
 * Shows the org's AI assistant. No branding of salesrun — only the org name.
 * Includes resource cards, Calendly CTA (only at 76+), and typing indicator.
 */

import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Send, FileText, Calendar } from "lucide-react-native";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

interface Resource {
  title: string;
  source_file: string;
  relevance_score: number;
  excerpt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  resource?: Resource | null;
  showCalendly?: boolean;
  calendlyLink?: string | null;
}

export default function BuyerChat() {
  const { org_slug } = useLocalSearchParams<{ org_slug: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [orgName, setOrgName] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  // Typing indicator animation
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!sending) return;
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [sending]);

  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setSending(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await axios.post(`${API_BASE_URL}/chat/${org_slug}`, {
        message: msg,
        session_id: sessionId,
      });

      const data = res.data;
      setSessionId(data.session_id);
      if (data.persona && !orgName) {
        // Try to get org name from first response context
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply,
        resource: data.resource || null,
        showCalendly: data.show_calendly || false,
        calendlyLink: data.calendly_link || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble right now. Please try again." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header — shows org name only, no salesrun branding */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{orgName || `${org_slug} AI Assistant`}</Text>
        <View style={styles.onlineDot} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {/* Welcome message */}
        {messages.length === 0 && (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>👋 Hello!</Text>
            <Text style={styles.welcomeText}>
              I'm here to help you learn about our products and services. Ask me anything!
            </Text>
          </View>
        )}

        {messages.map((msg, idx) => (
          <View key={idx}>
            {/* Chat bubble */}
            <View style={[
              styles.bubble,
              msg.role === "user" ? styles.userBubble : styles.aiBubble,
            ]}>
              <Text style={[
                styles.bubbleText,
                msg.role === "user" ? styles.userBubbleText : styles.aiBubbleText,
              ]}>
                {msg.content}
              </Text>
            </View>

            {/* Resource card (inline, after AI message) */}
            {msg.resource && (
              <View style={styles.resourceCard}>
                <View style={styles.resourceHeader}>
                  <FileText size={16} color="#FFFFFF" style={styles.resourceIcon} />
                  <Text style={styles.resourceTitle}>{msg.resource.title}</Text>
                </View>
                <Text style={styles.resourceExcerpt} numberOfLines={3}>
                  {msg.resource.excerpt}
                </Text>
                <Text style={styles.resourceSource}>Source: {msg.resource.source_file}</Text>
              </View>
            )}

            {/* Calendly CTA card (only at score ≥ 76) */}
            {msg.showCalendly && msg.calendlyLink && (
              <View style={styles.calendlyCard}>
                <Text style={styles.calendlyText}>
                  Looks like you might be ready to connect with the team.
                </Text>
                <TouchableOpacity
                  style={styles.calendlyBtn}
                  onPress={() => Linking.openURL(msg.calendlyLink!)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.calendlyBtnText}>Book a free 20-min call →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Typing indicator */}
        {sending && (
          <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
            <View style={styles.typingDots}>
              {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View
                  key={i}
                  style={[styles.dot, { transform: [{ translateY: dot }] }]}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#666666"
          multiline
          maxLength={2000}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
        >
          <Send size={18} color="#000000" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.5 },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginLeft: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },

  welcomeCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#222222",
  },
  welcomeTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginBottom: 8, letterSpacing: -0.5 },
  welcomeText: { fontSize: 14, color: "#999999", lineHeight: 22 },

  bubble: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    maxWidth: "85%",
  },
  userBubble: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "#222222",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#111111",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  userBubbleText: { color: "#FFFFFF", fontWeight: "500" },
  aiBubbleText: { color: "#CCCCCC" },
  bubbleText: { fontSize: 15, lineHeight: 22 },

  resourceCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginLeft: 8,
    maxWidth: "85%",
    borderWidth: 1,
    borderColor: "#333333",
  },
  resourceHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  resourceIcon: { marginRight: 8 },
  resourceTitle: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.5 },
  resourceExcerpt: { fontSize: 13, color: "#999999", lineHeight: 20, marginBottom: 8 },
  resourceSource: { fontSize: 11, color: "#666666", textTransform: "uppercase", letterSpacing: 1 },

  calendlyCard: {
    backgroundColor: "#111111",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    marginLeft: 8,
    maxWidth: "85%",
    borderWidth: 1,
    borderColor: "#333333",
  },
  calendlyText: { fontSize: 14, color: "#FFFFFF", marginBottom: 16, lineHeight: 22 },
  calendlyBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  calendlyBtnText: { color: "#000000", fontSize: 15, fontWeight: "800", letterSpacing: -0.5 },

  typingBubble: { paddingVertical: 18, paddingHorizontal: 20 },
  typingDots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#111111",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
    maxHeight: 120,
    backgroundColor: "#111111",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  sendBtnDisabled: { opacity: 0.3 },
});
