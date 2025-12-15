const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.origin.includes(":5173")
    ? "http://127.0.0.1:8000"
    : window.location.origin || "http://127.0.0.1:8000");

export { API_BASE };
