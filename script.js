const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const QUICK_CITIES = ["Seoul", "Busan", "Jeju", "Toronto", "Zurich", "Dubai", "Mumbai"];

const WEATHER_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
  75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const submitBtn = form.querySelector("button");
const statusEl = document.getElementById("status");
const currentEl = document.getElementById("current");
const forecastEl = document.getElementById("forecast");
const daysEl = document.getElementById("days");

let chart = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service is not responding. Try again later.");
  return res.json();
}

async function findCity(name) {
  const data = await getJson(`${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=en`);
  if (!data.results || data.results.length === 0) {
    throw new Error(`City not found: "${name}". Check the spelling and try again.`);
  }
  return data.results[0];
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 5,
  });
  return getJson(`${WEATHER_URL}?${params}`);
}

function dayName(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function renderCurrent(place, data) {
  const c = data.current;
  document.getElementById("place").textContent =
    place.country ? `${place.name}, ${place.country}` : place.name;
  document.getElementById("condition").textContent = WEATHER_CODES[c.weather_code] || "—";
  document.getElementById("temp").textContent = `${Math.round(c.temperature_2m)}°C`;
  document.getElementById("humidity").textContent = `${c.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${c.wind_speed_10m} km/h`;
  currentEl.classList.remove("hidden");
}

function renderForecast(data) {
  const { time, temperature_2m_max: max, temperature_2m_min: min } = data.daily;
  const labels = time.map(dayName);

  daysEl.replaceChildren(
    ...time.map((_, i) => {
      const box = document.createElement("div");
      box.className = "day";
      const d = document.createElement("p");
      d.className = "d";
      d.textContent = labels[i];
      const hi = document.createElement("p");
      hi.className = "hi";
      hi.textContent = `${Math.round(max[i])}°`;
      const lo = document.createElement("p");
      lo.className = "lo";
      lo.textContent = `${Math.round(min[i])}°`;
      box.append(d, hi, lo);
      return box;
    })
  );

  forecastEl.classList.remove("hidden");

  if (typeof Chart === "undefined") return; // chart library failed to load; cards still show

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "High (°C)", data: max, borderColor: "#fb923c", backgroundColor: "#fb923c", tension: 0.3 },
        { label: "Low (°C)", data: min, borderColor: "#38bdf8", backgroundColor: "#38bdf8", tension: 0.3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#cbd5e1" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
      },
    },
  });
}

async function search(name) {
  const city = name.trim();
  if (!city) return;

  submitBtn.disabled = true;
  setStatus("Loading weather...");
  try {
    const place = await findCity(city);
    const data = await getForecast(place.latitude, place.longitude);
    renderCurrent(place, data);
    renderForecast(data);
    setStatus("");
    try { localStorage.setItem("lastCity", place.name); } catch {}
  } catch (err) {
    currentEl.classList.add("hidden");
    forecastEl.classList.add("hidden");
    const offline = err instanceof TypeError;
    setStatus(offline ? "Could not connect. Check your internet and try again." : err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  search(input.value);
});

const quick = document.getElementById("quick");
QUICK_CITIES.forEach((name) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = name;
  btn.addEventListener("click", () => {
    input.value = name;
    search(name);
  });
  quick.append(btn);
});

let last = "Seoul";
try { last = localStorage.getItem("lastCity") || last; } catch {}
input.value = last;
search(last);