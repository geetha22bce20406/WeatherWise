import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Trash2, Sprout, MapPin } from "lucide-react";
import Navbar from "../components/Navbar";
import { useApp } from "../context";
import { api, errMsg } from "../api";

const STAGES = ["Sowing", "Seedling", "Vegetative", "Flowering", "Harvest"];
const ACTIVITIES = ["Irrigation", "Spraying", "Fertilising", "Sowing", "Harvesting", "Weeding"];
const empty = { crop: "", growthStage: "Vegetative", activity: "Irrigation", location: "", soilType: "" };

export default function Space() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [farms, setFarms] = useState([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState("");

  const load = () =>
    Promise.all([api.get("/locations"), api.get("/farms")])
      .then(([l, f]) => { setCities(l.data); setFarms(f.data); })
      .catch((e) => setMsg(errMsg(e)));

  useEffect(() => { if (user) load(); }, [user]);
  if (!user) return <Navigate to="/auth" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const addFarm = async (e) => {
    e.preventDefault();
    try { await api.post("/farms", form); setForm(empty); setMsg("Farm profile saved ✔"); load(); }
    catch (err) { setMsg(errMsg(err)); }
  };
  const removeCity = async (id) => {
    try { await api.delete(`/locations/${id}`); load(); } catch (err) { setMsg(errMsg(err)); }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="wrap">
        <p className="eyebrow">MY SPACE</p>
        <h1 className="h1">Hello, <em>{user.name}</em></h1>
        {msg && <p className="toast-inline">{msg}</p>}

        <div className="bento">
          <section className="glass card s6">
            <h2><MapPin size={18} /> Saved cities</h2>
            {cities.length === 0 && <p className="muted">Nothing saved yet — tap the ☆ on any dashboard.</p>}
            <div className="saved-list">
              {cities.map((c) => (
                <div key={c.id} className="saved-item">
                  <button onClick={() => navigate(`/dashboard?city=${encodeURIComponent(c.city)}`)}>{c.city}</button>
                  <button className="icon-btn sm" onClick={() => removeCity(c.id)} aria-label="Remove"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </section>

          <section className="glass card s6">
            <h2><Sprout size={18} /> Farm profiles</h2>
            {farms.length === 0 && <p className="muted">Add your crop to unlock stage-specific farming advice.</p>}
            {farms.map((f) => (
              <div key={f.id} className="farm-row">
                <b>🌾 {f.crop}</b><span>{f.growthStage} · {f.activity}</span>
                <small>{[f.location, f.soilType].filter(Boolean).join(" · ")}</small>
              </div>
            ))}
          </section>

          <form className="glass card s12 farm-form" onSubmit={addFarm}>
            <h2>Add a farm profile</h2>
            <div className="form-grid">
              <input placeholder="Crop (e.g. Rice)" value={form.crop} onChange={set("crop")} required maxLength={80} />
              <select value={form.growthStage} onChange={set("growthStage")}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
              <select value={form.activity} onChange={set("activity")}>{ACTIVITIES.map((s) => <option key={s}>{s}</option>)}</select>
              <input placeholder="Location (optional)" value={form.location} onChange={set("location")} maxLength={100} />
              <input placeholder="Soil type (optional)" value={form.soilType} onChange={set("soilType")} maxLength={100} />
              <button className="btn-glow">Save profile</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}