// src/lib/journal.js
// 영농일지 — daily_notes 테이블의 type='journal' row 활용
// 순수 계산 함수만 (DB 호출, React 코드 없음)
// CLAUDE.md 섹션 10 — DB(daily_notes) → lib → components 3층 구조 따름

import { todayKST } from './treatment-cycles';

// 카테고리 키 + 라벨 + 컬러 (UI 일관성을 위해 lib에서 export)
export const JOURNAL_CATEGORIES = [
  { key: 'growth', label: '생육',   placeholder: '송이, 가지, 잎, 꽃 상태 변화...',                     color: '#16a34a', bg: '#f0fdf4', borderLight: '#bbf7d0' },
  { key: 'env',    label: '환경',   placeholder: '비, 바람, 토양, 하우스 내·외부 상태...',               color: '#0284c7', bg: '#eff6ff', borderLight: '#bfdbfe' },
  { key: 'pest',   label: '병해충', placeholder: '발견한 벌레/병해, 위치 (예: 3-2 함부르크 응애 초기)...', color: '#dc2626', bg: '#fef2f2', borderLight: '#fecaca' },
];

// 카테고리 빈 객체 (사진 array는 새로 만들어야 reference 공유 X)
export function emptyCategory() {
  return { note: '', image_urls: [], thumbnails: [] };
}

// row → journalNotes (없으면 빈 구조)
// 옛 env_indoor/env_outdoor 데이터가 있으면 env 안으로 흡수
export function readJournalNotes(row) {
  const jn = row?.journal_notes || {};
  // 옛 키(env_indoor/env_outdoor) → 새 env로 자동 통합
  let envData = { ...emptyCategory(), ...(jn.env || {}) };
  if (jn.env_indoor || jn.env_outdoor) {
    const parts = [];
    if (jn.env_indoor?.note) parts.push(`[내부] ${jn.env_indoor.note}`);
    if (jn.env_outdoor?.note) parts.push(`[외부] ${jn.env_outdoor.note}`);
    if (parts.length > 0 && !envData.note) envData.note = parts.join(' / ');
    const mergedImages = [
      ...(envData.image_urls || []),
      ...(jn.env_indoor?.image_urls || []),
      ...(jn.env_outdoor?.image_urls || []),
    ];
    const mergedThumbs = [
      ...(envData.thumbnails || []),
      ...(jn.env_indoor?.thumbnails || []),
      ...(jn.env_outdoor?.thumbnails || []),
    ];
    envData.image_urls = mergedImages;
    envData.thumbnails = mergedThumbs;
  }
  return {
    growth: { ...emptyCategory(), ...(jn.growth || {}) },
    env:    envData,
    pest:   { ...emptyCategory(), ...(jn.pest || {}) },
  };
}

// 카테고리에 실제 데이터(텍스트 또는 사진)가 있는지
export function categoryHasData(cat) {
  if (!cat) return false;
  if (cat.note && cat.note.trim().length > 0) return true;
  if (cat.image_urls && cat.image_urls.length > 0) return true;
  return false;
}

// row에 영농일지 데이터가 하나라도 있는지 (PODOWA 불 켜짐 판정)
//   - 한줄평 (content) 있음
//   - 또는 옛 image_urls 있음 (legacy)
//   - 또는 4 카테고리 중 어디든 데이터 있음
export function hasJournalData(row) {
  if (!row) return false;
  if (row.content && row.content.trim().length > 0) return true;
  if (row.image_urls && row.image_urls.length > 0) return true;
  if (row.journal_notes) {
    const jn = row.journal_notes;
    if (categoryHasData(jn.growth))      return true;
    if (categoryHasData(jn.env))         return true;
    if (categoryHasData(jn.env_indoor))  return true;   // legacy
    if (categoryHasData(jn.env_outdoor)) return true;   // legacy
    if (categoryHasData(jn.pest))        return true;
  }
  return false;
}

// 오늘 영농일지 있는지
export function hasJournalToday(rows) {
  if (!rows || rows.length === 0) return false;
  const today = todayKST();
  return rows.some(r => r.date === today && hasJournalData(r));
}

// 오늘 일지 row
export function getTodayJournal(rows) {
  if (!rows) return null;
  const today = todayKST();
  return rows.find(r => r.date === today) || null;
}
