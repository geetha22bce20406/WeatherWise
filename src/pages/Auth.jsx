import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudSun, Mail, Lock, User } from "lucide-react";
import { useApp } from "../context";
import { errMsg } from "../api";

export default function Auth() {
  const { login, signup } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
      navigate("/space");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-art">
        <CloudSun size={54} />
        <h1>Weather that <em>knows</em> what you do.</h1>
        <p>Save cities, add your farm, and get alerts before the rain does.</p>
        <div className="float-chips">
          <span>🌾 Farm advice</span><span>🚗 Commute timing</span><span>🔔 Smart alerts</span>
        </div>
      </section>

      <form className="auth-card glass" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Create account</button>
        </div>

        {mode === "signup" && (
          <label className="field"><User size={17} />
            <input placeholder="Full name" value={form.name} onChange={set("name")} required maxLength={100} />
          </label>
        )}
        <label className="field"><Mail size={17} />
          <input type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        </label>
        <label className="field"><Lock size={17} />
          <input type="password" placeholder={mode === "signup" ? "Password (min 8 characters)" : "Password"}
            value={form.password} onChange={set("password")} required minLength={mode === "signup" ? 8 : 1} />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button className="btn-glow wide" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <p className="muted center">You can also use WeatherWise without an account — sign in to save cities and farms.</p>
      </form>
    </div>
  );
}