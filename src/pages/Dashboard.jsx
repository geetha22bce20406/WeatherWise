import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, Tooltip } from "recharts";
import {
  RefreshCw, MapPin, Search, Star, Droplets, Wind, Sun, Gauge, Sprout, Plane,
  Car, Trees, BellRing, ExternalLink, Sunrise, Sunset, Leaf,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useApp } from "../context";
import { api, errMsg } from "../api";
import {
  skyOf, weatherInfo, buildHours, buildAlerts, goalPlan, pushNotify,
  fmtHour, fmtClock, fmtDay, aqiLabel,
} from "../insights";

async function fetchAll(cityName) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`
  );
  if (!geo.ok) throw new Error("City search is unavailable. Please try again.");
  const g = await geo.json();
  if (!g.results?.length) throw new Error(`We couldn't find "${cityName}". Check the spelling.`);
  const place = g.results.find((r) => r.name.toLowerCase() === cityName.toLowerCase()) || g.results[0];

  const wParams = new URLSearchParams({
    latitude: place.latitude, longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
    forecast_days: "7", timezone: "auto",
  });
  const [w, a] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${wParams}`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=us_aqi,pm2_5`).catch(() => null),
  ]);
  if (!w.ok) throw new Error("Weather data is unavailable right now. Try refreshing.");
  const data = await w.json();
  if (!data.current || !data.daily) throw new Error("The weather service returned incomplete data.");
  let aqi = null;
  try { if (a?.ok) aqi = (await a.json()).current; } catch { /* optional */ }
  return { place, data, aqi };
}

const GOALS = [
  { name: "Farming", icon: Sprout }, { name: "Commute", icon: Car },
  { name: "Travel", icon: Plane }, { name: "Outdoor", icon: Trees },
];

export default function Dashboard() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, setAlerts } = useApp();
  const city = params.get("city")?.trim() || "";

  const [q, setQ] = useState(city);
  const [wx, setWx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [goal, setGoal] = useState(localStorage.getItem("ww_goal") || "Farming");
  const [saved, setSaved] = useState(false);
  const [farm, setFarm] = useState(null);
  const [toast, setToast] = useState("");
  const [perm, setPerm] = useState("Notification" in window ? Notification.permission : "unsupported");

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async (name, silent = false) => {
    if (!name) { setError("Search for a city to see its weather."); setLoading(false); return; }
    if (!silent) { setLoading(true); setError(""); }
    try {
      const r = await fetchAll(name);
      setWx(r);
      localStorage.setItem("ww_last", r.place.name);
    } catch (e) {
      if (!silent) { setWx(null); setError(e.message || "Unable to load weather."); }
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { setQ(city); load(city); }, [city, load]);
  useEffect(() => {                       // silent refresh every 20 min
    if (!city) return;
    const t = setInterval(() => load(city, true), 20 * 60 * 1000);
    return () => clearInterval(t);
  }, [city, load]);

  const hours = useMemo(() => (wx ? buildHours(wx.data) : []), [wx]);
  const alerts = useMemo(() => (wx ? buildAlerts(wx.data, hours) : []), [wx, hours]);
  const plan = useMemo(() => (wx ? goalPlan(goal, wx.data, hours, farm) : null), [wx, hours, goal, farm]);

  useEffect(() => {                       // share alerts with navbar + browser notifications
    setAlerts(alerts);
    if (wx) pushNotify(alerts, wx.place.name);
  }, [alerts, wx, setAlerts]);

  const sky = wx ? skyOf(wx.data.current.weather_code, wx.data.current.is_day) : "default";
  useEffect(() => {
    document.body.dataset.sky = sky;
    return () => { document.body.dataset.sky = "default"; };
  }, [sky]);

  useEffect(() => {                       // saved? farm profile?
    if (!user || !wx) { setSaved(false); setFarm(null); return; }
    api.get("/locations").then((r) =>
      setSaved(r.data.some((l) => l.city.toLowerCase() === wx.place.name.toLowerCase()))).catch(() => {});
    api.get("/farms").then((r) => setFarm(r.data[0] || null)).catch(() => {});
  }, [user, wx]);

  const saveCity = async () => {
    if (!user) return navigate("/auth");
    try { await api.post("/locations", { city: wx.place.name }); setSaved(true); flash("City saved ⭐"); }
    catch (e) { if (e.response?.status === 409) setSaved(true); else flash(errMsg(e)); }
  };

  const enableNotifs = async () => {
    if (!("Notification" in window)) return flash("This browser doesn't support notifications.");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      new Notification("🔔 WeatherWise alerts on", { body: `You'll be notified about rain, heat and storms for ${wx.place.name}.` });
      localStorage.removeItem("ww_seen");
      pushNotify(alerts, wx.place.name);
    }
  };

  const pickGoal = (g) => { setGoal(g); localStorage.setItem("ww_goal", g); };
  const c = wx?.data.current, d = wx?.data.daily;
  const [cond, emoji] = c ? weatherInfo(c.weather_code, c.is_day) : ["", ""];
  const [aqiText, aqiTone] = aqiLabel(wx?.aqi?.us_aqi);
  const weekMin = d ? Math.min(...d.temperature_2m_min) : 0;
  const weekMax = d ? Math.max(...d.temperature_2m_max) : 1;
  const chart = hours.map((h) => ({ t: fmtHour(h.time), temp: Math.round(h.temp), rain: h.pop }));
  const nextRain = hours.find((h) => h.pop >= 50);

  return (
    <div className="page">
      <Navbar />
      <main className="wrap">
        <div className="toolbar">
          <form className="search-pill glass" onSubmit={(e) => { e.preventDefault(); q.trim() && navigate(`/dashboard?city=${encodeURIComponent(q.trim())}`); }}>
            <Search size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city…" />
          </form>
          {wx && (
            <button className={`icon-btn lg glass ${saved ? "on" : ""}`} onClick={saveCity} title="Save city">
              <Star size={18} fill={saved ? "currentColor" : "none"} />
            </button>
          )}
          <button className="icon-btn lg glass" onClick={() => load(city)} disabled={loading} title="Refresh">
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
        </div>

        {loading && <div className="glass status"><div className="loader" /><h2>Reading the sky…</h2></div>}
        {!loading && error && (
          <div className="glass status"><h2>We couldn't load the weather</h2><p className="muted">{error}</p>
            <button className="btn-glow" onClick={() => load(city)}>Try again</button></div>
        )}

        {!loading && wx && (
          <div className="bento">
            <section className="glass card s8 hero-card">
              <p className="loc"><MapPin size={15} /> {[wx.place.name, wx.place.admin1, wx.place.country].filter(Boolean).join(", ")}</p>
              <div className="temp-row">
                <span className="temp">{Math.round(c.temperature_2m)}°</span>
                <div><div className="emoji">{emoji}</div><div className="cond">{cond}</div></div>
              </div>
              <p className="summary">
                Feels like {Math.round(c.apparent_temperature)}° · H {Math.round(d.temperature_2m_max[0])}° L {Math.round(d.temperature_2m_min[0])}°
                {nextRain ? ` · Rain likely around ${fmtHour(nextRain.time)}` : " · No rain expected soon"}
              </p>
            </section>

            <section className="glass card s4 map-card">
              <MapContainer key={`${wx.place.latitude},${wx.place.longitude}`} center={[wx.place.latitude, wx.place.longitude]} zoom={9} scrollWheelZoom={false} zoomControl={false}>
                <TileLayer attribution="© OpenStreetMap" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <CircleMarker center={[wx.place.latitude, wx.place.longitude]} radius={9} pathOptions={{ color: "#fff", fillColor: "#38bdf8", fillOpacity: 1, weight: 3 }} />
              </MapContainer>
            </section>

            <Tile cls="s3" icon={<Droplets size={18} />} label="Humidity" value={`${c.relative_humidity_2m}%`} bar={c.relative_humidity_2m} />
            <Tile cls="s3" icon={<Wind size={18} />} label="Wind" value={`${Math.round(c.wind_speed_10m)} km/h`} bar={Math.min(c.wind_speed_10m * 2, 100)} />
            <Tile cls="s3" icon={<Sun size={18} />} label="UV today" value={d.uv_index_max[0].toFixed(0)} bar={d.uv_index_max[0] * 9} />
            <Tile cls="s3" icon={<Leaf size={18} />} label="Air quality" value={wx.aqi?.us_aqi ?? "—"} sub={aqiText} tone={aqiTone} bar={Math.min((wx.aqi?.us_aqi ?? 0) / 3, 100)} />

            <section className="glass card s8">
              <h2>Next 24 hours</h2>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.7} /><stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" tick={{ fill: "#a9b4c8", fontSize: 11 }} tickLine={false} axisLine={false} interval={3} />
                    <YAxis yAxisId="l" tick={{ fill: "#a9b4c8", fontSize: 11 }} tickLine={false} axisLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                    <YAxis yAxisId="r" orientation="right" hide domain={[0, 200]} />
                    <Tooltip contentStyle={{ background: "#0b1224", border: "1px solid #ffffff22", borderRadius: 12, color: "#fff" }}
                      formatter={(v, n) => (n === "temp" ? [`${v}°C`, "Temp"] : [`${v}%`, "Rain chance"])} />
                    <Bar yAxisId="r" dataKey="rain" fill="#38bdf8" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
                    <Area yAxisId="l" dataKey="temp" stroke="#fbbf24" strokeWidth={2.5} fill="url(#tg)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="legend"><i className="lg-t" /> Temperature <i className="lg-r" /> Rain chance</p>
            </section>

            <section className="glass card s4">
              <h2>Alerts</h2>
              {alerts.map((a) => (
                <div key={a.id} className={`alert-row ${a.level}`}><span>{a.icon}</span><div><b>{a.title}</b><small>{a.text}</small></div></div>
              ))}
              {perm !== "granted" && perm !== "unsupported" && (
                <button className="btn-ghost wide" onClick={enableNotifs} disabled={perm === "denied"}>
                  <BellRing size={16} /> {perm === "denied" ? "Blocked in browser settings" : "Turn on notifications"}
                </button>
              )}
              {perm === "granted" && <p className="muted tiny">🔔 Notifications on — checked every 20 min while this tab is open.</p>}
            </section>

            <section className="glass card s12">
              <div className="lens-head">
                <div><p className="eyebrow">WEATHER INTELLIGENCE</p><h2>{plan.headline}</h2></div>
                <div className="seg">
                  {GOALS.map(({ name, icon: Icon }) => (
                    <button key={name} className={goal === name ? "on" : ""} onClick={() => pickGoal(name)}><Icon size={15} /> {name}</button>
                  ))}
                </div>
              </div>

              {goal === "Farming" && (
                farm
                  ? <p className="muted">Personalised for 🌾 <b>{farm.crop}</b> · {farm.growthStage}. <Link to="/space">Edit</Link></p>
                  : <p className="muted">{user ? <Link to="/space">Add your crop</Link> : <Link to="/auth">Sign in</Link>} for crop-stage specific advice.</p>
              )}

              <div className="plan">
                {plan.window && <div className="window"><small>{plan.windowLabel}</small><b>{plan.window}</b></div>}
                <div className="insights">
                  {plan.items.map(([tone, title, text], i) => (
                    <div key={i} className={`insight ${tone}`}><i /><div><b>{title}</b><p>{text}</p></div></div>
                  ))}
                </div>
              </div>

              {goal === "Travel" && (
                <div className="links">
                  {[["Places to visit", "tourist+attractions+in"], ["Local food", "local+food+in"], ["Restaurants", "restaurants+in"]].map(([l, s]) => (
                    <a key={l} href={`https://www.google.com/maps/search/${s}+${encodeURIComponent(wx.place.name)}`} target="_blank" rel="noreferrer">{l} <ExternalLink size={13} /></a>
                  ))}
                </div>
              )}
            </section>

            <section className="glass card s12">
              <div className="lens-head"><h2>7-day outlook</h2>
                <small className="muted"><Sunrise size={14} /> {fmtClock(d.sunrise[0])} &nbsp; <Sunset size={14} /> {fmtClock(d.sunset[0])}</small></div>
              <div className="week">
                {d.time.map((day, i) => {
                  const lo = ((d.temperature_2m_min[i] - weekMin) / (weekMax - weekMin || 1)) * 100;
                  const hi = ((d.temperature_2m_max[i] - weekMin) / (weekMax - weekMin || 1)) * 100;
                  return (
                    <div className="day" key={day}>
                      <b>{i === 0 ? "Today" : fmtDay(day)}</b>
                      <span className="de">{weatherInfo(d.weather_code[i])[1]}</span>
                      <span className="rain-pct"><Droplets size={12} /> {d.precipitation_probability_max[i] ?? 0}%</span>
                      <span className="lo">{Math.round(d.temperature_2m_min[i])}°</span>
                      <div className="range"><i style={{ left: `${lo}%`, width: `${Math.max(hi - lo, 6)}%` }} /></div>
                      <span className="hi">{Math.round(d.temperature_2m_max[i])}°</span>
                    </div>
                  );
                })}
              </div>
            </section>
            <p className="s12 muted tiny center"><Gauge size={12} /> Data: Open-Meteo · Map: OpenStreetMap / CARTO. Advice is guidance — verify locally.</p>
          </div>
        )}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Tile({ cls, icon, label, value, sub, tone, bar }) {
  return (
    <div className={`glass card tile ${cls}`}>
      <span className="tile-l">{icon} {label}</span>
      <strong>{value}</strong>
      {sub && <small className={`tone-${tone}`}>{sub}</small>}
      <div className="meter"><i style={{ width: `${Math.max(4, Math.min(bar, 100))}%` }} /></div>
    </div>
  );
}