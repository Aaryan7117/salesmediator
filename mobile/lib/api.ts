/**
 * Axios instance pointing to the FastAPI backend.
 * All authenticated requests attach the JWT from the auth store.
 */

import axios from "axios";
import { useAuthStore } from "@/store/authStore";
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://salesgen-api.onrender.com";
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT to every request if available
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses — clear auth state
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
