// src/lib/pest-colors.js
// 벌레/병 대표 색 — 지도에서 "무슨 벌레인지" 색으로 구분하기 위한 것. (minari: 색 직접 고르기)
//   · 저장: app_settings.pest_colors = JSON 문자열 { "응애": "#e08a12", ... }  (새 테이블 X — §11 기존 테이블 활용)
//   · 기본색: 이름으로 자동 배정(항상 같은 색) → 안 골라도 바로 구분됨. 고르면 덮어씀.
//   · 지도 진하기 = 점수(1 연함 → 5 원색). 같은 색의 명도 차이로.

// 고를 수 있는 색 — 밭에서 서로 구분 잘 되는 것들
export const COLOR_CHOICES = [
  '#d94f2b', // 빨강
  '#e08a12', // 주황
  '#c9a227', // 노랑
  '#4a9e3f', // 초록
  '#1f8a8a', // 청록
  '#2f6fd0', // 파랑
  '#7c3aed', // 보라
  '#b5407a', // 자주
  '#6b7280', // 회색
];

// 기본 배정 — 아는 이름은 고정 순서(서로 안 겹침), 커스텀은 이름 해시(항상 같은 색)
const KNOWN = ['깍지', '응애', '총채', '개각충', '흰가루병', '노균병', '잿빛곰팡이병'];
export function defaultColorFor(name) {
  const i = KNOWN.indexOf(name);
  if (i >= 0) return COLOR_CHOICES[i % COLOR_CHOICES.length];
  let h = 0;
  const s = String(name || '');
  for (let k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
  return COLOR_CHOICES[h % COLOR_CHOICES.length];
}

// 저장된 색(있으면) 아니면 기본색
export function colorOf(name, colors = {}) {
  return colors?.[name] || defaultColorFor(name);
}

// app_settings 값(문자열) → 객체. 깨져있어도 안전하게 {}.
export function readPestColors(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}

// 대표색 + 점수(1~5) → 지도에 칠할 색. 낮으면 연하게(흰색과 섞음), 5면 원색.
export function pestShade(baseHex, score) {
  const s = Math.max(1, Math.min(5, Number(score) || 1));
  const t = 0.25 + (s - 1) * 0.1875;   // 1 → 0.25(연함) … 5 → 1(원색)
  let hex = String(baseHex || '#d94f2b').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  if (!Number.isFinite(n)) return baseHex;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(255 + (c - 255) * t);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
