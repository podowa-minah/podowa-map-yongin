// src/lib/moonPhase.js
// 달 모양 계산 — ISO 날짜 → 8단계 위상 (이모지 + 한국어 이름)
// 천문 정확도: synodic period 29.530588 day 기준, 오차 ±1일
// 기준: 알려진 신월(2000-01-06 18:14 UTC)

const PHASES = [
  { emoji: '🌑', name: '삭(그믐달)' },
  { emoji: '🌒', name: '초승달' },
  { emoji: '🌓', name: '상현달' },
  { emoji: '🌔', name: '차오르는 달' },
  { emoji: '🌕', name: '보름달' },
  { emoji: '🌖', name: '기우는 달' },
  { emoji: '🌗', name: '하현달' },
  { emoji: '🌘', name: '그믐 가까운 달' },
];

const SYNODIC = 29.530588;                         // 평균 삭망월(일)
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);

// ISO 날짜(YYYY-MM-DD, KST 기준) → { emoji, name }
export function getMoonPhase(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  // KST 정오 기준으로 평가 (UTC로는 03:00)
  const t = Date.UTC(y, m - 1, d, 3);
  const days = (t - KNOWN_NEW_MOON_UTC) / 86400000;
  const cyclePos = ((days / SYNODIC) % 1 + 1) % 1;  // 0~1
  const idx = Math.floor(cyclePos * 8 + 0.5) % 8;    // 가장 가까운 8분기
  return PHASES[idx];
}
