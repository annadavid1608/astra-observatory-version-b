// ASTRA — LIVE WEATHER DATA (Open-Meteo, no API key required)
const ASTRA_LOCATION = {
  latitude: 49.2475,
  longitude: 7.3637,
  name: "Amerikastraße 1, 66482 Zweibrücken"
};

const compassDirections = [
  "N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
];

const byId = (id) => document.getElementById(id);

function getCompassDirection(degrees) {
  return compassDirections[Math.round(degrees / 22.5) % 16];
}

// Eigener ASTRA-Orientierungswert:
// 55 % Wolkenfreiheit, 30 % Sichtweite, 15 % Windkomfort.
// Er ist keine offizielle astronomische Kennzahl.
function calculateAstroScore(cloudCover, visibilityMeters, windKmh) {
  const cloudScore = Math.max(0, 100 - cloudCover);
  const visibilityScore = Math.min(100, (visibilityMeters / 30000) * 100);
  const windScore = Math.max(0, 100 - Math.max(0, windKmh - 8) * 4);

  return Math.round(
    cloudScore * 0.55 +
    visibilityScore * 0.30 +
    windScore * 0.15
  );
}

function describeScore(score) {
  if (score >= 80) return "Sehr gute Bedingungen";
  if (score >= 60) return "Gute Bedingungen";
  if (score >= 40) return "Durchwachsene Bedingungen";
  return "Schwierige Bedingungen";
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

async function loadAstraWeather() {
  const refreshButton = byId("refresh-button");
  const status = byId("api-status");

  if (refreshButton) refreshButton.disabled = true;
  if (status) {
    status.textContent = "LIVE DATA UPDATING";
    status.classList.remove("api-error");
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: ASTRA_LOCATION.latitude,
    longitude: ASTRA_LOCATION.longitude,
    current: "temperature_2m,cloud_cover,wind_speed_10m,wind_direction_10m",
    hourly: "visibility",
    forecast_days: "1",
    timezone: "Europe/Berlin"
  });

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`API-Fehler: ${response.status}`);

    const data = await response.json();
    const current = data.current;

    // Sichtweite ist stündlich. Es wird der Stundenwert verwendet,
    // der zeitlich am nächsten zur aktuellen Modellzeit liegt.
    const currentTime = new Date(current.time).getTime();
    let nearestIndex = 0;
    let smallestDifference = Infinity;

    data.hourly.time.forEach((time, index) => {
      const difference = Math.abs(new Date(time).getTime() - currentTime);
      if (difference < smallestDifference) {
        smallestDifference = difference;
        nearestIndex = index;
      }
    });

    const cloudCover = current.cloud_cover;
    const visibilityMeters = data.hourly.visibility[nearestIndex];
    const temperature = current.temperature_2m;
    const windSpeed = current.wind_speed_10m;
    const windDegrees = current.wind_direction_10m;
    const astroScore = calculateAstroScore(cloudCover, visibilityMeters, windSpeed);

    setText("astro-score", astroScore);
    setText("score-description", describeScore(astroScore));
    setText("cloud-cover", `${Math.round(cloudCover)} %`);
    setText(
      "visibility",
      visibilityMeters >= 1000
        ? `${(visibilityMeters / 1000).toFixed(1)} km`
        : `${Math.round(visibilityMeters)} m`
    );
    setText("temperature", `${temperature.toFixed(1)} °C`);
    setText("wind-direction", `${getCompassDirection(windDegrees)} ${Math.round(windDegrees)}°`);
    setText("wind-speed", `${windSpeed.toFixed(1)} km/h · WIND AT 10 M`);

    const scoreBar = byId("score-bar");
    if (scoreBar) scoreBar.style.width = `${astroScore}%`;

    const formattedTime = new Date(current.time).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short"
    });

    setText("updated-at", `Modellzeit: ${formattedTime}`);
    if (status) status.textContent = "LIVE DATA CONNECTED";
  } catch (error) {
    console.error("ASTRA: Wetterdaten konnten nicht geladen werden.", error);
    if (status) {
      status.textContent = "DATA CONNECTION FAILED";
      status.classList.add("api-error");
    }
    setText("updated-at", "Verbindung prüfen und erneut versuchen.");
    setText("score-description", "Aktuelle Daten nicht verfügbar");
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshButton = byId("refresh-button");
  if (refreshButton) refreshButton.addEventListener("click", loadAstraWeather);

  loadAstraWeather();

  // Alle 15 Minuten neue Daten abrufen.
  window.setInterval(loadAstraWeather, 15 * 60 * 1000);
});
