// src/components/WeatherDate.jsx
// 헤더 좌측 — 날짜 + 백암면 현재 날씨 (2개 미니 칩, 인벤토리 슬롯과 통일)

import React, { useState, useEffect } from 'react';

const WEATHER_EMOJI = {
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

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function WeatherDate({ onClick }) {
  const [weather, setWeather] = useState(null);

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayName = DAY_NAMES[kst.getUTCDay()];

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=37.1116&longitude=127.3475&current=temperature_2m,weather_code&timezone=Asia/Seoul'
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
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: '4px',
        marginLeft: '4px',                     /* Podowa 버튼 안쪽과 맞춤 */
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#92400e',
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1,
        letterSpacing: '0.2px',
      }}
    >
      <span style={{ fontSize: '0.82rem' }}>📅</span>
      <span>{month}/{day}</span>
      <span style={{ color: '#b45309', fontWeight: 700 }}>({dayName})</span>
      {weather && (
        <>
          <span style={{ color: '#c9b890', margin: '0 1px' }}>·</span>
          <span style={{ fontSize: '0.82rem' }}>{emoji}</span>
          <span style={{ color: '#78350f', fontWeight: 800 }}>{weather.temp}°</span>
        </>
      )}
    </span>
  );
}
