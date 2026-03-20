/**
 * Rep tab layout — bottom tab navigator with 2 tabs: Live Feed and My Leads.
 */

import { Tabs } from "expo-router";
import { Text, TouchableOpacity, Image } from "react-native";
import { useAuthStore } from "@/store/authStore";

export default function RepLayout() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    // Root _layout.tsx detects isAuthenticated=false and redirects to "/"
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#000000", shadowColor: "transparent", elevation: 0, borderBottomWidth: 1, borderBottomColor: "#111111" },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        tabBarStyle: { backgroundColor: "#000000", borderTopWidth: 1, borderTopColor: "#111111", height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#666666",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerLeft: () => (
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 28, height: 28, marginLeft: 16, resizeMode: "contain" }}
          />
        ),
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <Text style={{ color: "#FF4444", fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>Log out</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Live Feed",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚡</Text>,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: "My Leads",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
