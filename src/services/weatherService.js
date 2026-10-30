const GEOCODING_URL =
  "https://geocoding-api.open-meteo.com/v1/search";

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast";

const AIR_QUALITY_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

export async function fetchAll(location) {
  const query = String(location || "").trim();

  if (!query) {
    throw new Error("Please enter a city or farm location.");
  }

  const geoResponse = await fetch(
    `${GEOCODING_URL}?${new URLSearchParams({
      name: query,
      count: "10",
      language: "en",
      format: "json",
    })}`
  );

  if (!geoResponse.ok) {
    throw new Error("Location search failed. Please try again.");
  }

  const geo = await geoResponse.json();

  if (!geo.results?.length) {
    throw new Error(
      `Location "${query}" was not found. Try a district or state name.`
    );
  }

  const normalized = query.toLowerCase();

  const place =
    geo.results.find(
      (item) => item.name?.toLowerCase() === normalized
    ) || geo.results[0];

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),

    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "is_day",
    ].join(","),

    hourly: [
      "temperature_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "relative_humidity_2m",
      "uv_index",
    ].join(","),

    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "wind_speed_10m_max",
      "uv_index_max",
      "sunrise",
      "sunset",
    ].join(","),

    forecast_days: "7",
    timezone: "auto",
  });

  const airParams = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "us_aqi,pm2_5",
    timezone: "auto",
  });

  const [weatherResponse, airResponse] = await Promise.all([
    fetch(`${FORECAST_URL}?${params}`),
    fetch(`${AIR_QUALITY_URL}?${airParams}`).catch(() => null),
  ]);

  if (!weatherResponse.ok) {
    throw new Error("Weather data is unavailable. Please refresh.");
  }

  const data = await weatherResponse.json();

  if (!data.current || !data.hourly || !data.daily) {
    throw new Error("The weather service returned incomplete data.");
  }

  let aqi = null;

  try {
    if (airResponse?.ok) {
      const airData = await airResponse.json();
      aqi = airData.current || null;
    }
  } catch {
    // Air quality is optional.
  }

  return {
    place,
    data,
    aqi,
    fetchedAt: new Date().toISOString(),
  };
}