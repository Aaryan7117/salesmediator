/**
 * Signup screen — two paths:
 * 1. Admin: "I'm setting up for my company" → org name, email, password
 * 2. Rep: "I was invited by my team" → invite code, email, password
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Building2, UserPlus } from "lucide-react-native";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type SignupPath = "choose" | "admin" | "rep";

export default function SignupScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [path, setPath] = useState<SignupPath>("choose");
  const [loading, setLoading] = useState(false);

  // Admin fields
  const [orgName, setOrgName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Rep fields
  const [inviteCode, setInviteCode] = useState("");
  const [repFullName, setRepFullName] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [repPassword, setRepPassword] = useState("");

  const handleAdminSignup = async () => {
    if (!orgName || !adminEmail || !adminPassword || !adminFullName) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/signup", {
        org_name: orgName,
        email: adminEmail,
        password: adminPassword,
        full_name: adminFullName,
      });
      setAuth({
        accessToken: res.data.access_token,
        userId: res.data.user_id,
        orgId: res.data.org_id,
        role: "admin",
        fullName: res.data.full_name,
      });
      router.replace("/(admin)");
    } catch (err: any) {
      Alert.alert("Signup failed", err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleRepJoin = async () => {
    if (!inviteCode || !repEmail || !repPassword || !repFullName) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/join", {
        invite_code: inviteCode,
        email: repEmail,
        password: repPassword,
        full_name: repFullName,
      });
      setAuth({
        accessToken: res.data.access_token,
        userId: res.data.user_id,
        orgId: res.data.org_id,
        role: "rep",
        fullName: res.data.full_name,
      });
      router.replace("/(rep)");
    } catch (err: any) {
      Alert.alert("Join failed", err.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (path === "choose") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 48, height: 48, marginBottom: 24, resizeMode: "contain" }}
          />
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Choose how you want to get started</Text>
        </View>

        <View style={styles.pathCards}>
          <TouchableOpacity
            style={styles.pathCard}
            onPress={() => setPath("admin")}
            activeOpacity={0.85}
          >
            <View style={styles.pathIcon}>
              <Building2 size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.pathTitle}>I'm setting up for my company</Text>
            <Text style={styles.pathDesc}>Create your organisation and start configuring your AI agent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pathCard}
            onPress={() => setPath("rep")}
            activeOpacity={0.85}
          >
            <View style={styles.pathIcon}>
              <UserPlus size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.pathTitle}>I was invited by my team</Text>
            <Text style={styles.pathDesc}>Enter your invite code to join an existing organisation</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkBold}>Log in</Text></Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setPath("choose")} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 48, height: 48, marginBottom: 24, resizeMode: "contain" }}
        />
        <Text style={styles.title}>
          {path === "admin" ? "Set up your company" : "Join your team"}
        </Text>
        <Text style={styles.subtitle}>
          {path === "admin"
            ? "Create your organisation and admin account"
            : "Enter your invite code to get started"}
        </Text>

        {path === "admin" ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company name</Text>
              <TextInput
                style={styles.input}
                value={orgName}
                onChangeText={setOrgName}
                placeholder="Acme Corp"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your full name</Text>
              <TextInput
                style={styles.input}
                value={adminFullName}
                onChangeText={setAdminFullName}
                placeholder="Jane Smith"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={adminEmail}
                onChangeText={setAdminEmail}
                placeholder="jane@acme.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={adminPassword}
                onChangeText={setAdminPassword}
                placeholder="Min 8 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            </View>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleAdminSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create organisation</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invite code</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Paste the code from your admin"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your full name</Text>
              <TextInput
                style={styles.input}
                value={repFullName}
                onChangeText={setRepFullName}
                placeholder="John Doe"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={repEmail}
                onChangeText={setRepEmail}
                placeholder="john@acme.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={repPassword}
                onChangeText={setRepPassword}
                placeholder="Min 8 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            </View>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleRepJoin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Join team</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  formContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
    color: "#999999",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: "#999999",
    marginBottom: 32,
    lineHeight: 22,
  },
  pathCards: {
    paddingHorizontal: 24,
    gap: 16,
  },
  pathCard: {
    backgroundColor: "#111111",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#222222",
  },
  pathIcon: {
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
  pathTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  pathDesc: {
    fontSize: 14,
    color: "#999999",
    lineHeight: 22,
  },
  loginLink: {
    alignItems: "center",
    marginTop: 32,
    paddingHorizontal: 24,
  },
  loginLinkText: {
    fontSize: 14,
    color: "#999999",
  },
  loginLinkBold: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: "#666666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
    backgroundColor: "#111111",
  },
  submitButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
