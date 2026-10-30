
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Sprout, Plane, Car, Trees, MapPin, Search, RefreshCw, CloudRain,
  Droplets, ShieldCheck, AlertTriangle,
  CheckCircle2, Info, ArrowRight, Clock3, Leaf, MapPinned, Mail,
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useApp } from "../context";
import { api, errMsg } from "../api";
import { fetchAll } from "../services/weatherService";
import { fmtDay, fmtHour, weatherInfo } from "../insights";
import "./Intelligence.css";

const MODES = [
  { id: "Farming", label: "Farm assistant", icon: Sprout, description: "Fieldwork, irrigation and crop-stage guidance" },
  { id: "Travel", label: "Travel planner", icon: Plane, description: "Choose weather-aware sightseeing windows" },
  { id: "Commute", label: "Commute", icon: Car, description: "Compare the next few hours before leaving" },
  { id: "Outdoor", label: "Outdoor plans", icon: Trees, description: "Find a comfortable window for activities" },
];

function makeAdvice(mode, wx, farm) {
  const { current: c, hourly: h, daily: d } = wx.data;
  const nowHour = String(c.time || "").slice(0, 13);

  let start = h.time.findIndex((time) => time.slice(0, 13) >= nowHour);
  if (start < 0) start = 0;

  const next24 = h.time.slice(start, start + 24).map((time, offset) => {
    const i = start + offset;
    return {
      time,
      temp: h.temperature_2m[i] ?? c.temperature_2m,
      rain: h.precipitation[i] ?? 0,
      pop: h.precipitation_probability[i] ?? 0,
      wind: h.wind_speed_10m[i] ?? c.wind_speed_10m,
      humidity: h.relative_humidity_2m[i] ?? c.relative_humidity_2m,
      uv: h.uv_index[i] ?? 0,
      code: h.weather_code[i] ?? c.weather_code,
    };
  });

  const rain24 = next24.reduce((total, hour) => total + hour.rain, 0);
  const maxPop24 = Math.max(0, ...next24.map((hour) => hour.pop));
  const maxWind24 = Math.max(0, ...next24.map((hour) => hour.wind));
  const maxTempToday = d.temperature_2m_max?.[0] ?? c.temperature_2m;

  const cards = [];
  let title = "Your weather plan is ready";
  let windowLabel = "Suggested window";
  let windowValue = "Review the forecast";

  const add = (level, heading, detail, reason = "") =>
    cards.push({ level, heading, detail, reason });

  const dayHours = next24.filter((x) => {
    const hour = Number(x.time.slice(11, 13));
    return hour >= 6 && hour <= 19;
  });

  const dryCalm = dayHours.filter(
    (x) => x.pop < 30 && x.rain < 0.5 && x.wind <= 18
  );

  const bestDry = dryCalm.find((x) => x.temp >= 16 && x.temp <= 34);

  if (mode === "Farming") {
    const crop = farm?.crop?.trim() || "your crop";
    const stage = farm?.growthStage || "Not specified";
    const soil = farm?.soilType || "not recorded";
    const activity = farm?.activity || "Field inspection";

    title = `${crop}: weather-aware field plan`;

    windowLabel =
      activity === "Spraying"
        ? "Potential spray-check window"
        : activity === "Irrigation"
        ? "Irrigation decision"
        : "Fieldwork window";

    if (rain24 >= 10 || maxPop24 >= 70) {
      add(
        "warning",
        "Check rainfall before fieldwork",
        `About ${rain24.toFixed(1)} mm of rain is forecast over the next 24 hours, with a peak hourly rain probability of ${maxPop24}%.`,
        "Rain can affect access to fields, irrigation timing, fertilizer loss and spray wash-off. Local soil conditions still matter."
      );
    } else if (rain24 < 2 && maxPop24 < 35) {
      add(
        "good",
        "No strong rain signal in the next day",
        `Forecast rainfall totals about ${rain24.toFixed(1)} mm over the next 24 hours.`,
        "Use this as a prompt to check actual soil moisture rather than automatically irrigating."
      );
    } else {
      add(
        "info",
        "Keep an eye on changing rain chances",
        `Forecast rainfall totals about ${rain24.toFixed(1)} mm, and the highest hourly rain probability is ${maxPop24}%.`,
        "Recheck the hourly forecast before committing to water-sensitive work."
      );
    }

    if (activity.toLowerCase().includes("spray")) {
      const sprayHour = dayHours.find(
        (x) => x.wind <= 10 && x.pop < 20 && x.rain < 0.2 && x.temp <= 32
      );

      windowValue = sprayHour ? fmtHour(sprayHour.time) : "No clear window found";

      if (sprayHour) {
        add(
          "good",
          "A lower-risk hour may be available",
          `${fmtHour(sprayHour.time)} has forecast wind around ${Math.round(sprayHour.wind)} km/h and rain probability ${sprayHour.pop}%.`,
          "Check the exact product label, local wind conditions and required rain-free period before spraying."
        );
      } else {
        add(
          "warning",
          "Do not rely on a generic spray window",
          "The next daytime hours do not meet this app's conservative low-wind, low-rain screening rule.",
          "This is a weather screen only; follow product-label restrictions and local agricultural advice."
        );
      }
    } else if (activity.toLowerCase().includes("irrig")) {
      windowValue = rain24 >= 5 ? "Reassess after rainfall" : "Check soil moisture first";

      add(
        "info",
        "Use field conditions to decide irrigation",
        soil === "not recorded"
          ? "Your soil type is not saved yet, so this plan cannot estimate how quickly the field drains or retains water."
          : `Recorded soil type: ${soil}. Soil moisture and drainage still need to be checked in the field.`,
        "Crop stage, root depth, soil moisture and irrigation method are needed for a reliable water decision."
      );
    } else if (activity.toLowerCase().includes("fertil")) {
      windowValue = rain24 >= 5 ? "Review rain timing first" : "Check crop schedule";

      add(
        rain24 >= 5 ? "warning" : "info",
        rain24 >= 5 ? "Potential nutrient-loss risk" : "Confirm the crop-specific schedule",
        rain24 >= 5
          ? `Rainfall of about ${rain24.toFixed(1)} mm is forecast in 24 hours. Consider whether this conflicts with the product and crop guidance.`
          : "The forecast alone cannot determine fertilizer type or dose. Use a soil-test-based and crop-stage-appropriate recommendation.",
        "Do not change fertilizer quantity based only on weather."
      );
    } else {
      windowValue = bestDry ? fmtHour(bestDry.time) : "Stay flexible";

      add(
        bestDry ? "good" : "warning",
        bestDry ? "Possible fieldwork window" : "No clearly comfortable daytime window",
        bestDry
          ? `${fmtHour(bestDry.time)} currently has ${bestDry.pop}% rain probability and wind around ${Math.round(bestDry.wind)} km/h.`
          : "Rain, wind or temperature conditions may make outdoor work less comfortable.",
        "Forecasts can change; check the field and local advisory before starting work."
      );
    }

    if (maxTempToday >= 36) {
      add(
        "warning",
        "Heat-stress check",
        `Today's forecast high is ${Math.round(maxTempToday)}°C.`,
        "Consider cooler work hours, drinking water and crop-specific heat-management guidance."
      );
    }

    if (maxWind24 >= 25) {
      add(
        "warning",
        "Wind may disrupt some farm activities",
        `Forecast wind reaches about ${Math.round(maxWind24)} km/h.`,
        "Avoid spraying when wind exceeds product-label limits and secure light materials."
      );
    }

    if (["Flowering", "Seedling"].includes(stage)) {
      add(
        "info",
        `Growth stage: ${stage}`,
        `The profile says ${crop} is at the ${stage.toLowerCase()} stage.`,
        "Stage-specific recommendations vary by crop and variety; use local extension guidance for decisions that affect yield."
      );
    }

    if (farm) {
      const soilText = String(farm.soilType || "").toLowerCase();
      const season = farm.season || "Not specified";
      const water = farm.waterAvailability || "Not specified";

      const catalogue = [
        {
          name: "Millets (sorghum / pearl millet)",
          soils: ["sandy", "loamy"],
          water: ["Low", "Medium", "Seasonal"],
          seasons: ["Kharif", "Year-round"],
          reason: "Often considered where water is limited; check local variety and sowing window.",
        },
        {
          name: "Groundnut",
          soils: ["sandy", "loamy"],
          water: ["Low", "Medium", "Seasonal"],
          seasons: ["Kharif", "Rabi"],
          reason: "Needs suitable drainage and a locally appropriate planting window.",
        },
        {
          name: "Pulses (green gram / black gram)",
          soils: ["sandy", "loamy"],
          water: ["Low", "Medium", "Seasonal"],
          seasons: ["Kharif", "Rabi", "Zaid"],
          reason: "Compare local crop duration, rainfall timing and drainage requirements.",
        },
        {
          name: "Maize",
          soils: ["loamy"],
          water: ["Medium", "High"],
          seasons: ["Kharif", "Rabi"],
          reason: "Needs a suitable planting window and reliable moisture through key growth stages.",
        },
        {
          name: "Paddy",
          soils: ["clay", "loamy"],
          water: ["High"],
          seasons: ["Kharif", "Rabi"],
          reason: "Water demand and local variety suitability must be confirmed before selection.",
        },
      ];

      const ranked = catalogue
        .map((item) => {
          let score = 0;

          if (soilText && item.soils.some((s) => soilText.includes(s))) score += 1;
          if (item.water.includes(water)) score += 1;

          if (
            item.seasons.includes(season) ||
            season === "Year-round" ||
            season === "Not sure" ||
            season === "Not specified"
          ) score += 1;

          return { ...item, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const cropIdeas = ranked
        .map((item) => `${item.name} — ${item.reason}`)
        .join(" ");

      add(
        "info",
        "Preliminary crops to compare",
        cropIdeas,
        `Screened using your saved season (${season}), soil (${farm.soilType || "not recorded"}) and water availability (${water}). These are not location-validated recommendations; confirm district-specific suitability, seed variety, soil test and market needs with a local agricultural extension service.`
      );
    }

    if (!farm) {
      add(
        "info",
        "Personalise this plan with a farm profile",
        "Add crop, growth stage, soil type, season, irrigation method and water availability in My Space.",
        "Without a farm profile, this page can only provide general weather-risk guidance."
      );
    }
  }

  if (mode === "Travel") {
    windowLabel = "Best-looking forecast day";

    const scored = (d.time || []).map((date, i) => {
      const max = d.temperature_2m_max?.[i] ?? 30;
      const min = d.temperature_2m_min?.[i] ?? 20;
      const pop = d.precipitation_probability_max?.[i] ?? 0;
      const wind = d.wind_speed_10m_max?.[i] ?? c.wind_speed_10m;

      const score =
        pop * 1.2 +
        Math.max(0, max - 32) * 3 +
        Math.max(0, 18 - min) +
        Math.max(0, wind - 25);

      return { date, max, min, pop, wind, score };
    });

    const best = scored.reduce(
      (winner, item) => (!winner || item.score < winner.score ? item : winner),
      null
    );

    windowValue = best ? fmtDay(best.date) : "Check forecast";
    title = "Plan your trip around the forecast";

    if (best) {
      add(
        "good",
        `${fmtDay(best.date)} looks comparatively better`,
        `High ${Math.round(best.max)}°C, low ${Math.round(best.min)}°C, rain probability up to ${best.pop}% and wind around ${Math.round(best.wind)} km/h.`,
        "This compares the available seven-day forecast only; it is not a guarantee of safe or dry conditions."
      );
    }

    const wetDays = scored.filter((day) => day.pop >= 50);

    add(
      wetDays.length ? "warning" : "info",
      wetDays.length ? "Keep an indoor backup" : "Keep plans flexible",
      wetDays.length
        ? `${wetDays.length} forecast day(s) have a maximum rain probability of 50% or more.`
        : "No day in the current forecast crosses a 50% maximum rain-probability threshold.",
      "Check the forecast again closer to travel, especially for dates near the end of the forecast range."
    );

    if (Math.max(0, ...(d.uv_index_max || [])) >= 7) {
      add(
        "warning",
        "Sun protection",
        "The forecast includes a high UV period. Carry sunscreen, a hat and water for outdoor sightseeing."
      );
    }
  }

  if (mode === "Commute") {
    windowLabel = "Next lower-rain hour";

    const candidate = next24.slice(0, 8).reduce(
      (winner, item) => (!winner || item.pop < winner.pop ? item : winner),
      null
    );

    windowValue = candidate ? fmtHour(candidate.time) : "Check hourly forecast";
    title = "A weather-aware commute check";

    const near = next24.slice(0, 3);
    const nearPop = Math.max(0, ...near.map((x) => x.pop));

    if (nearPop >= 50) {
      add(
        "warning",
        "Rain may affect the next few hours",
        `At least one of the next three forecast hours has rain probability up to ${nearPop}%.`,
        "Allow extra time and use appropriate rain protection; this app does not have live traffic or road-closure data."
      );
    } else {
      add(
        "good",
        "No strong immediate rain signal",
        `The highest rain probability in the next three hours is ${nearPop}%.`,
        "Continue to check local conditions before departure."
      );
    }

    if (c.wind_speed_10m >= 25) {
      add(
        "warning",
        "Wind caution",
        `Current wind speed is around ${Math.round(c.wind_speed_10m)} km/h.`,
        "Take extra care on two-wheelers and exposed roads."
      );
    }

    if (next24.slice(0, 8).some((x) => [45, 48].includes(x.code))) {
      add(
        "warning",
        "Fog is present in the forecast",
        "Fog can reduce visibility during some hours. Check actual visibility and local road conditions."
      );
    }

    if (c.apparent_temperature >= 36) {
      add(
        "info",
        "Heat-aware travel",
        `Feels-like temperature is around ${Math.round(c.apparent_temperature)}°C. Carry water and limit prolonged exposure.`
      );
    }
  }

  if (mode === "Outdoor") {
    title = "Find a more comfortable outdoor window";
    windowLabel = "First candidate window";

    const candidate = dayHours.find(
      (x) => x.temp >= 18 && x.temp <= 33 && x.pop < 25 && x.uv < 8 && x.wind < 25
    );

    windowValue = candidate ? fmtHour(candidate.time) : "No clear window found";

    if (candidate) {
      add(
        "good",
        "A potentially comfortable period",
        `${fmtHour(candidate.time)} is forecast at ${Math.round(candidate.temp)}°C, with ${candidate.pop}% rain probability and UV ${Math.round(candidate.uv)}.`,
        "This simple screen is a planning aid; personal comfort and local conditions can differ."
      );
    } else {
      add(
        "warning",
        "Keep the plan flexible",
        "No upcoming daytime hour meets all of the app's temperature, rain, wind and UV screening criteria.",
        "Consider a shorter activity, shade or an indoor alternative."
      );
    }

    const uv = Math.max(0, ...next24.map((x) => x.uv));

    if (uv >= 6) {
      add(
        "warning",
        "Sun protection recommended",
        `Forecast UV reaches ${Math.round(uv)}.`,
        "Use shade, sun protection and water during exposed hours."
      );
    }

    if (maxTempToday >= 36) {
      add(
        "warning",
        "Hot conditions",
        `Today's forecast high is ${Math.round(maxTempToday)}°C.`,
        "Avoid strenuous activity during the hottest part of the day."
      );
    }
  }

  const summary = wx.place.admin1
    ? wx.place.name + ", " + wx.place.admin1
    : wx.place.name;

  return { title, windowLabel, windowValue, cards, summary };
}

export default function Intelligence() {
  const { user } = useApp();

  const [mode, setMode] = useState("Farming");
  const [placeInput, setPlaceInput] = useState(
    localStorage.getItem("ww_last") || "Vijayawada"
  );
  const [wx, setWx] = useState(null);
  const [farms, setFarms] = useState([]);
  const [farmId, setFarmId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [mailStatus, setMailStatus] = useState("");
  const [mailBusy, setMailBusy] = useState(false);

  useEffect(() => {
    if (!user) return;

    api.get("/farms")
      .then((response) => {
        const list = Array.isArray(response.data) ? response.data : [];
        setFarms(list);

        if (list.length) {
          setFarmId(String(list[0].id));

          const farmLocation = list[0].location?.trim();

          if (farmLocation) {
            setPlaceInput(farmLocation);

            fetchAll(farmLocation)
              .then((weather) => setWx(weather))
              .catch(() => {
                setProfileMessage(
                  "Farm location could not be resolved. Check the location field in My Space."
                );
              });
          }
        }
      })
      .catch((err) =>
        setProfileMessage(errMsg(err, "Farm profiles could not be loaded."))
      );
  }, [user]);

  const selectedFarm = useMemo(
    () => farms.find((farm) => String(farm.id) === String(farmId)) || null,
    [farms, farmId]
  );

  const runAnalysis = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await fetchAll(placeInput);
      setWx(result);
      localStorage.setItem("ww_last", result.place.name);
    } catch (err) {
      setError(err.message || "Could not analyse this location.");
      setWx(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchAll(placeInput)
      .then((result) => {
        if (cancelled) return;
        setWx(result);
        localStorage.setItem("ww_last", result.place.name);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not analyse this location.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Initial request uses the location saved from the dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeMeta = MODES.find((item) => item.id === mode) || MODES[0];

  const advice = useMemo(
    () => wx ? makeAdvice(mode, wx, selectedFarm) : null,
    [mode, wx, selectedFarm]
  );

  const emailMyPlan = async () => {
    if (!user || !wx || !advice) return;

    setMailBusy(true);
    setMailStatus("");

    try {
      const message = advice.cards
        .map((card) => `${card.heading}: ${card.detail}`)
        .join("\n\n");

      await api.post("/notifications/weather-alert", {
        city: wx.place.name,
        message: `${modeMeta.label}\n\n${message}`,
      });

      setMailStatus(`Plan sent to ${user.email}.`);
    } catch (err) {
      setMailStatus(
        errMsg(err, "Email could not be sent. Check SMTP configuration.")
      );
    } finally {
      setMailBusy(false);
    }
  };

  // Protect this page from users who are not signed in.
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="page intelligence-page">
      <Navbar />

      <main className="wrap intelligence-wrap">
        <header className="intelligence-heading">
          <p className="eyebrow">WEATHERWISE DECISION STUDIO</p>
          <h1 className="h1">Weather, with a <em>purpose.</em></h1>
          <p className="intelligence-lead">
            Turn the forecast into a practical plan for your farm, trip, commute or outdoor day.
            Every suggestion explains what it is based on.
          </p>
        </header>

        <section className="intelligence-controls glass">
          <form className="intelligence-search" onSubmit={runAnalysis}>
            <MapPin size={19} aria-hidden="true" />
            <input
              value={placeInput}
              onChange={(event) => setPlaceInput(event.target.value)}
              placeholder="Enter a city, district or farm location"
              aria-label="Location"
            />
            <button className="btn-glow" type="submit" disabled={loading}>
              <Search size={16} />
              {loading ? "Checking…" : "Analyse"}
            </button>
          </form>

          <div className="mode-grid" role="tablist" aria-label="Weather intelligence mode">
            {MODES.map(({ id, label, icon: Icon, description }) => (
              <button
                type="button"
                key={id}
                role="tab"
                aria-selected={mode === id}
                className={"mode-card " + (mode === id ? "selected" : "")}
                onClick={() => setMode(id)}
              >
                <span className="mode-icon"><Icon size={21} /></span>
                <span className="mode-copy">
                  <b>{label}</b>
                  <small>{description}</small>
                </span>
                <ArrowRight className="mode-arrow" size={16} />
              </button>
            ))}
          </div>
        </section>

        {profileMessage && (
          <p className="intelligence-notice">
            <Info size={16} /> {profileMessage}
          </p>
        )}

        {loading && (
          <section className="glass intelligence-state">
            <RefreshCw className="spin" size={24} />
            <h2>Reading the latest forecast…</h2>
            <p>Checking weather conditions for {placeInput || "your location"}.</p>
          </section>
        )}

        {!loading && error && (
          <section className="glass intelligence-state error-state">
            <AlertTriangle size={26} />
            <h2>We couldn't build your plan</h2>
            <p>{error}</p>
            <button className="btn-glow" onClick={runAnalysis}>Try again</button>
          </section>
        )}

        {!loading && !error && wx && advice && (
          <>
            <section className="intelligence-overview">
              <div className="overview-main glass">
                <div className="overview-topline">
                  <span className="live-dot" />
                  Forecast-backed plan
                  <span className="overview-place">
                    <MapPinned size={14} /> {advice.summary}
                  </span>
                </div>

                <h2>{advice.title}</h2>

                <p>
                  Current conditions: {Math.round(wx.data.current.temperature_2m)}°C,
                  feels like {Math.round(wx.data.current.apparent_temperature)}°C,
                  humidity {wx.data.current.relative_humidity_2m}%,
                  wind {Math.round(wx.data.current.wind_speed_10m)} km/h.
                </p>

                <div className="overview-foot">
                  <span>
                    <Clock3 size={14} />
                    Retrieved {new Date(wx.fetchedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span><ShieldCheck size={14} /> Forecast guidance, not a guarantee</span>
                </div>
              </div>

              <div className="overview-window glass">
                <span>{advice.windowLabel}</span>
                <strong>{advice.windowValue}</strong>
                <small>Recheck conditions before acting</small>
              </div>
            </section>

            {mode === "Farming" && (
              <section className="glass farm-selector">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">YOUR FARM CONTEXT</p>
                    <h2>Make this advice about your field</h2>
                  </div>
                  <Sprout size={24} />
                </div>

                {farms.length === 0 ? (
                  <p>
                    No farm profile yet. Add one in My Space so recommendations can use your crop and activity.
                    <Link to="/space">Create farm profile <ArrowRight size={14} /></Link>
                  </p>
                ) : (
                  <div className="farm-context-row">
                    <label className="farm-select-label">
                      Selected farm
                      <select
                        value={farmId}
                        onChange={(event) => {
                          setFarmId(event.target.value);
                          const nextFarm = farms.find(
                            (farm) => String(farm.id) === event.target.value
                          );
                          if (nextFarm?.location?.trim()) {
                            setPlaceInput(nextFarm.location.trim());
                          }
                        }}
                      >
                        {farms.map((farm) => (
                          <option key={farm.id} value={String(farm.id)}>
                            {farm.crop}{farm.location ? " — " + farm.location : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedFarm && (
                      <div className="farm-tags">
                        <span><Leaf size={13} /> {selectedFarm.crop}</span>
                        <span>{selectedFarm.growthStage || "Stage not set"}</span>
                        <span>{selectedFarm.activity || "Activity not set"}</span>
                        <span>{selectedFarm.soilType || "Soil not recorded"}</span>
                        <span>{selectedFarm.season || "Season not set"}</span>
                        <span>{selectedFarm.irrigationMethod || "Irrigation not set"}</span>
                        <span>{selectedFarm.waterAvailability || "Water not set"} water</span>
                      </div>
                    )}

                    <Link className="text-link" to="/space">
                      Edit profile <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </section>
            )}

            <section className="advice-section">
              <div className="section-title">
                <div>
                  <p className="eyebrow">YOUR ACTION PLAN</p>
                  <h2>{modeMeta.label}</h2>
                </div>
                <span className="advice-count">{advice.cards.length} insights</span>
              </div>

              <div className="advice-grid">
                {advice.cards.map((card, index) => {
                  const Icon =
                    card.level === "good"
                      ? CheckCircle2
                      : card.level === "warning"
                      ? AlertTriangle
                      : Info;

                  return (
                    <article
                      className={"advice-card " + card.level}
                      key={card.heading + "-" + index}
                    >
                      <div className="advice-icon"><Icon size={20} /></div>
                      <div>
                        <h3>{card.heading}</h3>
                        <p>{card.detail}</p>
                        {card.reason && (
                          <div className="why">
                            <b>Why it matters</b>
                            <span>{card.reason}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="glass forecast-strip">
              <div className="section-title">
                <div>
                  <p className="eyebrow">NEXT 7 DAYS</p>
                  <h2>Forecast at a glance</h2>
                </div>
                <CloudRain size={24} />
              </div>

              <div className="forecast-days">
                {wx.data.daily.time.map((day, index) => {
                  const [condition, icon] = weatherInfo(wx.data.daily.weather_code[index]);

                  return (
                    <div className="forecast-day" key={day}>
                      <b>{index === 0 ? "Today" : fmtDay(day)}</b>
                      <span className="forecast-emoji">{icon}</span>
                      <small>{condition}</small>
                      <strong>{Math.round(wx.data.daily.temperature_2m_max[index])}°</strong>
                      <span className="forecast-low">
                        {Math.round(wx.data.daily.temperature_2m_min[index])}° low
                      </span>
                      <span className="forecast-rain">
                        <Droplets size={13} />
                        {wx.data.daily.precipitation_probability_max[index] ?? 0}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {mode === "Travel" && (
              <section className="glass travel-planner-cta">
                <div>
                  <p className="eyebrow">DETAILED TRIP BUILDER</p>
                  <h2>Planning more than one destination?</h2>
                  <p>
                    Add multiple stops and travel dates, then review destination forecasts and packing suggestions.
                  </p>
                </div>
                <Link className="btn-glow" to="/travel-planner">
                  <Plane size={16} /> Open trip planner <ArrowRight size={15} />
                </Link>
              </section>
            )}

            <section className="glass email-plan-card">
              <div>
                <b>Email this {modeMeta.label.toLowerCase()} plan</b>
                <small>We send it to your signed-in account email: {user.email}</small>
                {mailStatus && <small className="email-plan-status">{mailStatus}</small>}
              </div>

              <button
                className="btn-glow"
                onClick={emailMyPlan}
                disabled={mailBusy}
              >
                <Mail size={16} />
                {mailBusy ? "Sending…" : "Email my plan"}
              </button>
            </section>

            {mode === "Travel" && (
              <section className="travel-links">
                <a
                  href={"https://www.google.com/maps/search/tourist+attractions+in/" + encodeURIComponent(wx.place.name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Plane size={17} /> Explore attractions in {wx.place.name}
                </a>
                <a
                  href={"https://www.google.com/maps/search/restaurants+in/" + encodeURIComponent(wx.place.name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={17} /> Find places to eat
                </a>
              </section>
            )}

            <p className="intelligence-disclaimer">
              <ShieldCheck size={15} />
              WeatherWise uses Open-Meteo forecast data. Farm advice is a planning aid, not a substitute for local agricultural extension advice, soil testing or product labels.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
