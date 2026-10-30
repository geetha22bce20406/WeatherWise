// ---------- helpers ----------
export const skyOf = (code, isDay = 1) => {
  if ([95, 96, 99].includes(code)) return "storm";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([45, 48].includes(code)) return "fog";
  if ([2, 3].includes(code)) return "cloudy";
  return isDay ? "clear-day" : "clear-night";
};

export const weatherInfo = (code, isDay = 1) => {
  if (code === 0) return ["Clear sky", isDay ? "☀️" : "🌙"];
  if ([1, 2].includes(code)) return ["Partly cloudy", isDay ? "🌤️" : "☁️"];
  if (code === 3) return ["Overcast", "☁️"];
  if ([45, 48].includes(code)) return ["Foggy", "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Drizzle", "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Rainy", "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Snowy", "❄️"];
  if ([95, 96, 99].includes(code)) return ["Thunderstorm", "⛈️"];
  return ["Weather update", "🌍"];
};

export const fmtHour = (t) => {
  const h = +t.slice(11, 13);
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
};
export const fmtClock = (t) => {
  const h = +t.slice(11, 13), m = t.slice(14, 16);
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
};
export const fmtDay = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });

export const aqiLabel = (v) => {
  if (v == null) return ["—", "info"];
  if (v <= 50) return ["Good", "good"];
  if (v <= 100) return ["Moderate", "info"];
  if (v <= 150) return ["Unhealthy for sensitive", "warn"];
  if (v <= 200) return ["Unhealthy", "bad"];
  return ["Very unhealthy", "bad"];
};

// next `n` hours starting from the place's *local* current hour
export function buildHours(data, n = 24) {
  const h = data.hourly;
  const now = data.current.time.slice(0, 13);
  let start = h.time.findIndex((t) => t.slice(0, 13) >= now);
  if (start < 0) start = 0;
  return h.time.slice(start, start + n).map((time, k) => {
    const i = start + k;
    return {
      time,
      temp: h.temperature_2m[i],
      pop: h.precipitation_probability[i] ?? 0,
      precip: h.precipitation[i] ?? 0,
      code: h.weather_code[i],
      wind: h.wind_speed_10m[i],
      hum: h.relative_humidity_2m[i],
      uv: h.uv_index[i] ?? 0,
    };
  });
}

const daytime = (h) => { const x = +h.time.slice(11, 13); return x >= 5 && x <= 20; };
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

// longest run of consecutive hours that satisfy `ok`
function bestWindow(hours, ok) {
  let best = null, cur = null;
  hours.forEach((h, i) => {
    if (ok(h)) {
      if (!cur) cur = { s: i, e: i };
      cur.e = i;
      if (!best || cur.e - cur.s > best.e - best.s) best = { ...cur };
    } else cur = null;
  });
  if (!best) return null;
  return `${fmtHour(hours[best.s].time)} – ${fmtHour(hours[Math.min(best.e + 1, hours.length - 1)].time)}`;
}

// ---------- alerts (used by bell + browser notifications) ----------
export function buildAlerts(data, hours) {
  const out = [];
  const c = data.current;
  const day = c.time.slice(0, 10);

  const rain = hours.slice(0, 4).find((h) => h.pop >= 60 || h.precip >= 0.5);
  if (rain)
    out.push({ id: `rain-${rain.time}`, level: "warn", icon: "🌧️", title: "Rain on the way",
      text: `${rain.pop}% chance around ${fmtHour(rain.time)}. Keep an umbrella handy.` });

  const storm = hours.slice(0, 12).find((h) => [95, 96, 99].includes(h.code));
  if (storm)
    out.push({ id: `storm-${day}`, level: "bad", icon: "⛈️", title: "Thunderstorm risk",
      text: `Storms possible around ${fmtHour(storm.time)}. Avoid open fields and tall trees.` });

  if (c.apparent_temperature >= 38)
    out.push({ id: `heat-${day}`, level: "bad", icon: "🥵", title: "Heat warning",
      text: `Feels like ${Math.round(c.apparent_temperature)}°C. Hydrate and avoid midday sun.` });

  if (c.wind_speed_10m >= 30)
    out.push({ id: `wind-${day}`, level: "warn", icon: "💨", title: "Strong winds",
      text: `Winds at ${Math.round(c.wind_speed_10m)} km/h. Secure loose items; careful on two-wheelers.` });

  const uv = Math.max(...hours.slice(0, 12).map((h) => h.uv));
  if (uv >= 8)
    out.push({ id: `uv-${day}`, level: "warn", icon: "🧴", title: "Very high UV",
      text: `UV index up to ${uv.toFixed(0)} today. Sunscreen, cap and shade between 11–3.` });

  if (!out.length)
    out.push({ id: `ok-${day}`, level: "good", icon: "✅", title: "All clear",
      text: "No weather alerts for the next few hours." });
  return out;
}

export function pushNotify(alerts, placeName) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem("ww_seen") || "[]"); } catch { /* ignore */ }
  alerts
    .filter((a) => a.level !== "good" && !seen.includes(a.id))
    .forEach((a) => new Notification(`${a.icon} ${a.title} · ${placeName}`, { body: a.text, tag: a.id }));
  localStorage.setItem("ww_seen", JSON.stringify([...seen, ...alerts.map((a) => a.id)].slice(-60)));
}

// ---------- goal engine ----------
const STAGE_TIPS = {
  Sowing: (x) => x.rain24 > 10
    ? ["warn", "Delay sowing", `~${x.rain24.toFixed(0)} mm rain due — seeds may wash out or rot. Wait for it to pass.`]
    : ["good", "Sowing looks fine", "Soil should stay workable over the next 24 hours."],
  Seedling: (x) => x.tmax >= 35
    ? ["warn", "Protect seedlings", "Heat can scorch young plants. Use shade nets and light evening irrigation."]
    : ["good", "Seedlings comfortable", "Temperatures are in a safe range for young plants."],
  Vegetative: (x) => x.rain24 < 5
    ? ["good", "Good fertiliser window", "No heavy rain expected — top-dressing won't be washed away."]
    : ["warn", "Hold fertiliser", "Rain may leach nutrients. Apply after it clears."],
  Flowering: (x) => x.wind >= 20 || x.pop >= 50
    ? ["warn", "Flowering at risk", "Wind and rain can knock off flowers and hurt pollination. Avoid spraying now."]
    : ["good", "Pollination friendly", "Calm, dry conditions help flowering and fruit set."],
  Harvest: (x) => x.pop >= 50
    ? ["bad", "Harvest early", "Rain likely. Harvest what you can and cover stored produce."]
    : ["good", "Harvest-friendly", "Dry spell ahead — good for harvesting and drying."],
};

export function goalPlan(goal, data, hours, farm) {
  const c = data.current, d = data.daily;
  const h12 = hours.slice(0, 12), h8 = hours.slice(0, 8);
  const rain24 = sum(hours, (h) => h.precip);
  const pop3 = Math.max(...hours.slice(0, 3).map((h) => h.pop));
  const items = [];
  let headline = "", window = null, windowLabel = "Best window";

  if (goal === "Farming") {
    const hot = d.temperature_2m_max[0] >= 38;
    windowLabel = "Best spray window";
    window = bestWindow(h12, (h) => daytime(h) && h.wind <= 15 && h.pop < 20 && h.temp <= 33);
    if (rain24 >= 5) items.push(["good", "Skip irrigation", `About ${rain24.toFixed(0)} mm of rain expected in 24h — let nature do the work.`]);
    else if (c.temperature_2m >= 33 && c.relative_humidity_2m < 50) items.push(["warn", "Irrigate early", "Hot and dry. Water at dawn or dusk to cut evaporation."]);
    else items.push(["info", "Check soil moisture", "Little rain ahead — dig a few cm down before irrigating."]);
    items.push(window
      ? ["good", "Spray window found", "Low wind and no rain — ideal for pesticide or foliar sprays."]
      : ["warn", "No clean spray window", "Wind or rain is too high in the next 12 hours. Hold off on spraying."]);
    if (hot) items.push(["bad", "Heat stress", `Max ${Math.round(d.temperature_2m_max[0])}°C today. Mulch, shade nets and extra water for sensitive crops.`]);
    if (c.relative_humidity_2m >= 85 && c.temperature_2m >= 20 && c.temperature_2m <= 32)
      items.push(["warn", "Fungal disease risk", "Warm and very humid — scout for blight and mildew."]);
    if (farm && STAGE_TIPS[farm.growthStage]) {
      const [t, title, text] = STAGE_TIPS[farm.growthStage]({ rain24, tmax: d.temperature_2m_max[0], wind: c.wind_speed_10m, pop: Math.max(...hours.slice(0, 24).map((h) => h.pop)) });
      items.unshift([t, `${farm.crop} · ${farm.growthStage}: ${title}`, text]);
    }
    headline = rain24 >= 5 ? "Rain will help your fields today" : "Plan field work around the dry hours";
  }

  if (goal === "Commute") {
    windowLabel = "Best time to leave";
    const best = h8.reduce((a, b) => (b.pop < a.pop ? b : a), h8[0]);
    window = fmtHour(best.time);
    items.push(pop3 >= 50
      ? ["warn", "Rain during your ride", `${pop3}% chance in the next 3 hours. Add 15–20 min and wear a raincoat.`]
      : ["good", "Dry roads ahead", "Low rain chance for the next few hours."]);
    if (c.wind_speed_10m >= 30) items.push(["warn", "Gusty for two-wheelers", `${Math.round(c.wind_speed_10m)} km/h wind — ride with care.`]);
    if (h8.some((h) => [45, 48].includes(h.code))) items.push(["warn", "Low visibility", "Fog expected. Use low beams and slow down."]);
    if (c.apparent_temperature >= 36) items.push(["warn", "Hot commute", "Carry water and avoid peak afternoon travel."]);
    headline = pop3 >= 50 ? "Leave a little earlier today" : "Smooth commute expected";
  }

  if (goal === "Travel") {
    windowLabel = "Best day to go";
    const idx = d.time.map((t, i) => ({ t, i, score: d.precipitation_probability_max[i] + Math.abs(27 - (d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2) * 2 }));
    const best = idx.reduce((a, b) => (b.score < a.score ? b : a), idx[0]);
    window = fmtDay(best.t);
    const avg = d.temperature_2m_max.reduce((a, b) => a + b, 0) / d.temperature_2m_max.length;
    const wet = d.precipitation_probability_max.filter((p) => p >= 50).length;
    items.push(["info", "7-day feel", `Average high ${Math.round(avg)}°C with ${wet} rainy day${wet === 1 ? "" : "s"}.`]);
    items.push(wet >= 3 ? ["warn", "Pack for rain", "Umbrella, quick-dry clothes and a plan B for indoor spots."] : ["good", "Mostly dry week", "Great for sightseeing — keep one indoor option just in case."]);
    if (d.uv_index_max[0] >= 7) items.push(["warn", "Strong sun", "Hat, sunglasses and sunscreen for daytime outings."]);
    headline = `${fmtDay(best.t)} looks like your best day`;
  }

  if (goal === "Outdoor") {
    windowLabel = "Best window";
    window = bestWindow(hours.slice(0, 14), (h) => daytime(h) && h.temp >= 18 && h.temp <= 33 && h.pop < 25 && h.uv < 8);
    items.push(window ? ["good", "Comfortable slot", "Mild temperature, low rain chance and manageable UV."] : ["warn", "Tricky day", "No fully comfortable slot — keep plans flexible."]);
    const uv = Math.max(...h12.map((h) => h.uv));
    items.push(uv >= 6 ? ["warn", "UV alert", `UV peaks at ${uv.toFixed(0)}. Avoid 11–3 or cover up.`] : ["good", "UV is gentle", "Low sun-burn risk right now."]);
    if (d.sunset?.[0]) items.push(["info", "Golden hour", `Sunset at ${fmtClock(d.sunset[0])} — best light for photos and walks.`]);
    headline = window ? "There's a good outdoor window today" : "Outdoor plans need care today";
  }
  return { headline, window, windowLabel, items };
}