/**
 * Landing page — the first thing users see.
 * Full-screen hero with two CTAs: "Start free" and "Try the chat".
 * Three feature cards below for buyer, rep, and company.
 */

import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Animated, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MessageSquare, BarChart2, Building } from "lucide-react-native";

export default function LandingPage() {
  const router = useRouter();
  const [showSlugInput, setShowSlugInput] = useState(false);
  const [slug, setSlug] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />

      {/* Hero Section */}
      <View style={styles.hero}>
        <Image
          source={require("../assets/logo.png")}
          style={{ width: 64, height: 64, marginBottom: 24, resizeMode: "contain" }}
        />
        <View style={styles.badge}>
          <Animated.View style={[styles.statusDot, { opacity: pulseAnim }]} />
          <Text style={styles.badgeText}>SALESGEN INTELLIGENCE ACTIVE</Text>
        </View>
        <Text style={styles.heroTitle}>
          Your AI Sales Consultant.{"\n"}Works while you sleep.
        </Text>
        <Text style={styles.heroSubtitle}>
          Upload your documents. Get a chat link. Watch leads qualify themselves — automatically.
        </Text>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryCta}
            onPress={() => router.push("/(auth)/signup")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryCtaText}>Start free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={() => setShowSlugInput(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryCtaText}>Try the chat</Text>
          </TouchableOpacity>

          {showSlugInput && (
            <View style={styles.slugInputRow}>
              <TextInput
                style={styles.slugInput}
                value={slug}
                onChangeText={setSlug}
                placeholder="Enter your org slug"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.goBtn, !slug.trim() && { opacity: 0.5 }]}
                onPress={() => {
                  if (slug.trim()) {
                    router.push(`/chat/${slug.trim()}`);
                  }
                }}
                disabled={!slug.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.goBtnText}>Go →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Feature Cards */}
      <View style={styles.cardsSection}>
        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <MessageSquare size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.cardTitle}>For your buyers</Text>
          <Text style={styles.cardDesc}>
            They visit your site, chat naturally, and get answers sourced from your knowledge base. No signup, no friction. They never know our platform exists.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <BarChart2 size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.cardTitle}>For your sales reps</Text>
          <Text style={styles.cardDesc}>
            Live dashboard showing real-time buyer intent. See animated score bars, detected personas, signal chips, and get notified the moment a lead is decision-ready.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Building size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.cardTitle}>For your company</Text>
          <Text style={styles.cardDesc}>
            Upload PDFs and CSVs — brochures, pricing, case studies. Get a public chat link. Your AI agent reads buying intent in real time, never feeling pushy.
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built for any B2B company.{"\n"}Powered by your own knowledge base.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingBottom: 60,
  },
  hero: {
    paddingTop: 100,
    paddingHorizontal: 24,
    paddingBottom: 48,
    backgroundColor: "#000000",
    alignItems: "center",
  },
  badge: {
    backgroundColor: "#111111",
    borderColor: "#333333",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  badgeText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 46,
    letterSpacing: -2,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#999999",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
    paddingHorizontal: 12,
  },
  ctaRow: {
    width: "100%",
    gap: 16,
  },
  primaryCta: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryCtaText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  secondaryCta: {
    backgroundColor: "#111111",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333333",
  },
  secondaryCtaText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  cardsSection: {
    padding: 24,
    gap: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#666666",
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#222222",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  cardDesc: {
    fontSize: 14,
    color: "#999999",
    lineHeight: 22,
  },
  footer: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "#000000",
    marginTop: 16,
    borderTopWidth: 1,
    borderColor: "#111111",
  },
  footerText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
  },
  slugInputRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  slugInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 15,
    color: "#FFFFFF",
    backgroundColor: "#111111",
  },
  goBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  goBtnText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
  },
});
