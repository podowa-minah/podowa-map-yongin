// src/lib/zodiacMoon.js
// 달의 별자리(황도 12궁) 위치 + 생명역동농업(Maria Thun) 일자 타입
// CLAUDE.md §10: 순수 계산 (DOM/React 없음)
//
// 천문 정확도: 평균 운동 근사 (±1-2°). 생명역동 철학상 일자 구분에 충분.
// 포도와 농학적 의미는 마리아 툰 달력 + 포도 재배 관행 기반.

const SIGNS = [
  // 양/사자/사수 = 불 = 열매날
  // 황소/처녀/염소 = 흙 = 뿌리날
  // 쌍둥이/천칭/물병 = 공기 = 꽃날
  // 게/전갈/물고기 = 물 = 잎날
  { name: '양자리',     symbol: '♈', element: 'fire',  type: 'fruit'  },
  { name: '황소자리',   symbol: '♉', element: 'earth', type: 'root'   },
  { name: '쌍둥이자리', symbol: '♊', element: 'air',   type: 'flower' },
  { name: '게자리',     symbol: '♋', element: 'water', type: 'leaf'   },
  { name: '사자자리',   symbol: '♌', element: 'fire',  type: 'fruit'  },
  { name: '처녀자리',   symbol: '♍', element: 'earth', type: 'root'   },
  { name: '천칭자리',   symbol: '♎', element: 'air',   type: 'flower' },
  { name: '전갈자리',   symbol: '♏', element: 'water', type: 'leaf'   },
  { name: '사수자리',   symbol: '♐', element: 'fire',  type: 'fruit'  },
  { name: '염소자리',   symbol: '♑', element: 'earth', type: 'root'   },
  { name: '물병자리',   symbol: '♒', element: 'air',   type: 'flower' },
  { name: '물고기자리', symbol: '♓', element: 'water', type: 'leaf'   },
];

// 바이오다이내믹(생명역동농업) — 마리아 툰 + 포도 재배 관행
// 모두 무채색. 일자 그림은 별도 DayTypeIcon 컴포넌트에서 그림.
export const FRAMEWORK_NAME = '바이오다이내믹';
export const DAY_TYPE = {
  fruit: {
    emoji: '●',
    label: '열매의 날',
    color: '#1f2937',
    bg: '#e5e7eb',
    short: '포도가 가장 빛나는 날',
    grape: {
      do: ['수확', '당도·산도 측정', '시음', '병입', '꺾꽂이용 가지 채취'],
      avoid: ['잎·뿌리 작업은 효과 떨어진다고 봄'],
    },
  },
  root: {
    emoji: '▼',
    label: '뿌리의 날',
    color: '#1f2937',
    bg: '#e5e7eb',
    short: '땅·뿌리 일하는 날',
    grape: {
      do: ['토양 작업', '퇴비·비료', '가지치기(하현 권장)', '관수', '뿌리 환경 점검'],
      avoid: ['수확·시음·당도 측정은 다른 날 권장'],
    },
  },
  flower: {
    emoji: '❀',
    label: '꽃의 날',
    color: '#1f2937',
    bg: '#e5e7eb',
    short: '꽃·향기·수분 관찰',
    grape: {
      do: ['개화 관찰', '수분(꿀벌) 활동 확인', '향기 평가', '꽃송이 정리(적뢰)'],
      avoid: ['수확·뿌리·잎 작업은 다른 날'],
    },
  },
  leaf: {
    emoji: '▲',
    label: '잎의 날',
    color: '#1f2937',
    bg: '#e5e7eb',
    short: '잎·물 — 곰팡이 주의',
    grape: {
      do: ['잎 관찰(엽맥·두께·색)', '엽면시비', '습기 ↑ — 노균·잿빛곰팡이 모니터링'],
      avoid: ['수확·시음·당도 측정 회피', '습한 날엔 방제 시점 신중'],
    },
  },
};

// 그레고리력 → 율리우스일 (JD at 0h UT)
function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716))
       + Math.floor(30.6001 * (m + 1))
       + d + b - 1524.5;
}

// 날짜(YYYY-MM-DD) → 달의 별자리 + 일자 타입
export function getMoonZodiac(dateIso) {
  if (!dateIso) return null;
  const [y, m, d] = dateIso.split('-').map(Number);
  if (!y || !m || !d) return null;
  // KST 정오 기준 (UTC 03:00 = 0.125 일)
  const jd = julianDay(y, m, d) + 0.125;
  const daysSinceJ2000 = jd - 2451545.0;
  // 달 평균황경 — 천문 표준 공식 단순화
  let lon = (218.3164591 + 13.176396 * daysSinceJ2000) % 360;
  if (lon < 0) lon += 360;
  const sign = SIGNS[Math.floor(lon / 30)];
  const day = DAY_TYPE[sign.type];
  return {
    ...sign,
    longitude: lon,
    dayType: sign.type,
    dayLabel: day.label,
    dayEmoji: day.emoji,
    dayShort: day.short,
    dayColor: day.color,
    dayBg: day.bg,
    grape: day.grape,
  };
}
