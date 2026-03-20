/**
 * Root layout — wraps the app with Expo Router's Stack navigator.
 * Handles auth state loading and redirects.
 */

import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/store/authStore";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { isAuthenticated, role, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadFromStorage().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAdminGroup = segments[0] === "(admin)";
    const inRepGroup = segments[0] === "(rep)";
    const inChatGroup = segments[0] === "chat";

    // Chat is public — no redirect needed
    if (inChatGroup) return;

    if (!isAuthenticated && !inAuthGroup && segments[0] !== undefined) {
      // Not logged in, not on auth or landing — redirect to landing
      router.replace("/");
    } else if (isAuthenticated && (inAuthGroup || segments[0] === undefined)) {
      // Logged in but on auth/landing — redirect by role
      if (role === "admin") {
        router.replace("/(admin)");
      } else if (role === "rep") {
        router.replace("/(rep)");
      }
    }
  }, [isReady, isAuthenticated, role, segments]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000000" }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#000000" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(rep)" />
        <Stack.Screen name="chat/[org_slug]" />
      </Stack>
    </>
  );
}
