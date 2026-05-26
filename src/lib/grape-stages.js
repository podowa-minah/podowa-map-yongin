// src/lib/grape-stages.js
// 만개일(만개**) 기준 생육시기 자동 계산
//
// 시기 타이밍 (minari 시트 기준):
//   D-day = 만개일
//   D + 0~14일   : 4.착과기 (1차비대기)
//   D + 14~39일  : 5.경핵기 (25일)
//   D + 39~79일  : 6.성숙기 (2차비대기, 40일)
//   D + 79~119일 : 7.수확기 (성숙 후 40일 안에 수확)
//
// 만개 체크 위치: trees.season_data['3'].option6 = true
//   (SEASON_OPTION_LABELS[3] 의 마지막 항목 '만개**', index 5 → option6)

const BLOOM_OPTION_KEY = 'option6';  // 개화기 6번째 옵션 = 만개

export const STAGE_FROM_BLOOM = [
  { num: 4, name: '착과기',  startDay: 0,   endDay: 14,  durationDays: 14 },
  { num: 5, name: '경핵기',  startDay: 14,  endDay: 39,  durationDays: 25 },
  { num: 6, name: '성숙기',  startDay: 39,  endDay: 79,  durationDays: 40 },
  { num: 7, name: '수확기',  startDay: 79,  endDay: 119, durationDays: 40 },
];

export const HARVEST_DEADLINE_DAYS = 119;

// "YYYY-MM-DD" + n일 → "YYYY-MM-DD"
function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 두 ISO 날짜 사이 일수 (KST 자정 기준)
function daysBetweenISO(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00+09:00`);
  const to = new Date(`${toIso}T00:00:00+09:00`);
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

// history 배열에서 그 나무의 만개일(가장 이른 만개 체크 날짜) 찾기
//   history rows: { date, season, season_data, ... }
export function getBloomDateFromHistory(history) {
  if (!history || history.length === 0) return null;
  const bloomRows = history.filter(r => {
    const seasonState = r.season_data?.[r.season] || r.season_data?.[String(r.season)];
    return Number(r.season) === 3 && seasonState?.[BLOOM_OPTION_KEY] === true;
  });
  if (bloomRows.length === 0) return null;
  bloomRows.sort((a, b) => (a.date > b.date ? 1 : -1));
  return bloomRows[0].date;
}

// 만개일 기준 시기 타임라인
//   returns: { bloom, harvestEstimate, stages: [{num, name, start, end, durationDays}] }
export function getStageTimelineFromBloom(bloomIso) {
  if (!bloomIso) return null;
  const stages = STAGE_FROM_BLOOM.map(s => ({
    num: s.num,
    name: s.name,
    start: addDaysISO(bloomIso, s.startDay),
    end: addDaysISO(bloomIso, s.endDay),
    durationDays: s.durationDays,
  }));
  return {
    bloom: bloomIso,
    harvestEstimate: addDaysISO(bloomIso, HARVEST_DEADLINE_DAYS),
    stages,
  };
}

// 오늘 기준 현재 시기 (만개일 기반)
//   returns: { num, name, daysFromBloom, daysToEnd } | null (만개 전이면)
export function getCurrentStageFromBloom(bloomIso, todayIso) {
  if (!bloomIso) return null;
  const days = daysBetweenISO(bloomIso, todayIso);
  if (days < 0) return { num: 3, name: '개화기 (만개 전)', daysFromBloom: days, daysToEnd: null };
  for (const s of STAGE_FROM_BLOOM) {
    if (days >= s.startDay && days < s.endDay) {
      return { num: s.num, name: s.name, daysFromBloom: days, daysToEnd: s.endDay - days };
    }
  }
  return { num: 8, name: '수확 종료', daysFromBloom: days, daysToEnd: 0 };
}

// 짧은 표시
export function shortDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}
// last touched: 2026-05-26T16:26:09Z
