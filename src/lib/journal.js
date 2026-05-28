// src/lib/journal.js
// 영농일지 — daily_notes 테이블의 type='journal' row 활용
// 순수 계산 함수만 (DB 호출, React 코드 없음)
// CLAUDE.md 섹션 10 — DB(daily_notes) → lib → components 3층 구조 따름

import { todayKST } from './treatment-cycles';

// 오늘 영농일지가 있는지 (불 켜질지 결정)
export function hasJournalToday(journalNotes) {
  if (!journalNotes || journalNotes.length === 0) return false;
  const today = todayKST();
  return journalNotes.some(n => n.date === today);
}

// 오늘 영농일지 한 줄 가져오기 (있으면)
export function getTodayJournal(journalNotes) {
  if (!journalNotes || journalNotes.length === 0) return null;
  const today = todayKST();
  return journalNotes.find(n => n.date === today) || null;
}
