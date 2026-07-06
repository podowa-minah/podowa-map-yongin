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

  return { treeLevel, bugLevel, clockLevel, powerLevel, balLevel, clockNeedsPower, clockNeedsBal, clockNeedsBugs, anyOn, anyOverdue, bugOverdue };
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
      // 이름 없는 빈 셀은 "나무 자리 아님" — 옛 기록이 남아있어도 통계 제외
      // (labels 덜 로드된 순간에 빈 셀까지 카운트해서 total이 부풀어오르는 버그 방지)
      if (!lbl.name) continue;

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
// 오늘 아직 안 돌본 "남은" 나무 — 종류별(세력/해충/시계). 헤더 실시간 카운트다운용.
//   오늘 기록 있는 나무는 '돌봄'으로 치고 뺀다 → total = 완료율의 (총-완료)와 같음(남은 나무 수).
//   한 나무가 세력·해충 둘 다 켜졌으면 양쪽에 다 센다 (일감이라 중복 허용, 균형은 뺌).
//   treeData가 realtime으로 갱신되니 이 값도 자동으로 줄어든다(누가 입력하든).
export function remainingByCategory(treeData, labels) {
  const today = getKSTToday();
  let total = 0;
  const powerList = [], bugsList = [], clockList = [];   // {id, name} 목록 — 어떤 나무인지 보여줄 때
  for (let c = 1; c <= COLS; c++) {
    for (let r = 1; r <= ROWS; r++) {
      const numericId = `${c}-${r}`;
      const lbl = labels[`Tree-${c}-${r}`] || {};
      if (lbl.disabled || !lbl.name) continue;
      const records = treeData[numericId] || [];
      const s = evaluateSignals(records.filter((rec) => rec.date < today), today);
      if (!s.anyOn) continue;
      // 오늘 그 값을 실제로 넣었는지로 판정. 세력만 넣고 해충 안 넣으면(헛돌봄) 해충은 그대로 남음.
      const todayRecs = records.filter((rec) => rec.date === today);
      const hasPower = todayRecs.some((r) => r.power != null && r.power !== '');
      const hasBal = todayRecs.some((r) => r.balance != null && r.balance !== '');
      const hasBugs = todayRecs.some((r) => r.bugs != null && r.bugs !== undefined && r.bugs !== '');
      const hasAny = hasPower || hasBal || hasBugs;
      const remP = s.powerLevel !== 'off' && !hasPower;   // 세력 켜졌는데 오늘 세력 안 넣음
      const remB = s.bugLevel !== 'off' && !hasBugs;      // 해충 켜졌는데 오늘 해충 안 넣음
      const remC = s.clockLevel !== 'off' && !hasAny;     // 시계는 뭐라도 넣으면 꺼짐
      if (remP) powerList.push({ id: numericId, name: lbl.name });
      if (remB) bugsList.push({ id: numericId, name: lbl.name, urgent: !!(s.bugOverdue || s.bugLevel === 'emphasis') });   // 급함: 기한 지남 or 5점
      if (remC) clockList.push({ id: numericId, name: lbl.name });
      if (remP || remB || remC) total++;                  // 아직 할 게 남은 나무(헛돌봄 포함)
    }
  }
  return {
    total,
    power: powerList.length, bugs: bugsList.length, clock: clockList.length,
    powerList, bugsList, clockList,
  };
}

export function computeTomorrowPrediction(treeData, labels, litTreeIds) {
  const today = getKSTToday();
  const tomorrow = offsetDate(today, 1);

  // 현재 불 켜진 나무에 오늘 기록 추가 (가짜)
  // ⚠️ 빈 문자열이면 evaluateSignals가 무시함 → 사이클 리셋 안 되고 시뮬 부풀어 오름
  // 각 메트릭 마지막 유효 값으로 채워야 사이클 리셋됨
  const augmented = {};
  for (const key of Object.keys(treeData)) {
    augmented[key] = [...treeData[key]];
  }
  for (const numericId of litTreeIds) {
    if (!augmented[numericId]) augmented[numericId] = [];
    if (!augmented[numericId].some(r => r.date === today)) {
      const sortedRecs = [...augmented[numericId]].sort((a, b) => b.date.localeCompare(a.date));
      const lastPower = sortedRecs.find(r => r.power != null && r.power !== '')?.power ?? '3';
      const lastBalance = sortedRecs.find(r => r.balance != null && r.balance !== '')?.balance ?? '3';
      const lastBugs = sortedRecs.find(r => r.bugs != null && r.bugs !== '')?.bugs ?? '0';
      augmented[numericId].push({
        date: today, power: lastPower, balance: lastBalance, bugs: lastBugs, producer: '',
      });
    }
  }

  const result = computeStatsForDate(augmented, labels, tomorrow);
  // 내일은 아직 입력 전이므로 completed=0, workers=[]
  return { total: result.total };
}
