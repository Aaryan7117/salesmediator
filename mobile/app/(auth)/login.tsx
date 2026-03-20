/**
 * Login screen — email + password, redirects by role.
 */

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      setAuth({
        accessToken: res.data.access_token,
        userId: res.data.user_id,
        orgId: res.data.org_id,
        role: res.data.role,
        fullName: res.data.full_name,
      });
      if (res.data.role === "admin") {
        router.replace("/(admin)");
      } else {
        router.replace("/(rep)");
      }
    } catch (err: any) {
      Alert.alert("Login failed", err.response?.data?.detail || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Image
          source={require("../../assets/logo.png")}
          style={{ width: 48, height: 48, marginBottom: 24, resizeMode: "contain" }}
        />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to your salesrun account</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Log in</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/signup")} style={styles.signupLink}>
          <Text style={styles.signupLinkText}>
            Don't have an account? <Text style={styles.signupLinkBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    paddingTop: 100,
    paddingHorizontal: 24,
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
    marginBottom: 36,
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
  signupLink: {
    alignItems: "center",
    marginTop: 24,
  },
  signupLinkText: {
    fontSize: 14,
    color: "#999999",
  },
  signupLinkBold: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
