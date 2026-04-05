/**
 * Admin tab layout — bottom tab navigator with 6 tabs.
 * Live Monitor is the first tab with an unread notification badge.
 */

import { Tabs } from "expo-router";
import { Text, View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";

export default function AdminLayout() {
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

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
        name="live"
        options={{
          title: "Live",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Text style={{ fontSize: 20, color }}>📡</Text>
              {unreadCount > 0 && (
                <View style={badgeStyles.badge}>
                  <Text style={badgeStyles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: "Leads",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="kb"
        options={{
          title: "KB",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📄</Text>,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: "Team",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🤝</Text>,
        }}
      />
      <Tabs.Screen
        name="integrations"
        options={{
          title: "Integrations",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔗</Text>,
        }}
      />
      <Tabs.Screen name="leads/[id]" options={{ href: null }} />
      <Tabs.Screen name="components/NotificationBanner" options={{ href: null }} />
    </Tabs>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#000000",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
  },
});
