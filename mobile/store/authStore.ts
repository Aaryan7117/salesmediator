/**
 * Global auth state using Zustand.
 * Stores user session, org info, and role.
 * Persisted to AsyncStorage so login survives app restarts.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthState {
  accessToken: string | null;
  userId: string | null;
  orgId: string | null;
  role: "admin" | "rep" | null;
  fullName: string | null;
  isAuthenticated: boolean;

  setAuth: (data: {
    accessToken: string;
    userId: string;
    orgId: string;
    role: "admin" | "rep";
    fullName: string | null;
  }) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  orgId: null,
  role: null,
  fullName: null,
  isAuthenticated: false,

  setAuth: (data) => {
    set({
      accessToken: data.accessToken,
      userId: data.userId,
      orgId: data.orgId,
      role: data.role,
      fullName: data.fullName,
      isAuthenticated: true,
    });
    // Persist to AsyncStorage
    AsyncStorage.setItem(
      "auth_state",
      JSON.stringify(data)
    ).catch(() => {});
  },

  logout: () => {
    set({
      accessToken: null,
      userId: null,
      orgId: null,
      role: null,
      fullName: null,
      isAuthenticated: false,
    });
    AsyncStorage.removeItem("auth_state").catch(() => {});
  },

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem("auth_state");
      if (stored) {
        const data = JSON.parse(stored);
        set({
          accessToken: data.accessToken,
          userId: data.userId,
          orgId: data.orgId,
          role: data.role,
          fullName: data.fullName,
          isAuthenticated: true,
        });
      }
    } catch {
      // Storage read failed — start fresh
    }
  },
}));
