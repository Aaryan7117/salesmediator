/**
 * Notification store — tracks in-app notifications from the Live Monitor SSE stream.
 * Notifications are generated when:
 *   - A new lead appears in the stream
 *   - A lead's qualification_status changes to "qualified"
 *   - A lead crosses the Decision-Ready threshold
 */

import { create } from "zustand";
import { Vibration } from "react-native";

export type NotificationType = "new_lead" | "qualified" | "high_intent" | "status_change";

export interface AppNotification {
  id: string;
  leadId: string;
  leadName: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;

  addNotification: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

let _idCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    const notification: AppNotification = {
      ...n,
      id: `notif_${Date.now()}_${_idCounter++}`,
      timestamp: Date.now(),
      read: false,
    };

    // Haptic feedback
    try {
      Vibration.vibrate(200);
    } catch {}

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50), // Keep max 50
      unreadCount: state.unreadCount + 1,
    }));
  },

  markRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },
}));
