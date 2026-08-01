import apiClient from "./api";
import type { AuthResponse, LoginRequest, RegisterRequest, ApiResponse } from "../types";

// Auth service wraps the backend auth endpoints. It normalizes responses to
// the AuthResponse type in src/types/auth.ts. The functions throw the
// ApiError shape when the request fails (handled by apiClient interceptors).

function storeAuth(data: AuthResponse) {
  if (data.token) {
    localStorage.setItem("auth_token", data.token);
  }
  if (data.manufacturer) {
    localStorage.setItem("auth_user", JSON.stringify(data.manufacturer));
  }
}

function clearAuth() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export const authService = {
  login: async (data: LoginRequest) => {
    const res = await apiClient.post("/auth/login", data);
    const payload = (res.data && res.data.data) ? res.data.data : res.data;
    // Normalize response to { manufacturer?, token? }
    const manufacturer = (payload && (payload.manufacturer ?? payload.user)) ?? undefined;
    const token = (payload && (payload.token ?? payload.accessToken ?? payload.access_token)) ?? undefined;
    const result: AuthResponse = { manufacturer, token };
    storeAuth(result);
    return result;
  },

  register: async (data: RegisterRequest) => {
    const res = await apiClient.post("/auth/register", data);
    const payload = (res.data && res.data.data) ? res.data.data : res.data;
    const manufacturer = (payload && (payload.manufacturer ?? payload.user)) ?? undefined;
    const token = (payload && (payload.token ?? payload.accessToken ?? payload.access_token)) ?? undefined;
    const otp = (res.data && res.data.data && (res.data.data.otp ?? res.data.otp)) ?? undefined;
    const result: AuthResponse = { manufacturer, token };
    storeAuth(result);
    // Return otp separately to allow callers to prefill in dev
    return { ...result, otp } as AuthResponse & { otp?: string };
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // ignore
    }

    clearAuth();
  },

  getCurrentUser: async () => {
    const res = await apiClient.get("/auth/me");
    const payload = (res.data && res.data.data) ? res.data.data : res.data;
    const manufacturer = (payload && (payload.manufacturer ?? payload.user)) ?? undefined;
    const token = (payload && (payload.token ?? payload.accessToken ?? payload.access_token)) ?? undefined;
    const result: AuthResponse = { manufacturer, token };
    storeAuth(result);
    return result;
  },

  // Convenience accessors for client-side state
  getStoredUser: () => {
    try {
      const raw = localStorage.getItem("auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // Password reset
  forgotPassword: async (email: string) => {
    const res = await apiClient.post<ApiResponse<void>>("/auth/forgot-password", { email });
    return res.data;
  },

  resetPassword: async (payload: { token: string; userId: string; newPassword: string; confirmPassword: string }) => {
    const res = await apiClient.post<ApiResponse<void>>("/auth/reset-password", payload);
    return res.data;
  },

  // Email verification (accepts either `code` or `otp` from callers and sends `otp` to backend)
  verifyEmail: async (payload: { email: string; code?: string; otp?: string }) => {
    const body = { email: payload.email, otp: payload.otp ?? payload.code };
    const res = await apiClient.post<ApiResponse<Record<string, unknown>>>("/auth/verify-email", body);
    return res.data;
  },

  resendVerification: async (email: string) => {
    const res = await apiClient.post<ApiResponse<void>>("/auth/resend-verification", { email });
    return res.data;
  },

  getStoredToken: () => localStorage.getItem("auth_token"),
};



