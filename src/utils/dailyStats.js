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

const LEVEL = { off: 0, normal: 1, emphasis: 2 };

/**
 * 단일 나무의 신호등 판정 (공유 로직)
 * @param {Array} recordsBefore - refDate 이전 기록만 (최신순 정렬 불필요, 내부에서 정렬)
 * @param {string} refDate - 기준 날짜 (YYYY-MM-DD)
 * @returns {{ treeLevel, bugLevel, clockLevel, anyOn, anyOverdue }}
 *   level: 'off' | 'normal' | 'emphasis'
 */
export function evaluateSignals(recordsBefore, refDate) {
  if (!recordsBefore || recordsBefore.length === 0) {
    // 기록 없음 → 시계 강조 (입력 이력 자체가 없음)
    return { treeLevel: 'off', bugLevel: 'off', clockLevel: 'emphasis', anyOn: true, anyOverdue: true };
  }

  const sorted = [...recordsBefore].sort((a, b) => b.date.localeCompare(a.date));
  const _days = (dateStr) => daysSinceKST(dateStr, refDate);

  // --- 세력 판정 ---
  const powerRec = sorted.find(r => r.power != null && r.power !== '');
  let powerLevel = 'off', powerOverdue = false;
  if (powerRec) {
    const val = String(powerRec.power);
    const score = Number(val);
    const isNA = val === '판단불가/지켜봐야함' || isNaN(score);
    const days = _days(powerRec.date);

    let threshold = null, emph = false;
    if (isNA)            { threshold = 3; }
    else if (score === 1) { threshold = 1; emph = true; }
    else if (score === 2) { threshold = 2; }
    else if (score === 3) { threshold = 3; }
    else if (score === 4) { threshold = 2; }
    else if (score === 5) { threshold = 1; emph = true; }

    if (threshold != null && days >= threshold) {
      powerLevel = emph ? 'emphasis' : 'normal';
      powerOverdue = days > threshold;
    }
  }

  // --- 균형 판정 ---
  const balRec = sorted.find(r => r.balance != null && r.balance !== '');
  let balLevel = 'off', balOverdue = false;
  if (balRec) {
    const val = String(balRec.balance);
    const score = Number(val);
    const isNA = val === '판단불가/지켜봐야함' || isNaN(score);
    const days = _days(balRec.date);

    let threshold = null, emph = false;
    if (isNA)            { threshold = 3; }
    else if (score === 1) { threshold = 1; emph = true; }
    else if (score === 2) { threshold = 1; }
    else if (score === 3) { threshold = 2; }
    else if (score === 4) { threshold = 3; }
    else if (score === 5) { threshold = 4; }

    if (threshold != null && days >= threshold) {
      balLevel = emph ? 'emphasis' : 'normal';
      balOverdue = days > threshold;
    }
  }

  // --- 나무 아이콘 통합: 세력/균형 중 더 긴급한 쪽 ---
  const treeLevel = LEVEL[powerLevel] >= LEVEL[balLevel] ? powerLevel : balLevel;
  const treeOverdue = (powerLevel !== 'off' && powerOverdue) || (balLevel !== 'off' && balOverdue);

  // --- 해충 판정 ---
  const bugRec = sorted.find(r => r.bugs != null && r.bugs !== undefined && r.bugs !== '');
  let bugLevel = 'off', bugOverdue = false;
  if (bugRec) {
    const score = Number(bugRec.bugs);
    const days = _days(bugRec.date);

    let threshold = null, emph = false;
    if (score === 5)      { threshold = 1; emph = true; }
    else if (score === 4) { threshold = 1; }
    else if (score === 3) { threshold = 2; }
    else if (score === 2) { threshold = 3; }
    else if (score === 1) { threshold = 3; }
    else if (score === 0) { threshold = 4; }

    if (threshold != null && days >= threshold) {
      bugLevel = emph ? 'emphasis' : 'normal';
      bugOverdue = days > threshold;
    }
  }

  // --- 시계 판정: 세력·균형·해충 중 입력된 것들만 경과일 계산 ---
  const pDays = powerRec ? _days(powerRec.date) : -1;
  const bDays = balRec ? _days(balRec.date) : -1;
  const bgDays = bugRec ? _days(bugRec.date) : -1;
  const metricDays = [pDays, bDays, bgDays].filter(d => d >= 0);

  let clockLevel = 'off', clockOverdue = false;
  // 시계불 켜지게 한 메트릭 추적 (5일 이상 된 것들)
  const clockNeedsPower = pDays >= 5;
  const clockNeedsBal = bDays >= 5;
  const clockNeedsBugs = bgDays >= 5;

  if (metricDays.length === 0) {
    // 메트릭 입력 이력 없음 → 가장 최근 기록 날짜 기준
    const latestDays = _days(sorted[0].date);
    if (latestDays >= 6) { clockLevel = 'emphasis'; clockOverdue = true; }
    else if (latestDays >= 5) { clockLevel = 'normal'; }
  } else {
    const maxDays = Math.max(...metricDays);
    if (maxDays >= 6) {
      clockLevel = 'emphasis';
      clockOverdue = true;   // 어제도 이미 시계 켜져있었음 (5일+)
    } else if (maxDays >= 5) {
      clockLevel = 'normal';
      clockOverdue = false;  // 오늘 처음 시계 켜짐
    }
  }

  const anyOn = treeLevel !== 'off' || bugLevel !== 'off' || clockLevel !== 'off';
  const anyOverdue = anyOn && (
    (treeLevel !== 'off' && treeOverdue) ||
    (bugLevel !== 'off' && bugOverdue) ||
    (clockLevel !== 'off' && clockOverdue)
  );

  return { treeLevel, bugLevel, clockLevel, powerLevel, balLevel, clockNeedsPower, clockNeedsBal, clockNeedsBugs, anyOn, anyOverdue };
}

/**
 * 특정 날짜 기준 작업 통계 계산
 * @param {Object} treeData - { "1-1": [records], ... }
 * @param {Object} labels - { "Tree-1-1": { disabled, ... }, ... }
 * @param {string} simDate - 시뮬레이션 대상 날짜 (YYYY-MM-DD)
 * @returns {{ completed, total, green_dots, workers }}
 */
export function computeStatsForDate(treeData, labels, simDate) {
  let completed = 0;
  let totalLit = 0;
  let greenDots = 0;
  let fakeDots = 0;
  const workerCounts = {};

  for (let c = 1; c <= COLS; c++) {
    for (let r = 1; r <= ROWS; r++) {
      const labelId = `Tree-${c}-${r}`;
      const numericId = `${c}-${r}`;
      const lbl = labels[labelId] || {};
      if (lbl.disabled) continue;

      const records = treeData[numericId] || [];

      // simDate 당일 기록
      const todayRecords = records.filter(rec => rec.date === simDate);
      const hasTodayRecord = todayRecords.length > 0;
      if (hasTodayRecord) {
        greenDots++;
        todayRecords.forEach(rec => {
          if (rec.producer) {
            workerCounts[rec.producer] = (workerCounts[rec.producer] || 0) + 1;
          }
        });
      }

      // simDate 이전 기록만
      const recsBefore = records.filter(rec => rec.date < simDate);
      const signals = evaluateSignals(recsBefore, simDate);

      if (signals.anyOn) {
        if (hasTodayRecord) {
          completed++;

          // 헛돌봄 판정
          const hasPower = todayRecords.some(r => r.power != null && r.power !== '');
          const hasBal = todayRecords.some(r => r.balance != null && r.balance !== '');
          const hasBugs = todayRecords.some(r => r.bugs != null && r.bugs !== undefined && r.bugs !== '');
          const hasAnyMetric = hasPower || hasBal || hasBugs;

          let isFake = false;
          if (signals.powerLevel !== 'off' && !hasPower) isFake = true;
          if (signals.balLevel !== 'off' && !hasBal) isFake = true;
          if (signals.bugLevel !== 'off' && !hasBugs) isFake = true;
          // 시계: 5일+ 된 메트릭을 입력해야 정돌봄
          if (signals.clockLevel !== 'off') {
            if (signals.clockNeedsPower && !hasPower) isFake = true;
            if (signals.clockNeedsBal && !hasBal) isFake = true;
            if (signals.clockNeedsBugs && !hasBugs) isFake = true;
            if (!signals.clockNeedsPower && !signals.clockNeedsBal && !signals.clockNeedsBugs && !hasAnyMetric) isFake = true;
          }

          if (isFake) fakeDots++;
        }
        totalLit++;
      }
    }
  }

  const workers = Object.entries(workerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return { completed, total: totalLit, green_dots: greenDots, kind_dots: greenDots - completed, fake_dots: fakeDots, workers };
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
