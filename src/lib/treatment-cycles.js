// src/lib/treatment-cycles.js
// 관수/방제 사이클 계산 헬퍼
//
// 사용처:
//  - TreatmentStatusBar: 아이콘 강조 + 텍스트 ("3일차", "다음 4/29")
//  - 모달: 다음 권장일 계산
//
// CLAUDE.md 규칙: 순수 계산 함수 → src/lib/ 에 위치

// "YYYY-MM-DD" → Date (KST 자정 기준)
function toDateOnly(isoDate) {
  if (!isoDate) return null;
  return new Date(`${isoDate}T00:00:00+09:00`);
}

function todayKST() {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 일수 차이 (오늘 - 과거날짜)
function daysSince(pastIsoDate, todayIsoDate = todayKST()) {
  const past = toDateOnly(pastIsoDate);
  const today = toDateOnly(todayIsoDate);
  if (!past || !today) return null;
  const ms = today.getTime() - past.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// 권장 다음 시행일 = 마지막 시행일 + 사이클일
function nextRecommendedDate(lastIsoDate, cycleDays) {
  if (!lastIsoDate || !cycleDays) return null;
  const last = toDateOnly(lastIsoDate);
  last.setUTCDate(last.getUTCDate() + cycleDays);
  const yyyy = last.getUTCFullYear();
  const mm = String(last.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(last.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// "M/D" 짧은 표시
function formatMD(isoDate) {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

// 사이클 진행 상태 평가
//   { daysPassed, cycleDays, isDue (>= cycle), isOverdue (> cycle*1.5), nextDate }
export function evaluateCycle(lastIsoDate, cycleDays) {
  if (!lastIsoDate) {
    return {
      daysPassed: null,
      cycleDays,
      isDue: true,            // 기록 없으면 "할 때"로 간주
      isOverdue: false,
      nextDate: null,
      hasRecord: false,
    };
  }
  const daysPassed = daysSince(lastIsoDate);
  return {
    daysPassed,
    cycleDays,
    isDue: daysPassed >= cycleDays,
    isOverdue: daysPassed > cycleDays * 1.5,
    nextDate: nextRecommendedDate(lastIsoDate, cycleDays),
    hasRecord: true,
  };
}

export { todayKST, daysSince, nextRecommendedDate, formatMD };
