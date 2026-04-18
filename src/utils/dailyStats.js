// src/utils/dailyStats.js
// 날짜별 작업 통계 계산 유틸리티 (히스토리 + 내일 예상 + 자동저장)

const ROWS = 25;
const COLS = 8;

/** KST 오늘 날짜 문자열 (YYYY-MM-DD) */
export function getKSTToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 날짜 문자열에서 N일 이동 */
export function offsetDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 달력 날짜 기준 경과일 (KST, 시간 무시) */
function daysSinceKST(targetDate, refDate) {
  const [ty, tm, td] = refDate.split('-').map(Number);
  const [y, m, d] = targetDate.split('-').map(Number);
  return (new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86400000;
}

/**
 * 특정 날짜 기준 작업 통계 계산
 * @param {Object} treeData - { "1-1": [records], ... }
 * @param {Object} labels - { "Tree-1-1": { disabled, ... }, ... }
 * @param {string} simDate - 시뮬레이션 대상 날짜 (YYYY-MM-DD)
 * @returns {{ completed, total, green_dots, workers }}
 */
export function computeStatsForDate(treeData, labels, simDate) {
  const yStr = offsetDate(simDate, -1);

  let completed = 0;
  let totalLit = 0;
  let greenDots = 0;
  const workerCounts = {};

  for (let c = 1; c <= COLS; c++) {
    for (let r = 1; r <= ROWS; r++) {
      const labelId = `Tree-${c}-${r}`;
      const numericId = `${c}-${r}`;
      const lbl = labels[labelId] || {};
      if (lbl.disabled) continue;

      const records = treeData[numericId] || [];

      // simDate 당일 기록
      const hasTodayRecord = records.some(rec => rec.date === simDate);
      if (hasTodayRecord) {
        greenDots++;
        records.forEach(rec => {
          if (rec.date === simDate && rec.producer) {
            workerCounts[rec.producer] = (workerCounts[rec.producer] || 0) + 1;
          }
        });
      }

      // simDate 이전 기록만, 최신순 정렬
      const recsBefore = records
        .filter(rec => rec.date < simDate)
        .sort((a, b) => b.date.localeCompare(a.date));

      let anyLightOn = false;

      if (recsBefore.length === 0) {
        // 기록 없음 → 시계불 ON
        anyLightOn = true;
      } else {
        // 나무: 어제 세력 1,5 또는 균형 1,2
        const yRec = recsBefore.find(rec => rec.date === yStr);
        if (yRec) {
          const p = String(yRec.power);
          const b = String(yRec.balance);
          if (['1', '5'].includes(p) || ['1', '2'].includes(b)) anyLightOn = true;
        }

        // 벌레: 최신 벌레 기록 기준
        if (!anyLightOn) {
          const bugRec = recsBefore.find(rec => rec.bugs != null && rec.bugs !== '');
          if (bugRec) {
            const score = Number(bugRec.bugs);
            const days = daysSinceKST(bugRec.date, simDate);
            if ((score >= 4 && days >= 1) ||
                (score >= 2 && score <= 3 && days >= 3) ||
                (score <= 1 && days >= 4)) {
              anyLightOn = true;
            }
          }
        }

        // 시계: 5일간 세력/균형 없으면
        if (!anyLightOn) {
          const scoreRec = recsBefore.find(rec =>
            (rec.power != null && rec.power !== '') ||
            (rec.balance != null && rec.balance !== '')
          );
          if (scoreRec) {
            if (daysSinceKST(scoreRec.date, simDate) >= 5) anyLightOn = true;
          } else {
            anyLightOn = true;
          }
        }
      }

      if (anyLightOn) {
        if (hasTodayRecord) completed++;
        totalLit++;
      }
    }
  }

  const workers = Object.entries(workerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return { completed, total: totalLit, green_dots: greenDots, kind_dots: greenDots - completed, workers };
}

/**
 * 내일 예상 (오늘 불 켜진 나무 전부 입력했다고 가정)
 * @param {Object} treeData
 * @param {Object} labels
 * @param {Set} litTreeIds - 현재 불 켜진 나무 ID Set
 * @returns {{ total, workers: [] }}
 */
export function computeTomorrowPrediction(treeData, labels, litTreeIds) {
  const today = getKSTToday();
  const tomorrow = offsetDate(today, 1);

  // 현재 불 켜진 나무에 오늘 기록 추가 (가짜)
  const augmented = {};
  for (const key of Object.keys(treeData)) {
    augmented[key] = [...treeData[key]];
  }
  for (const numericId of litTreeIds) {
    if (!augmented[numericId]) augmented[numericId] = [];
    if (!augmented[numericId].some(r => r.date === today)) {
      augmented[numericId].push({
        date: today, power: '', balance: '', bugs: '', producer: '',
      });
    }
  }

  const result = computeStatsForDate(augmented, labels, tomorrow);
  // 내일은 아직 입력 전이므로 completed=0, workers=[]
  return { total: result.total };
}
