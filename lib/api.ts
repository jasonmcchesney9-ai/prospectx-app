import axios from "axios";
import { getToken, removeToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

// Attach JWT and set Content-Type appropriately
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Only set JSON content-type for non-FormData requests
  // FormData needs Axios to auto-set multipart/form-data with boundary
  const isFormData = typeof FormData !== "undefined" && config.data instanceof FormData;
  if (!isFormData) {
    config.headers["Content-Type"] = "application/json";
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
