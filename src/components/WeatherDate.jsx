// src/components/WeatherDate.jsx
// 헤더 좌측 — 날짜 + 백암면 현재 날씨 (2개 미니 칩, 인벤토리 슬롯과 통일)

import React, { useState, useEffect } from 'react';
import { getSeasonalTerm, getSeasonalTermInfo } from '../lib/seasonalTerms';
import { getMoonPhase } from '../lib/moonPhase';

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

export default function WeatherDate({ onClick, currentSeason }) {
  const [weather, setWeather] = useState(null);

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayName = DAY_NAMES[kst.getUTCDay()];
  // ISO 날짜 (KST) — 절기/달모양 계산용
  const isoDate = `${kst.getUTCFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const termInfo = getSeasonalTermInfo(isoDate);
  const moon = getMoonPhase(isoDate);

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
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* 1줄: 날짜 + 요일 + 날씨 + 현재 생육시기 */}
      <div className="info-card-date">
        <span>{month}/{day}</span>
        <span className="day">({dayName})</span>
        {weather && (
          <>
            <span className="sep">·</span>
            <span style={{ fontSize: '0.95rem' }}>{emoji}</span>
            <span className="temp">{weather.temp}°</span>
          </>
        )}
        {currentSeason && (
          <>
            <span className="sep">·</span>
            <span className="season-now">현재 {currentSeason}</span>
          </>
        )}
      </div>

      {/* 2줄: 달이름 + 절기 + 뜻 (기본 폰트, 작게) */}
      {(moon || termInfo) && (
        <div className="info-card-seasonal">
          {moon && (
            <>
              <span style={{ fontSize: '0.95rem' }}>{moon.emoji}</span>
              <span className="moon-name">{moon.name}</span>
            </>
          )}
          {moon && termInfo && <span className="sep">·</span>}
          {termInfo && <span className="name">{termInfo.name}</span>}
          {termInfo && <span className="meaning">— {termInfo.meaning}</span>}
        </div>
      )}
    </div>
  );
}
