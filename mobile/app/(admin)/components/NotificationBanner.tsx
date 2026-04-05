/**
 * NotificationBanner — animated slide-down banner for real-time live alerts.
 * Appears from the top with a spring animation, auto-dismisses after 4 seconds.
 */

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Text,
  TouchableOpacity,
  StyleSheet,
  View,
  Dimensions,
} from "react-native";
import {
  AppNotification,
  useNotificationStore,
} from "@/store/notificationStore";

const BANNER_HEIGHT = 88;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  new_lead: { icon: "👋", color: "#6366F1", bg: "rgba(99,102,241,0.15)" },
  qualified: { icon: "🟢", color: "#10B981", bg: "rgba(16,185,129,0.15)" },
  high_intent: { icon: "🔥", color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  status_change: { icon: "🔄", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)" },
};

interface Props {
  onTapNotification?: (notification: AppNotification) => void;
}

export default function NotificationBanner({ onTapNotification }: Props) {
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const lastSeenId = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (notifications.length === 0) return;
    const latest = notifications[0];
    if (latest.id === lastSeenId.current) return;
    if (latest.read) return;

    lastSeenId.current = latest.id;
    setCurrent(latest);

    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after 4 seconds
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => dismiss(), 4000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [notifications]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -BANNER_HEIGHT - 20,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setCurrent(null));
  };

  const handleTap = () => {
    if (!current) return;
    markRead(current.id);
    dismiss();
    onTapNotification?.(current);
  };

  if (!current) return null;

  const config = TYPE_CONFIG[current.type] || TYPE_CONFIG.new_lead;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: config.bg,
          borderColor: config.color + "33",
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={handleTap}
        activeOpacity={0.85}
      >
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: config.color }]} numberOfLines={1}>
            {current.leadName}
          </Text>
          <Text style={styles.message} numberOfLines={1}>
            {current.message}
          </Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    height: BANNER_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 14,
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  message: {
    fontSize: 13,
    color: "#AAAAAA",
    fontWeight: "500",
  },
  dismissText: {
    fontSize: 16,
    color: "#666666",
    fontWeight: "700",
  },
});
