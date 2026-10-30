import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sprout, Car, Plane, Bell } from "lucide-react";
import Navbar from "../components/Navbar";
import { useApp } from "../context";
import { api } from "../api";

const POPULAR = ["Vijayawada", "Hyderabad", "Chennai", "Mumbai", "Delhi", "Bengaluru"];

export default function Home() {
  const [city, setCity] = useState("");
  const [saved, setSaved] = useState([]);
  const navigate = useNavigate();
  const { user } = useApp();

  useEffect(() => {
    if (!user) return;
    api.get("/locations").then((r) => setSaved(r.data)).catch(() => {});
  }, [user]);

  const go = (c) => c.trim() && navigate(`/dashboard?city=${encodeURIComponent(c.trim())}`);

  return (
    <div className="page">
      <Navbar />
      <main className="hero">
        <div className="hero-copy">
          <span className="pill">● Live • Open-Meteo • Free</span>
          <h1>Don't just check the weather. <em>Plan with it.</em></h1>
          <p className="lead">
            Hour-by-hour forecasts turned into decisions — when to spray, when to leave,
            when to head out — with alerts that reach you first.
          </p>

          <form className="hero-search glass" onSubmit={(e) => { e.preventDefault(); go(city); }}>
            <Search size={20} />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Search any city…" />
            <button className="btn-glow">Explore</button>
          </form>

          <div className="chips">
            {(saved.length ? saved.map((s) => s.city) : POPULAR).map((c) => (
              <button key={c} onClick={() => go(c)}>{saved.length ? "⭐ " : ""}{c}</button>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <div className="sun" />
          <div className="glass fcard c1"><Sprout size={18} /><b>Spray window</b><small>6 – 9 AM · low wind</small></div>
          <div className="glass fcard c2"><Car size={18} /><b>Leave by 5 PM</b><small>Rain after 6</small></div>
          <div className="glass fcard c3"><Bell size={18} /><b>Rain in 40 min</b><small>Notification sent</small></div>
          <div className="glass fcard c4"><Plane size={18} /><b>Fri is best</b><small>Weekend trip score 92</small></div>
        </div>
      </main>
    </div>
  );
}