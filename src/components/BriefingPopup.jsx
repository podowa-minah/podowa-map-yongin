// src/components/BriefingPopup.jsx
// 아침 브리핑 — 하루 한 번. 순서:
//   ① 보고 보기: 유심히 볼 나무 + 품종별 점수 + AI 한마디
//   ② "나무를 돌보세요!" 강조 + 확인
//   ③ "오늘 세력 어때 보여요?" 예측(세력·해충·걱정) → 저장
//   ※ 오늘 이미 했으면 → 요약만 보여줌(예측 다시 안 물음).
// 저장(히스토리): daily_notes.journal_notes.briefing.snapshot (§10, 새 테이블 없음)
//   - 걱정 코멘트는 snapshot.eyeCheck.note 에 저장된다.

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { buildBriefingContext, buildRecentHistory } from '../lib/briefing';
import { getVarietyAverages } from '../lib/diagnosis';
import { getCarryOverFieldTasks } from '../lib/journal';
import { POWER_IDEAL } from '../lib/scoring';
import { clockIn } from '../utils/farmerClock';

const GREEN = '#2f6b3c';

export default function BriefingPopup({ treeData = {}, labels = {}, user, irrEval = null, pestEval = null, onChecked, onClose }) {
  const today = todayKST();
  const [doneToday, setDoneToday] = useState(undefined);   // undefined=확인중 | true | false
  const [savedSnap, setSavedSnap] = useState(null);        // 오늘 이미 시작한 경우의 스냅샷
  const [ai, setAi] = useState('loading');                 // 'loading' | 'error' | {alert,checks,info}
  const [doneTaskIds, setDoneTaskIds] = useState([]);      // (선택) 아침에 미리 체크한 할 일
  const [recentHistory, setRecentHistory] = useState(undefined);  // 최근 7일 요약(과거 먹이기) — undefined=로딩전
  const [carriedTasks, setCarriedTasks] = useState([]);    // 어제까지 안 한 밭 할일(이월) — 오늘 목록 앞에
  const [saving, setSaving] = useState(false);
  const [lockedTasks, setLockedTasks] = useState(null);   // 오늘 한 번 생성된 브리핑 고정 — 재오픈해도 재생성 X
  const genTriedRef = useRef(false);                       // 이번 마운트에 AI 호출 시도했나(에러 시 재호출 방지)

  const toggleTask = (treeId) =>
    setDoneTaskIds((prev) => (prev.includes(treeId) ? prev.filter((x) => x !== treeId) : [...prev, treeId]));

  const ctx = useMemo(() => buildBriefingContext({ treeData, labels, todayIso: today }), [treeData, labels, today]);
  const varietyScores = useMemo(() => getVarietyAverages(treeData, labels), [treeData, labels]);

  // 오늘 꼭 할 일 — 우선순위 5. AI가 메모·데이터·추이로 뽑은 할 일(밭=파란 태그 / 나무=좌표).
  //   AI가 못 주면(로컬·실패) 규칙기반(유심히 볼 나무)으로 대체. 관수·방제는 버튼 불이라 제외.
  const validIds = useMemo(() => new Set(Object.keys(treeData || {})), [treeData]);
  const taskList = useMemo(() => {
    if (lockedTasks) return lockedTasks;   // 그날 고정본 있으면 그대로(재생성·재계산 X)
    let base = [];
    if (ai && typeof ai === 'object' && Array.isArray(ai.tasks) && ai.tasks.length) {
      base = ai.tasks.map((t, i) => {
        if (t.scope === 'field') {
          return { key: `f-${i}`, kind: 'field', cat: `밭·${t.category || ''}`, label: t.action };
        }
        if (validIds.has(String(t.coord))) {
          return { key: `t-${t.coord}-${i}`, kind: 'tree', treeId: String(t.coord), name: labelName(t.coord, labels), label: t.action };
        }
        return null;   // 좌표 검증 실패는 버림
      }).filter(Boolean).slice(0, 5);
    } else {
      // 대체: 진단 우선순위 나무
      base = (ctx.watchTrees || []).slice(0, 5).map((w) => ({ key: w.id, kind: 'tree', treeId: w.id, name: w.name, label: taskLabel(w.reasons) }));
    }
    // 이월된 밭 할일을 앞에(중복 내용 제거) — 안 한 건 할 때까지 따라옴
    const fid = (t) => (t.kind === 'field' ? `${t.cat}|${t.label}` : null);
    const carryIds = new Set(carriedTasks.map(fid));
    return [...carriedTasks, ...base.filter((t) => !carryIds.has(fid(t)))].slice(0, 6);
  }, [ai, ctx, validIds, labels, carriedTasks, lockedTasks]);

  // 오늘 이미 브리핑 했나? + 최근 7일 기억(과거 먹이기) — 최근 daily_notes 한 번에 가져옴
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('daily_notes').select('date, journal_notes')
        .eq('type', 'journal').lte('date', today)
        .order('date', { ascending: false }).limit(15);
      if (!alive) return;
      const rows = data || [];
      const todayRow = rows.find((r) => r.date === today);
      const b = todayRow?.journal_notes?.briefing;
      if (b?.checked_at) { setSavedSnap(b.snapshot || null); setDoneToday(true); }
      else {
        setDoneToday(false);
        // 오늘 이미 생성된 브리핑(시작 전 draft)이 있으면 그대로 불러와 고정 — 재오픈해도 안 바뀜
        if (b?.snapshot?.ai && typeof b.snapshot.ai === 'object') {
          setAi(b.snapshot.ai);
          setLockedTasks(b.snapshot.tasks || []);
        }
      }
      setRecentHistory(buildRecentHistory(rows, today, 7));   // 과거→AI에 흐름으로 먹임
      setCarriedTasks(getCarryOverFieldTasks(rows, today));   // 어제까지 안 한 밭 할일 → 오늘 이월
    })();
    return () => { alive = false; };
  }, [today]);

  // /api/briefing 호출(실패 시 1회 재시도) → 성공 data | 실패 null. 첫 호출·자동 채움 두 곳에서 공유.
  const callBriefing = useCallback(async () => {
    const callOnce = async () => {
      const r = await fetch('/api/briefing', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...ctx, recentHistory }),   // 과거 7일 흐름 같이 보냄
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data && data.alert ? data : null;
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const data = await callOnce(); if (data) return data; }
      catch { /* 네트워크 등 — 재시도로 넘어감 */ }
      if (attempt === 0) await new Promise((res) => setTimeout(res, 1200));   // 1회 재시도 전 잠깐 대기
    }
    return null;
  }, [ctx, recentHistory]);

  // AI 한마디 — 아직 안 한 날만, 최근 기억 준비된 뒤 호출. 단 그날 고정본 있거나 이미 시도했으면 재호출 X(매번 바뀜 방지)
  useEffect(() => {
    if (doneToday !== false || recentHistory === undefined) return;
    if (lockedTasks !== null || genTriedRef.current) return;
    genTriedRef.current = true;
    let alive = true;
    (async () => {
      const data = await callBriefing();
      if (alive) setAi(data || 'error');
    })();
    return () => { alive = false; };
  }, [doneToday, recentHistory, callBriefing, lockedTasks]);

  // 오늘 시작은 했는데 AI 진단이 빠진 날(레이스로 null 저장) → 브리핑 열면 자동으로 다시 받아 채움(다시 작성/버튼 없이)
  useEffect(() => {
    if (doneToday !== true || !savedSnap || recentHistory === undefined) return;
    if (savedSnap.ai && typeof savedSnap.ai === 'object') return;   // 이미 있으면 패스
    let alive = true;
    (async () => {
      const data = await callBriefing();
      if (!alive || !data) return;
      const { data: row } = await supabase.from('daily_notes')
        .select('id, journal_notes').eq('date', today).eq('type', 'journal').maybeSingle();
      if (!alive || !row) return;
      const jn = row.journal_notes || {};
      const briefing = jn.briefing || {};
      const snapshot = { ...(briefing.snapshot || {}), ai: data };   // ai만 채우고 나머지(할일·시작시각 등) 보존
      const { error } = await supabase.from('daily_notes')
        .update({ journal_notes: { ...jn, briefing: { ...briefing, snapshot } } }).eq('id', row.id);
      if (!alive || error) return;
      setSavedSnap(snapshot);   // 다시보기 즉시 반영
      onChecked?.();            // 영농일지도 갱신
    })();
    return () => { alive = false; };
  }, [doneToday, savedSnap, recentHistory, callBriefing]);

  // 생성된 브리핑을 그날 draft로 저장(시작 전이라도) → X 닫고 재오픈해도 재생성 없이 그대로(고정)
  useEffect(() => {
    if (doneToday !== false || lockedTasks !== null) return;   // 시작했거나 이미 고정됐으면 패스
    if (!(ai && typeof ai === 'object')) return;               // AI 성공해야 저장
    let alive = true;
    (async () => {
      const { data: row } = await supabase.from('daily_notes')
        .select('id, journal_notes').eq('date', today).eq('type', 'journal').maybeSingle();
      if (!alive) return;
      const jn = row?.journal_notes || {};
      const briefing = jn.briefing || {};
      if (briefing.checked_at) return;   // 이미 시작(확정)했으면 draft 저장 안 함
      const snapshot = { ...(briefing.snapshot || {}), ai, tasks: taskList, diagnosis: ctx.diagnosis, trend: ctx.trend, varietyScores };
      if (row) await supabase.from('daily_notes').update({ journal_notes: { ...jn, briefing: { ...briefing, snapshot } } }).eq('id', row.id);
      else await supabase.from('daily_notes').insert({ date: today, type: 'journal', journal_notes: { briefing: { snapshot } }, content: '' });
      if (alive) setLockedTasks(taskList);   // 고정(재오픈 시 이걸 그대로 씀)
    })();
    return () => { alive = false; };
  }, [doneToday, ai, lockedTasks, taskList, ctx, varietyScores]);

  async function startDay() {
    setSaving(true);
    const author = user?.user_metadata?.nickname || user?.email || '';
    const snapshot = {
      startedAt: new Date().toISOString(),       // 아침 업무 시작 시각
      diagnosis: ctx.diagnosis,
      varietyScores: varietyScores.map((v) => ({
        name: v.name,
        score: v.score == null ? null : Math.round(v.score * 10) / 10,
        power: v.metrics?.power == null ? null : Math.round(v.metrics.power * 10) / 10,
      })),
      watchTrees: ctx.watchTrees,
      watchTotal: ctx.watchCount,
      trend: ctx.trend,                 // 최근 1주 추세 (히스토리)
      ai: (ai && typeof ai === 'object') ? ai : null,
      tasks: taskList,                            // 오늘 계획(우선순위 5) — 하루 N/5 추적용
      doneTasks: taskList.filter((t) => doneTaskIds.includes(t.key)),  // 아침에 미리 체크한 것(선택)
    };
    const { data: existing } = await supabase
      .from('daily_notes').select('id, journal_notes')
      .eq('date', today).eq('type', 'journal').maybeSingle();
    const journal_notes = {
      ...(existing?.journal_notes || {}),
      briefing: { ...(existing?.journal_notes?.briefing || {}), checked_at: new Date().toISOString(), snapshot },
    };
    let result;
    if (existing) result = await supabase.from('daily_notes').update({ journal_notes }).eq('id', existing.id);
    else result = await supabase.from('daily_notes').insert({ date: today, type: 'journal', journal_notes, author, content: '' });
    setSaving(false);
    if (result?.error) { alert('저장 실패: ' + result.error.message); return; }
    clockIn();   // 아침보고 확정 시각 = 출근 (손님 VINE OWNER 앱 타임라인 연동)
    onChecked?.();
    onClose?.();
  }

  // 요약에서 "다시" — 아침 보고를 다시 (저장하면 오늘 기록 덮어씀). 고정 해제해야 새로 생성됨
  function redo() {
    setSavedSnap(null);
    setDoneTaskIds([]);
    setAi('loading');
    setDoneToday(false);
    setLockedTasks(null);        // 고정 해제 → 재생성 허용
    genTriedRef.current = false;
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={hIcon}>✨</span>
            <span>
              <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.1 }}>AI 아침보고</span>
              <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.85, marginTop: 2 }}>{shortDate(today)}{doneToday ? ' · 다시보기' : ''}</span>
            </span>
          </div>
          <button onClick={onClose} aria-label="닫기" title="닫기" style={closeBtn}>✕</button>
        </div>

        <div style={body}>
          {doneToday === undefined && <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>불러오는 중…</p>}

          {/* ── 요약 모드: 오늘 이미 시작함 ── */}
          {doneToday === true && (
            <SummaryView snap={savedSnap} onClose={onClose} onRedo={redo} />
          )}

          {/* ── 아침 보고 (단일 화면) ── */}
          {doneToday === false && (
            <>
              <AiHero ai={ai} />
              <AiCats ai={ai} />
              <TrendRow diag={ctx.diagnosis} trend={ctx.trend} />

              <SectionTitle>
                🚩 AI가 진단한 오늘 꼭 할 일
                <span style={{ fontWeight: 400, color: '#9ca3af' }}> 우선순위 {taskList.length}</span>
              </SectionTitle>
              <TaskChecklist tasks={taskList} />
              <div style={mapNote}>🟣 자동으로 포도와 맵에 보라색으로 표시돼 있어요</div>

              <VarietySection list={varietyScores} />

              <div style={careBanner}>
                🍇 꼭 포도밭을 한 바퀴 돌고<br />나무 컨디션을 체크한 후 돌봄을 시작하세요
              </div>

              <button onClick={startDay} disabled={saving || ai === 'loading'}
                style={{ ...primaryBtn, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (saving || ai === 'loading') ? 0.6 : 1 }}>
                <span style={farmerBadge}>👨‍🌾</span>{saving ? '시작 중…' : ai === 'loading' ? 'AI 분석 중… 잠시만요' : '아침 업무 시작'}
              </button>
              <p style={hintLine}>{ai === 'loading' ? 'AI 진단을 받은 뒤 시작할 수 있어요(놓치지 않게)' : '누르면 시작 시각이 기록돼요 · 할 일은 하면 자동 체크돼요'}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 요약(읽기 전용) — 오늘 이미 시작함 ──
function SummaryView({ snap, onClose, onRedo }) {
  if (!snap) {
    return (
      <>
        <p style={{ fontSize: '0.9rem', color: '#5f5e5a' }}>오늘 아침 업무를 이미 시작했어요. ✅</p>
        <button onClick={onClose} style={primaryBtn}>닫기</button>
      </>
    );
  }
  const started = snap.startedAt ? new Date(snap.startedAt) : null;
  const plan = snap.tasks || [];
  const doneKeys = new Set((snap.doneTasks || []).map((t) => t.key || t.treeId));
  return (
    <>
      {started && (
        <div style={{ fontSize: '0.9rem', color: '#1f2937', marginBottom: 14 }}>
          🌅 아침 업무 시작 <b style={{ color: GREEN }}>{hhmm(started)}</b>
        </div>
      )}
      {snap.ai?.alert && <AiHero ai={snap.ai} />}
      <AiCats ai={snap.ai} />
      {snap.trend && <TrendRow diag={snap.diagnosis} trend={snap.trend} />}
      {plan.length > 0 && (
        <>
          <SectionTitle>🚩 AI가 진단한 오늘 꼭 할 일</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
            {plan.map((t, i) => {
              const isField = t.kind === 'field';
              return (
                <div key={i} style={{ fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.5 }}>
                  {t.carried ? <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a6a1c', background: '#fdf3e3', border: '1px solid #f0d9b0', borderRadius: 4, padding: '0 3px', marginRight: 3 }}>이월</span> : null}<b style={{ color: isField ? '#0c447c' : '#b45309' }}>{taskTagText(t)}</b>{!isField && t.name ? ` ${t.name}` : ''}{t.label ? ` — ${t.label}` : ''}
                </div>
              );
            })}
          </div>
          <div style={mapNote}>🟣 자동으로 포도와 맵에 보라색으로 표시돼 있어요</div>
        </>
      )}
      {snap.varietyScores?.length > 0 && (
        <VarietySection list={snap.varietyScores} />
      )}
      <button onClick={onClose} style={{ ...primaryBtn, marginTop: 6 }}>닫기</button>
      {onRedo && (
        <button onClick={onRedo} style={redoBtn}>✏️ 오늘 아침 보고 다시</button>
      )}
    </>
  );
}

// AI 한마디 — 히어로(아바타 + 큰 글씨). 강조.
function AiHero({ ai }) {
  const loading = ai === 'loading';
  let msg;
  if (loading) msg = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#6b7280' }}>
      <span style={spinner} />
      AI가 오늘 밭을 읽고 있어요… 잠깐만요
    </span>
  );
  else if (ai === 'error') msg = <span style={{ color: '#9ca3af' }}>AI 한마디는 배포본(인터넷)에서 떠요</span>;
  else if (ai && typeof ai === 'object') msg = <span style={{ color: '#1f2937' }}>{ai.alert}</span>;
  else msg = <span style={{ color: '#9ca3af' }}>—</span>;
  return (
    <div style={aiHero}>
      <span style={{ ...aiAvatar, animation: loading ? 'spin 1.6s linear infinite' : 'none' }}>✨</span>
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: GREEN, marginBottom: 3 }}>AI 한마디 · 오늘의 진단</div>
        <div style={{ fontSize: '0.95rem', lineHeight: 1.55 }}>{msg}</div>
      </div>
    </div>
  );
}

// AI 진단 범주 — 생육·병해충·환경 (아침에 같이 봄, 영농일지에도 쌓임)
function AiCats({ ai }) {
  if (!ai || typeof ai !== 'object') return null;
  const rows = [
    ['생육', ai.growth, '#27500a'],
    ['병해충', ai.pest, '#a32d2d'],
    ['환경', ai.env, '#0c447c'],
  ].filter(([, v]) => v);
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 16, fontSize: '0.84rem', lineHeight: 1.55 }}>
      {rows.map(([label, text, col]) => (
        <div key={label} style={{ marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: col }}>{label}</span> <span style={{ color: '#1f2937' }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

// 좌표 → 품종 이름 (AI 나무 할 일 표시용)
function labelName(coord, labels) {
  return (labels?.[`Tree-${coord}`]?.name || '').trim();
}

// 밭 추세(최근 1주) — 세력/균형/해충 현재값 + 방향 화살표. 해충은 ↘이 좋음(색 반전).
function TrendRow({ diag = {}, trend = {} }) {
  if (!trend) return null;
  const cell = (label, val, dir, reverse) => {
    const sym = dir > 0 ? '↗' : dir < 0 ? '↘' : '→';
    const good = reverse ? dir < 0 : dir > 0;
    const bad = reverse ? dir > 0 : dir < 0;
    const col = good ? '#16a34a' : bad ? '#dc2626' : '#9ca3af';
    return (
      <span key={label} style={{ fontSize: '0.8rem', marginRight: 12 }}>
        {label} <b style={{ color: '#1f2937' }}>{val ?? '–'}</b>{' '}
        <span style={{ color: col, fontWeight: 700 }}>{sym}</span>
      </span>
    );
  };
  return (
    <div style={trendBox}>
      <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginRight: 8 }}>밭 추세 1주</span>
      {cell('세력', diag.vigor, trend.power?.dir, false)}
      {cell('균형', diag.balance, trend.balance?.dir, false)}
      {cell('해충', diag.pest, trend.bugs?.dir, true)}
    </div>
  );
}

// 내 눈 vs 기록 한 줄 — 차이가 크면 노랑 강조(눈이 빗나간 항목)
function CmpRow({ label, mine, real }) {
  const diff = (mine != null && real != null) ? Math.abs(mine - real) : null;
  const off = diff != null && diff >= 1.5;
  return (
    <div style={cmpRow}>
      <span style={cmpLabel}>{label}</span>
      <span style={{ ...cmpCol, fontWeight: 700, color: '#1f2937' }}>{mine ?? '–'}</span>
      <span style={{ ...cmpCol, fontWeight: 700, color: off ? '#b45309' : GREEN }}>
        {real ?? '–'}{off ? ' ⚠️' : ''}
      </span>
    </div>
  );
}

// 진단 이유 → 작업 라벨 (체크리스트에 보일 "할 일")
const TASK_ACTION = {
  '해충많음': '해충 방제·확인',
  '세력약함': '세력 보강 확인',
  '세력과함': '세력 조절(과함)',
  '균형낮음': '균형 점검',
  '확인': '상태 확인',
};
function taskLabel(reasons = []) {
  const acts = (reasons || []).map((r) => TASK_ACTION[r] || r);
  return acts.join('·') || '상태 확인';
}

// 우선순위 체크리스트 — 밭(파란 태그) + 나무(좌표). 체크하면 "한 일"로 기록.
// AI가 진단한 오늘 꼭 할 일 — 체크박스 없음(나무는 맵 보라로 자동 추적, 밭은 보고 체크리스트). 여긴 안내만.
function TaskChecklist({ tasks = [] }) {
  if (!tasks.length) {
    return <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 14 }}>오늘 급한 할 일이 없어요 — 한 바퀴만 가볍게 돌아요.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
      {tasks.map((t) => (
        <div key={t.key} style={{ fontSize: '0.84rem', lineHeight: 1.5 }}>
          {t.carried && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9a6a1c', background: '#fdf3e3', border: '1px solid #f0d9b0', borderRadius: 4, padding: '0 3px', marginRight: 3 }}>이월</span>}
          {t.kind === 'field'
            ? <><span style={fieldTag}>{t.cat}</span><span style={{ color: '#1f2937' }}>{t.label}</span></>
            : <><b style={{ color: '#b45309' }}>{t.treeId}</b>{t.name ? <span style={{ color: '#5f5e5a' }}> {t.name}</span> : null}<span style={{ color: '#9a6a1c' }}> — {t.label}</span></>}
        </div>
      ))}
    </div>
  );
}

// 밭 할 일 파란 태그
function taskTagText(t) {
  return t.kind === 'field' ? t.cat : t.treeId;
}

function WatchSection({ watchTrees = [], watchCount = 0 }) {
  if (!watchCount) return null;
  return (
    <>
      <SectionTitle><span style={{ color: '#854f0b' }}>⚠️ 유심히 볼 나무 {watchCount}그루</span></SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        {watchTrees.map((w, i) => (
          <div key={i} style={{ fontSize: '0.82rem', color: '#1f2937' }}>
            {w.id && <b style={{ color: '#b45309' }}>{w.id}</b>}
            {w.name ? <span style={{ color: '#5f5e5a' }}> {w.name}</span> : null}
            <span style={{ color: '#9a6a1c' }}> — {(w.reasons || []).join('·')}</span>
          </div>
        ))}
        {watchCount > watchTrees.length && (
          <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>외 {watchCount - watchTrees.length}그루</div>
        )}
      </div>
    </>
  );
}

function VarietySection({ list = [] }) {
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const idealLeft = Math.min(100, (POWER_IDEAL / 5) * 100);   // 적정 마커 위치(%)
  const shown = open ? list : list.slice(0, 2);   // list는 약한 순 → 기본 약한 2개만
  return (
    <>
      <SectionTitle>
        품종별 세력 <span style={{ fontWeight: 400, color: '#9ca3af' }}>(막대=세력 · ┃적정 {POWER_IDEAL})</span>
      </SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 8 }}>
        {shown.map((v) => {
          const sc = v.score == null ? null : Math.round(v.score * 10) / 10;
          const power = v.power ?? v.metrics?.power ?? null;
          const pw = power == null ? null : Math.round(power * 10) / 10;
          // 세력 적정 대비 — 높을수록 좋은 게 아니라 3.35 부근이 최적
          const dir = pw == null ? null
            : Math.abs(pw - POWER_IDEAL) <= 0.4 ? { g: '✓', c: GREEN }
            : pw > POWER_IDEAL ? { g: '▲', c: '#b45309' }   // 과함
            : { g: '▼', c: '#2563eb' };                      // 약함
          return (
            <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', flex: '0 0 3.2rem', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
              {/* 세력 게이지(0~5) + 적정 마커(┃) — '그래프에 세력 포인팅' */}
              <span style={{ position: 'relative', flex: 1, height: 10, background: '#ece9e0', borderRadius: 999 }}>
                {pw != null && (
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, pw / 5 * 100)}%`, background: dir.c, borderRadius: 999 }} />
                )}
                <span style={{ position: 'absolute', left: `${idealLeft}%`, top: -3, bottom: -3, width: 2, background: '#374151', borderRadius: 1 }} title={`적정 ${POWER_IDEAL}`} />
              </span>
              <span style={{ fontSize: '0.78rem', flex: '0 0 2.6rem', textAlign: 'right', color: dir ? dir.c : '#cbd5e1', fontWeight: 700 }} title={`세력 (적정 ${POWER_IDEAL})`}>
                {pw == null ? '–' : `${pw}${dir.g}`}
              </span>
              <span style={{ fontSize: '0.68rem', flex: '0 0 2.4rem', textAlign: 'right', color: '#9ca3af' }} title="종합점수">
                {sc == null ? '' : `점${sc}`}
              </span>
            </div>
          );
        })}
      </div>
      {list.length > 2 && (
        <button onClick={() => setOpen((o) => !o)} style={moreVarBtn}>
          {open ? '접기 ▴' : `품종 ${list.length}종 자세히 ▾`}
        </button>
      )}
    </>
  );
}

function AiView({ ai, checkable = false, checked = [], onToggle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {ai === 'loading' && <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>클로드가 메모 읽는 중…</p>}
      {ai === 'error' && <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>AI 글은 배포본에서 보여요</p>}
      {ai && typeof ai === 'object' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Band color="#854f0b" bg="#faeeda" title="🚨 경각심">{ai.alert}</Band>
          {Array.isArray(ai.checks) && ai.checks.length > 0 && (
            <Band color="#27500a" bg="#eaf3de" title="✅ 오늘 체크">
              {ai.checks.map((c, i) => {
                if (!checkable) return <div key={i}>· {c}</div>;
                const on = checked.includes(c);
                return (
                  <label key={i} style={checkRow}>
                    <input type="checkbox" checked={on} onChange={() => onToggle?.(c)} style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ textDecoration: on ? 'line-through' : 'none', opacity: on ? 0.55 : 1 }}>{c}</span>
                  </label>
                );
              })}
            </Band>
          )}
          {ai.info && <Band color="#042c53" bg="#e6f1fb" title="📊 정보">{ai.info}</Band>}
        </div>
      )}
    </div>
  );
}

// ── 작은 부품 ──
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 7, color: '#1f2937' }}>
        {label} {hint && <span style={{ fontWeight: 400, color: '#b4b2a9', fontSize: '0.72rem' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function Pills({ opts, value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map((n) => {
        const on = value === n;
        return (
          <button key={n} onClick={() => onPick(n)} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
            border: on ? `1.5px solid ${GREEN}` : '1.5px solid #d3d1c7',
            background: on ? GREEN : '#fff', color: on ? '#fff' : '#5f5e5a', fontWeight: 600, fontSize: '0.9rem',
          }}>{n}</button>
        );
      })}
    </div>
  );
}
function SectionTitle({ children }) {
  return <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>{children}</div>;
}
function Band({ color, bg, title, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, background: bg, borderRadius: '0 8px 8px 0', padding: '9px 11px' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '0.9rem', color, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} (${dow})`;
}
function hhmm(date) {
  try { return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

// ── 스타일 ──
const overlay = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(20,16,8,0.55)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.1rem 0.8rem', overflowY: 'auto',
};
const sheet = { width: '100%', maxWidth: '420px', margin: 'auto' };
const header = {
  background: GREEN, color: '#fff', padding: '14px 16px', borderRadius: '14px 14px 0 0',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
};
const hIcon = {
  width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.16)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', flexShrink: 0,
};
const aiHero = {
  display: 'flex', gap: 10, background: '#f1f7ee', border: '1px solid #cfe3cc',
  borderRadius: 12, padding: '12px 13px', marginBottom: 18,
};
const aiAvatar = {
  flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: GREEN, color: '#fff',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem',
};
const spinner = {
  width: 16, height: 16, border: '2px solid #d8e3d2', borderTopColor: GREEN,
  borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  animation: 'spin 0.8s linear infinite',   // @keyframes spin = App.css 전역
};
const farmerBadge = {
  width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
};
const moreVarBtn = {
  width: '100%', marginBottom: 14, padding: '7px', background: 'none',
  border: '1px solid #ece0c4', borderRadius: 8, color: '#6b7280',
  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
};
const body = { background: '#fff', borderRadius: '0 0 14px 14px', padding: '15px 16px' };
const closeBtn = {
  background: 'rgba(255,255,255,0.18)', color: '#fff', border: 'none',
  borderRadius: 8, width: 30, height: 30, fontSize: '0.95rem',
  cursor: 'pointer', lineHeight: 1, flexShrink: 0,
};
const textareaStyle = {
  width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: '0.9rem',
  padding: 8, borderRadius: 8, border: '1px solid #d3d1c7', resize: 'none',
};
const primaryBtn = {
  width: '100%', background: GREEN, color: '#fff', border: 'none', borderRadius: 10,
  padding: 12, fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
};
const hintLine = { textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af', margin: '8px 0 0' };
const careBanner = {
  background: '#eef6ec', border: '1px solid #cfe3cc', borderRadius: 10,
  padding: '10px 12px', margin: '2px 0 10px', fontSize: '0.85rem',
  color: '#27500a', lineHeight: 1.5, fontWeight: 600, textAlign: 'center',
};
const cmpTable = {
  border: '1px solid #ece0c4', borderRadius: 10, overflow: 'hidden', marginBottom: 10,
};
const cmpRow = {
  display: 'flex', alignItems: 'center', padding: '8px 12px',
  borderTop: '1px solid #f0ece2', fontSize: '0.9rem',
};
const cmpLabel = { flex: '0 0 3.5rem', color: '#5f5e5a', fontSize: '0.85rem' };
const cmpCol = { flex: 1, textAlign: 'center' };
const redoBtn = {
  width: '100%', marginTop: 8, padding: '9px', background: 'none',
  border: '1px solid #d3d1c7', borderRadius: 10, color: '#6b7280',
  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
};
const checkRow = {
  display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0',
  cursor: 'pointer', lineHeight: 1.45,
};
const trendBox = {
  display: 'flex', alignItems: 'center', flexWrap: 'wrap',
  background: '#f7f6f1', border: '1px solid #ece0c4', borderRadius: 8,
  padding: '7px 11px', marginBottom: 16,
};
// AI 할 일 아래 안내 — 맵 보라 표시 연동 (체크박스 대신). 맵 AI 보라 톤과 통일.
const mapNote = {
  fontSize: '0.78rem', color: '#5b3fb0', lineHeight: 1.45,
  background: '#f4f1fb', border: '1px solid #e0d8f5', borderRadius: 6,
  padding: '6px 10px', marginBottom: 16,
};
const fieldTag = {
  display: 'inline-block', background: '#e6f1fb', color: '#0c447c',
  fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 5,
  marginRight: 5, verticalAlign: '1px',
};
