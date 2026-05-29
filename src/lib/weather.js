// src/lib/weather.js
// 용인시 백암면 날씨 정보 — Open-Meteo API (무료, 키 불필요)
// 일별 날씨 상세 (최고/최저 온도, 일출, 일몰, 강수량 등)

// 용인시 처인구 백암면 위치
export const BAEKAM_LAT = 37.1116;
export const BAEKAM_LON = 127.3475;

// Weather code → emoji (WeatherDate.jsx 와 동일 매핑)
export const WEATHER_EMOJI = {
  0: '☀️',
  1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️',
  96: '⛈️', 99: '⛈️',
};

export const WEATHER_LABEL = {
  0: '맑음',
  1: '대체로 맑음', 2: '구름 조금', 3: '흐림',
  45: '안개', 48: '서리 안개',
  51: '약한 이슬비', 53: '이슬비', 55: '강한 이슬비',
  56: '어는 이슬비', 57: '강한 어는 이슬비',
  61: '약한 비', 63: '비', 65: '강한 비',
  66: '어는 비', 67: '강한 어는 비',
  71: '약한 눈', 73: '눈', 75: '강한 눈',
  77: '눈 알갱이',
  80: '소나기', 81: '강한 소나기', 82: '폭우',
  85: '약한 눈 소나기', 86: '강한 눈 소나기',
  95: '천둥번개',
  96: '우박 천둥', 99: '강한 우박 천둥',
};

// ISO datetime → "HH:MM" (KST 가정)
export function shortTime(iso) {
  if (!iso) return '';
  // "2026-05-28T05:23" 같은 형태
  const m = iso.match(/T(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

// 특정 날짜(YYYY-MM-DD)의 백암면 날씨 (일별 요약)
// 일별 습도 포함 — 백필 시에도 그날 정확한 습도 기록됨
export async function fetchDailyWeather(dateIso) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${BAEKAM_LAT}&longitude=${BAEKAM_LON}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean` +
    `&current=temperature_2m,weather_code,relative_humidity_2m` +
    `&timezone=Asia/Seoul` +
    `&start_date=${dateIso}&end_date=${dateIso}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();
  const d = data?.daily;
  const c = data?.current;
  if (!d) return null;
  return {
    tempMax: d.temperature_2m_max?.[0] != null ? Math.round(d.temperature_2m_max[0]) : null,
    tempMin: d.temperature_2m_min?.[0] != null ? Math.round(d.temperature_2m_min[0]) : null,
    code: d.weather_code?.[0] ?? null,
    precipitation: d.precipitation_sum?.[0] ?? 0,
    sunrise: shortTime(d.sunrise?.[0]),
    sunset: shortTime(d.sunset?.[0]),
    // 일별 습도 (그날 기록) — 백필 시에도 그날 실제 값
    humidityMax: d.relative_humidity_2m_max?.[0] != null ? Math.round(d.relative_humidity_2m_max[0]) : null,
    humidityMin: d.relative_humidity_2m_min?.[0] != null ? Math.round(d.relative_humidity_2m_min[0]) : null,
    humidityMean: d.relative_humidity_2m_mean?.[0] != null ? Math.round(d.relative_humidity_2m_mean[0]) : null,
    // 현재값 (오늘 일지 작성 시 "지금" 표시용)
    currentTemp: c?.temperature_2m != null ? Math.round(c.temperature_2m) : null,
    currentHumidity: c?.relative_humidity_2m ?? null,
  };
}
