// scripts/recovery.js
// 옛 불들어오는 로직(v1.0.4, ~2026-04-18)으로 daily_summaries를 재계산하여
// UPDATE SQL을 출력한다.
//
// 사용법:
//   1) .env 파일에 아래 값 채움
//        SUPABASE_URL=...
//        SUPABASE_ANON_KEY=...
//        SUPABASE_EMAIL=...
//        SUPABASE_PASSWORD=...
//   2) node --env-file=.env scripts/recovery.js
//   3) 출력된 SQL을 Supabase SQL Editor에서 실행
//
// ⚠️ 아무것도 DELETE 하지 않음. 오로지 UPDATE.

import { createClient } from '@supabase/supabase-js';

// ========== OLD 로직 (v1.0.4, 2026-04-18 이전) ==========
const ROWS = 25;
const COLS = 8;

function offsetDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function daysSinceKST(targetDate, refDate) {
  const [ty, tm, td] = refDate.split('-').map(Number);
  const [y, m, d] = targetDate.split('-').map(Number);
  return (new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86400000;
}

function computeStatsForDateOld(treeData, labels, simDate, debug = false) {
  const yStr = offsetDate(simDate, -1);

  let completed = 0;
  let totalLit = 0;
  let greenDots = 0;
  const workerCounts = {};
  const debugLit = []; // {treeId, reason, hasTodayRecord}
  const debugGreenNotLit = []; // 기록은 있는데 lit 아닌 것 (kind_dots)

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

      // simDate 이전 기록, 최신순
      const recsBefore = records
        .filter(rec => rec.date < simDate)
        .sort((a, b) => b.date.localeCompare(a.date));

      let anyLightOn = false;
      let reason = '';

      if (recsBefore.length === 0) {
        // 기록 없음 → 시계불 ON
        anyLightOn = true;
        reason = '기록없음 → 시계불';
      } else {
        // 나무: 어제 세력 1,5 또는 균형 1,2
        const yRec = recsBefore.find(rec => rec.date === yStr);
        if (yRec) {
          const p = String(yRec.power);
          const b = String(yRec.balance);
          if (['1', '5'].includes(p) || ['1', '2'].includes(b)) {
            anyLightOn = true;
            reason = `전날(${yStr}) 세력=${p} 균형=${b}`;
          }
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
              reason = `벌레 score=${score} (${bugRec.date}, ${days}일 경과)`;
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
            const days = daysSinceKST(scoreRec.date, simDate);
            if (days >= 5) {
              anyLightOn = true;
              reason = `시계불 (최신 세력/균형 ${scoreRec.date}, ${days}일 경과)`;
            }
          } else {
            anyLightOn = true;
            reason = '세력/균형 기록 전혀 없음 → 시계불';
          }
        }
      }

      if (anyLightOn) {
        if (hasTodayRecord) completed++;
        totalLit++;
        if (debug) debugLit.push({ treeId: `Tree-${c}-${r}`, reason, hasTodayRecord });
      } else if (hasTodayRecord) {
        if (debug) debugGreenNotLit.push({ treeId: `Tree-${c}-${r}` });
      }
    }
  }

  return {
    completed,
    total: totalLit,
    green_dots: greenDots,
    kind_dots: greenDots - completed,
    fake_dots: 0, // OLD 로직엔 없었음
    debugLit,
    debugGreenNotLit,
  };
}

// ========== main ==========
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL) {
  console.error('❌ .env에 SUPABASE_URL 없음');
  process.exit(1);
}

// service_role 키 우선 (RLS 우회), 없으면 anon fallback
const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
if (!key) {
  console.error('❌ .env에 SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_ANON_KEY 필요');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, key, {
  auth: { persistSession: false },
});

if (SUPABASE_SERVICE_ROLE_KEY) {
  console.error('🔑 service_role 키 사용 (RLS 우회)');
} else {
  console.error('⚠️  anon 키 사용 — RLS 때문에 데이터 비어있을 수 있음');
}

// Fetch trees
const { data: trees, error: err1 } = await supabase.from('trees').select('id, date, power, balance, bugs, producer');
if (err1) { console.error('❌ trees fetch 실패:', err1.message); process.exit(1); }

// Fetch labels
const { data: labelsRaw, error: err2 } = await supabase.from('tree_labels').select('id, disabled');
if (err2) { console.error('❌ tree_labels fetch 실패:', err2.message); process.exit(1); }

console.error(`✅ trees: ${trees.length}개 row, tree_labels: ${labelsRaw.length}개 row`);

// Organize
const treeData = {};
trees.forEach(row => { (treeData[row.id] ??= []).push(row); });

const labels = {};
labelsRaw.forEach(({ id, disabled }) => {
  labels[id] = { disabled: disabled || false };
});

// Date range: DATA_START ~ 어제
const DATA_START = '2026-04-09';
const now = new Date();
const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const today = kst.toISOString().slice(0, 10);

const dates = [];
let d = DATA_START;
while (d < today) {
  dates.push(d);
  d = offsetDate(d, 1);
}

// Fetch existing daily_summaries to compare
const { data: existing } = await supabase
  .from('daily_summaries')
  .select('*')
  .gte('date', DATA_START)
  .order('date');
const existingMap = new Map((existing || []).map(r => [r.date, r]));

// --debug YYYY-MM-DD 파싱
const debugIdx = process.argv.indexOf('--debug');
const debugDate = debugIdx >= 0 ? process.argv[debugIdx + 1] : null;

if (debugDate) {
  // 디버그 모드: 한 날짜만 자세히 출력
  console.error(`\n🔍 디버그 모드: ${debugDate} 자세히 보기\n`);
  const result = computeStatsForDateOld(treeData, labels, debugDate, true);
  console.error(`📊 결과: completed=${result.completed}, total=${result.total}, green=${result.green_dots}, kind=${result.kind_dots}\n`);
  console.error(`💡 Lit 트리 ${result.debugLit.length}개 (total):`);
  result.debugLit
    .sort((a, b) => a.treeId.localeCompare(b.treeId, undefined, { numeric: true }))
    .forEach(({ treeId, reason, hasTodayRecord }) => {
      const checkMark = hasTodayRecord ? '✅' : '  ';
      console.error(`  ${checkMark} ${treeId.padEnd(12)} | ${reason}`);
    });
  console.error(`\n💙 기록은 있는데 lit 아닌 트리 (kind_dots) ${result.debugGreenNotLit.length}개:`);
  result.debugGreenNotLit
    .sort((a, b) => a.treeId.localeCompare(b.treeId, undefined, { numeric: true }))
    .forEach(({ treeId }) => {
      console.error(`     ${treeId}`);
    });
  console.error('\n(✅ = 그날 기록 있음=completed에 포함)');
  process.exit(0);
}

// Compute and output
console.error('\n📊 날짜별 비교 (OLD vs 현재 DB):\n');
console.error('date         | OLD completed/total (g=..k=..f=..)  | DB completed/total (g=..k=..f=..)');
console.error('-------------+--------------------------------------+-----------------------------------');

const sqlUpdates = [];

for (const simDate of dates) {
  const old = computeStatsForDateOld(treeData, labels, simDate);
  const cur = existingMap.get(simDate);
  const curStr = cur
    ? `${cur.completed}/${cur.total} (g=${cur.green_dots} k=${cur.kind_dots} f=${cur.fake_dots})`
    : '(없음)';
  const oldStr = `${old.completed}/${old.total} (g=${old.green_dots} k=${old.kind_dots} f=${old.fake_dots})`;
  const diff = cur && (
    cur.completed !== old.completed ||
    cur.total !== old.total ||
    cur.green_dots !== old.green_dots ||
    cur.kind_dots !== old.kind_dots ||
    cur.fake_dots !== old.fake_dots
  );
  const marker = diff ? '  ← DIFF' : '';
  console.error(`${simDate}   | ${oldStr.padEnd(36)} | ${curStr}${marker}`);

  if (diff) {
    sqlUpdates.push(
      `UPDATE daily_summaries SET completed=${old.completed}, total=${old.total}, green_dots=${old.green_dots}, kind_dots=${old.kind_dots}, fake_dots=${old.fake_dots} WHERE date='${simDate}';`
    );
  }
}

// Print SQL
if (sqlUpdates.length === 0) {
  console.error('\n✅ 차이 없음. UPDATE 필요 없음.');
} else {
  console.error(`\n📋 아래 SQL을 Supabase SQL Editor에서 실행:\n`);
  console.log('-- Recovery SQL generated by scripts/recovery.js');
  console.log('-- OLD 로직 (v1.0.4) 기준으로 재계산한 값');
  console.log('BEGIN;');
  for (const sql of sqlUpdates) console.log(sql);
  console.log('COMMIT;');
  console.error(`\n(총 ${sqlUpdates.length}개 UPDATE 쿼리 출력됨)`);
}

process.exit(0);
