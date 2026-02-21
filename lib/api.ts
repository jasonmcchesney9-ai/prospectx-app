import axios from "axios";
import { getToken, removeToken } from "./auth";

const PRODUCTION_API = "https://prospectx-app-production-b918.up.railway.app";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? PRODUCTION_API
    : "http://localhost:8000");

const api = axios.create({
  baseURL: API_BASE,
  timeout: 180000,
});

// Attach JWT and set Content-Type appropriately
api.interceptors.request.use((config) => {
  // Check for impersonation token first (sessionStorage, short-lived)
  const impersonateToken = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("impersonate_token") : null;
  const token = impersonateToken || getToken();
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

/**
 * Resolve an image/asset URL. External URLs (http/https) are returned as-is.
 * Local paths (e.g. /uploads/...) get the API base URL prepended.
 * HockeyTech "nophoto" placeholder URLs are treated as empty.
 */
export function assetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.toLowerCase().includes("nophoto")) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

/**
 * Check if a player has a real image (not null, empty, or a HockeyTech nophoto placeholder).
 */
export function hasRealImage(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.toLowerCase().includes("nophoto")) return false;
  return true;
}

/**
 * Extract a human-readable error message from an Axios error or unknown thrown value.
 * Handles FastAPI 422 validation errors (Pydantic v2 format: detail is array of {type, loc, msg, input}),
 * standard FastAPI errors (detail is a string), and generic JS errors.
 * Always returns a plain string safe for rendering in JSX.
 */
export function extractApiError(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;

  // Axios error with response
  const resp = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
  if (resp?.data?.detail !== undefined) {
    const detail = resp.data.detail;
    // String detail (most common)
    if (typeof detail === "string") return detail;
    // Pydantic v2 validation errors: array of {type, loc, msg, input}
    if (Array.isArray(detail)) {
      const messages = detail
        .map((e: { msg?: string; loc?: (string | number)[] }) => {
          const field = e.loc ? e.loc.filter((l) => l !== "body").join(".") : "";
          return field ? `${field}: ${e.msg || "invalid"}` : (e.msg || "invalid");
        })
        .join("; ");
      return messages || fallback;
    }
    // Object detail (single validation error)
    if (typeof detail === "object" && detail !== null) {
      const d = detail as { msg?: string };
      if (d.msg) return d.msg;
      try { return JSON.stringify(detail); } catch { return fallback; }
    }
  }

  // Axios error with status but no detail
  if (resp?.status) {
    return `Request failed (${resp.status})`;
  }

  // Standard Error object
  if (err instanceof Error) return err.message;

  // Last resort
  if (typeof err === "string") return err;

  return fallback;
}

export default api;
