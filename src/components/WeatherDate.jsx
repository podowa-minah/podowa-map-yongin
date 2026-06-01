// src/components/WeatherDate.jsx
// 헤더 좌측 — 날짜 + 백암면 현재 날씨 (2개 미니 칩, 인벤토리 슬롯과 통일)

import React, { useState, useEffect } from 'react';
import { getSeasonalTerm, getSeasonalTermInfo } from '../lib/seasonalTerms';
import { getMoonPhase } from '../lib/moonPhase';
import { getMoonZodiac } from '../lib/zodiacMoon';
import MoonZodiacPopup from './MoonZodiacPopup';
import Constellation from './Constellation';
import DayTypeIcon from './DayTypeIcon';

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
  const [moonOpen, setMoonOpen] = useState(false);

  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const dayName = DAY_NAMES[kst.getUTCDay()];
  // ISO 날짜 (KST) — 절기/달모양 계산용
  const isoDate = `${kst.getUTCFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const termInfo = getSeasonalTermInfo(isoDate);
  const moon = getMoonPhase(isoDate);
  const zodiac = getMoonZodiac(isoDate);

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

      {/* 2줄: 달·별자리·절기 — 누르면 상세 팝업 */}
      {(moon || termInfo || zodiac) && (
        <button
          onClick={(e) => { e.stopPropagation(); setMoonOpen(true); }}
          className="info-card-seasonal"
          style={{
            background: 'none', border: 'none', padding: 0,
            cursor: 'pointer', textAlign: 'left',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center',
            gap: '0.35rem', flexWrap: 'wrap',
          }}
          aria-label="달·별자리 상세 보기"
        >
          {moon && (
            <>
              <span style={{ fontSize: '0.95rem' }}>{moon.emoji}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4b5563' }}>{moon.name}</span>
            </>
          )}
          {zodiac && (
            <>
              <span className="sep">·</span>
              <Constellation signName={zodiac.name} size={20} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4b5563' }}>{zodiac.name}</span>
              <span className="sep">·</span>
              <DayTypeIcon type={zodiac.dayType} size={14} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4b5563' }}>{zodiac.dayLabel}</span>
            </>
          )}
          {(moon || zodiac) && termInfo && <span className="sep">·</span>}
          {termInfo && (
            <>
              <span style={{ fontSize: '0.66rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.3px' }}>절기</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4b5563' }}>{termInfo.name}</span>
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>— {termInfo.meaning}</span>
            </>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#9ca3af' }}>ⓘ</span>
        </button>
      )}

      <MoonZodiacPopup
        open={moonOpen}
        onClose={() => setMoonOpen(false)}
        moon={moon} termInfo={termInfo} zodiac={zodiac}
        dateLabel={`${month}/${day} (${dayName})`}
      />
    </div>
  );
}
