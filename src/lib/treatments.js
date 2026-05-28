// src/lib/treatments.js
// 전체관수/전체방제 관련 순수 계산 함수
// CLAUDE.md 섹션 10 — DB(daily_notes) → lib → 컴포넌트 3층 구조
//
// 데이터 위치: daily_notes 테이블의 irrigation, pest_treatment jsonb 컬럼
//   irrigation     = { blocks: ['1','3'], duration_minutes: 30, note: '...' }
//   pest_treatment = { chemical: '보르도', dilution: '1000배', method: '연무기', note: '...' }

import { todayKST, daysSince } from './treatment-cycles';

// 행 목록에서 가장 최근 관수 기록한 날짜
export function getLastIrrigationDate(notes) {
  if (!notes || notes.length === 0) return null;
  const sorted = [...notes]
    .filter(n => n.irrigation && (n.irrigation.blocks?.length > 0 || n.irrigation.duration_minutes > 0))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
  return sorted[0]?.date || null;
}

// 가장 최근 방제 기록 날짜
export function getLastPestDate(notes) {
  if (!notes || notes.length === 0) return null;
  const sorted = [...notes]
    .filter(n => n.pest_treatment && (n.pest_treatment.chemical || n.pest_treatment.note))
    .sort((a, b) => (a.date > b.date ? -1 : 1));
  return sorted[0]?.date || null;
}

// 누적 횟수 (전체 시즌)
export function countIrrigation(notes) {
  if (!notes) return 0;
  return notes.filter(n => n.irrigation && (n.irrigation.blocks?.length > 0 || n.irrigation.duration_minutes > 0)).length;
}

export function countPest(notes) {
  if (!notes) return 0;
  return notes.filter(n => n.pest_treatment && (n.pest_treatment.chemical || n.pest_treatment.note)).length;
}

export function countJournal(notes) {
  if (!notes) return 0;
  return notes.filter(n => n.content && n.content.trim().length > 0).length;
}

// 관수 정보를 한 줄 요약 문자열로 (히스토리 카드/Excel용)
export function summarizeIrrigation(irr) {
  if (!irr) return '';
  const parts = [];
  if (irr.blocks?.length > 0) parts.push(`${irr.blocks.join('·')}동`);
  if (irr.duration_minutes) parts.push(`${irr.duration_minutes}분`);
  if (irr.note) parts.push(irr.note);
  return parts.join(' · ');
}

export function summarizePest(pest) {
  if (!pest) return '';
  const parts = [];
  if (pest.chemical) parts.push(pest.chemical);
  if (pest.dilution) parts.push(pest.dilution);
  if (pest.method) parts.push(pest.method);
  if (pest.note) parts.push(pest.note);
  return parts.join(' · ');
}

// 마지막 관수/방제로부터 경과일 + 간격 도래 여부
export function evaluateTreatmentCycle(lastDate, cycleDays) {
  const today = todayKST();
  if (!lastDate) {
    return { hasRecord: false, daysPassed: null, isDue: false, daysToNext: cycleDays };
  }
  const days = daysSince(lastDate, today);
  return {
    hasRecord: true,
    daysPassed: days,
    isDue: days >= cycleDays,
    daysToNext: Math.max(0, cycleDays - days),
  };
}
