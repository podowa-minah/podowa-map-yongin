import React, { useState, useEffect } from 'react';

// Weather code → emoji 매핑
const WEATHER_EMOJI = {
  0: '☀️',   // Clear sky
  1: '🌤️', 2: '⛅', 3: '☁️',  // Partly cloudy, cloudy
  45: '🌫️', 48: '🌫️',         // Fog
  51: '🌦️', 53: '🌦️', 55: '🌧️', // Drizzle
  56: '🌧️', 57: '🌧️',         // Freezing drizzle
  61: '🌧️', 63: '🌧️', 65: '🌧️', // Rain
  66: '🌧️', 67: '🌧️',         // Freezing rain
  71: '🌨️', 73: '🌨️', 75: '❄️', // Snow
  77: '❄️',                      // Snow grains
  80: '🌦️', 81: '🌧️', 82: '🌧️', // Rain showers
  85: '🌨️', 86: '🌨️',         // Snow showers
  95: '⛈️',                      // Thunderstorm
  96: '⛈️', 99: '⛈️',          // Thunderstorm with hail
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function WeatherDate() {
  const [weather, setWeather] = useState(null);

  // KST 날짜
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayName = DAY_NAMES[kst.getUTCDay()];
  const dateStr = `${month}월 ${day}일 (${dayName})`;

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=37.24&longitude=127.18&current=temperature_2m,weather_code&timezone=Asia/Seoul'
        );
        const data = await res.json();
        if (data.current) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weather_code,
          });
        }
      } catch (e) {
        console.error('Weather fetch error:', e);
      }
    }
    fetchWeather();
  }, []);

  const emoji = weather ? (WEATHER_EMOJI[weather.code] || '🌡️') : '';

  return (
    <span style={{
      fontSize: '0.75rem',
      color: '#666',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {dateStr}{weather ? ` ${emoji} ${weather.temp}°` : ''}
    </span>
  );
}
