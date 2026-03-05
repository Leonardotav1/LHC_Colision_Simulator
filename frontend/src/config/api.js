const defaultApiUrl = "http://127.0.0.1:5000";

// Uses Vite env when available, with local backend fallback.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, "");

