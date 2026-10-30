import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://weatherapp-backend-imds-psa3.onrender.com/api",
  timeout: 60000, // Increased to 60s to handle Render free tier cold starts (~50s)
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("ww_token");
  if (token && !cfg.url.startsWith("/auth")) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.startsWith("/auth")) {
      localStorage.removeItem("ww_token");
      localStorage.removeItem("ww_user");
      window.location.assign("/auth");
    }
    return Promise.reject(err);
  }
);

export const errMsg = (err, fallback = "Something went wrong.") =>
  err.response?.data?.message ||
  (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED"
    ? "Cannot reach the server. The free backend service may be waking up from inactivity (can take ~50 seconds)."
    : fallback);
