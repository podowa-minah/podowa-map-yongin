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
    .filter(n => n.irrigation && irrigationGroups(n.irrigation).length > 0)
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
  return notes.filter(n => n.irrigation && irrigationGroups(n.irrigation).length > 0).length;
}

export function countPest(notes) {
  if (!notes) return 0;
  return notes.filter(n => n.pest_treatment && (n.pest_treatment.chemical || n.pest_treatment.note)).length;
}

export function countJournal(notes) {
  if (!notes) return 0;
  return notes.filter(n => n.content && n.content.trim().length > 0).length;
}

// 관수 데이터 → 그룹 배열 [{ blocks:['1','2'], minutes:60 }, ...]
//   동마다 시간이 다를 수 있어 그룹으로 담는다. 옛 형태({blocks,duration_minutes})는 한 그룹으로 자동 호환.
export function irrigationGroups(irr) {
  if (!irr) return [];
  if (Array.isArray(irr.groups) && irr.groups.length) {
    return irr.groups.filter((g) => g && Array.isArray(g.blocks) && g.blocks.length);
  }
  if (irr.blocks?.length > 0) return [{ blocks: irr.blocks, minutes: irr.duration_minutes ?? null }];
  return [];
}

// 그룹들 → "1·2동 60분 · 3·4동 50분" (메모 제외)
export function irrigationGroupsText(irr) {
  return irrigationGroups(irr)
    .map((g) => `${g.blocks.join('·')}동${g.minutes ? ` ${g.minutes}분` : ''}`)
    .join(' · ');
}

// 그룹 배열 → 저장용 irrigation 객체.
//   groups가 진실이고, blocks(합집합)·duration_minutes(첫 그룹)는 하위호환용으로 함께 저장한다
//   (관수 존재 판정·옛 표시·CSV가 안 깨지게).
export function buildIrrigation(groups, note = '') {
  const clean = (groups || []).filter((g) => g && Array.isArray(g.blocks) && g.blocks.length);
  const union = [...new Set(clean.flatMap((g) => g.blocks))].sort((a, b) => Number(a) - Number(b));
  return {
    groups: clean,
    blocks: union,
    duration_minutes: clean[0]?.minutes ?? null,
    note: (note || '').trim(),
  };
}

// 관수 정보를 한 줄 요약 문자열로 (히스토리 카드/Excel용) — 그룹별로.
export function summarizeIrrigation(irr) {
  if (!irr) return '';
  const gtext = irrigationGroupsText(irr);
  if (irr.note) return gtext ? `${gtext} · ${irr.note}` : irr.note;
  return gtext;
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
