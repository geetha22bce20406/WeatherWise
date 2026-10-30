import { createContext, useContext, useState, useCallback } from "react";
import { api } from "./api";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ww_user")); }
    catch { return null; }
  });
  const [alerts, setAlerts] = useState([]);

  const saveSession = (d) => {
    const u = { name: d.name, email: d.email };
    localStorage.setItem("ww_token", d.token);
    localStorage.setItem("ww_user", JSON.stringify(u));
    setUser(u);
  };

  const login = async (email, password) =>
    saveSession((await api.post("/auth/login", { email, password })).data);

  const signup = async (name, email, password) =>
    saveSession((await api.post("/auth/signup", { name, email, password })).data);

  const logout = useCallback(() => {
    localStorage.removeItem("ww_token");
    localStorage.removeItem("ww_user");
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, login, signup, logout, alerts, setAlerts }}>
      {children}
    </Ctx.Provider>
  );
}