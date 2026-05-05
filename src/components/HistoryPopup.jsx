import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getKSTToday, offsetDate } from '../utils/dailyStats';
import treeIconSVG from '../assets/icons/tree_icon_1.svg';
import farmerCrySVG from '../assets/icons/farmer_cry.svg';
import farmerProudSVG from '../assets/icons/farmer_proud.svg';
import farmerCuriousSVG from '../assets/icons/farmer_curious.svg';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DATA_START_DATE = '2026-04-09'; // 데이터 시작일

// 농부의 변(辯) / 자랑(♫) 비밀번호 — 클라이언트 사이드 가벼운 게이트(보안 X)
const PIN_EDIT = '1234';
const PIN_DELETE = '6687';

// NoteSlot은 부모의 CSS grid 안에서 사용됨.
// labelArea/expandedArea props로 grid 위치를 외부에서 지정.
// fallbackValue/fallbackAuthor: value가 비어있을 때 표시·편집 초기값으로 쓰임 (예: 변/자랑에 plan을 fallback)
function NoteSlot({
  date, type, value, author, onSave, currentAuthor,
  fallbackValue, fallbackAuthor,
  labelArea = { gridRow: 1, gridColumn: 1 },
  expandedArea = { gridRow: 2, gridColumn: '1 / -1', marginTop: '4px' },
}) {
  const displayValue = value ?? fallbackValue ?? null;
  const displayAuthor = author ?? fallbackAuthor ?? null;
  const initialDraft = value || fallbackValue || '';

  const [mode, setMode] = useState('view'); // view | write | editPin | deletePin | edit
  const [draft, setDraft] = useState(initialDraft);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const symbol = type === 'excuse' ? '辯' : type === 'boast' ? '♫' : '?';
  const isEmpty = !displayValue;
  const expanded = mode !== 'view' || showActions;
  // 색깔: 변→노랑, 자랑→초록, plan→하늘
  const filledColor =
    type === 'excuse' ? '#f5b942' :
    type === 'boast' ? '#10b981' :
    '#7DD3FC';
  // 버블박스 색깔
  const bubbleBg =
    type === 'excuse' ? '#fef9ef' :
    type === 'boast' ? '#ecfdf5' :
    '#f0f9ff';
  const bubbleBorder = filledColor;
  // 농부 아이콘
  const farmerIcon =
    type === 'excuse' ? farmerCrySVG :
    type === 'boast' ? farmerProudSVG :
    farmerCuriousSVG;
  const authorField = `${type}_author`; // excuse_author | boast_author | plan_author

  const reset = () => {
    setMode('view');
    setDraft(value || fallbackValue || '');
    setPin('');
    setPinError('');
    setBusy(false);
    setShowActions(false);
  };

  const submitWrite = async () => {
    const text = draft.trim();
    if (!text) { reset(); return; }
    setBusy(true);
    // 작성/수정 시 author도 함께 업데이트 (마지막 수정자)
    const ok = await onSave(date, { [type]: text, [authorField]: currentAuthor || null });
    if (ok) reset(); else setBusy(false);
  };

  const submitPin = async () => {
    const required = mode === 'editPin' ? PIN_EDIT : PIN_DELETE;
    if (pin !== required) {
      setPinError('비밀번호가 틀렸어요');
      return;
    }
    if (mode === 'editPin') {
      setDraft(value || fallbackValue || '');
      setMode('edit');
      setPin('');
      setPinError('');
      return;
    }
    // deletePin: 본문 + author 모두 NULL
    setBusy(true);
    const ok = await onSave(date, { [type]: null, [authorField]: null });
    if (ok) reset(); else setBusy(false);
  };

  // 라벨 (slot 영역, row1/col1)
  const label = isEmpty ? (
    <button
      onClick={() => { setDraft(''); setMode('write'); }}
      style={{
        background: 'none', border: 'none', color: '#a0aec0',
        fontSize: '0.72rem', cursor: 'pointer', padding: 0,
        fontFamily: 'inherit', lineHeight: 1.3,
      }}
    >
      농부의 {symbol}
    </button>
  ) : (
    <span
      onClick={() => setShowActions(s => !s)}
      style={{
        fontSize: '0.72rem', color: filledColor, fontWeight: 700,
        cursor: 'pointer', lineHeight: 1.3,
      }}
    >
      농부의 {symbol}
    </span>
  );

  // 펼친 영역 (워커 밑, row2/col1~-1)
  let expandedContent = null;
  if (mode === 'write' || mode === 'edit') {
    expandedContent = (
      <div>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          rows={2}
          placeholder={`농부의 ${symbol}...`}
          style={{
            width: '100%', fontSize: '0.78rem', padding: '6px 8px',
            border: '1px solid #cbd5e1', borderRadius: '6px',
            fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <button
            onClick={submitWrite}
            disabled={busy}
            style={{
              fontSize: '0.72rem', padding: '4px 10px',
              border: '1px solid #10b981', background: '#10b981',
              color: '#fff', borderRadius: '4px',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >저장</button>
          <button
            onClick={reset}
            disabled={busy}
            style={{
              fontSize: '0.72rem', padding: '4px 10px',
              border: '1px solid #cbd5e1', background: '#fff',
              color: '#718096', borderRadius: '4px',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >취소</button>
        </div>
      </div>
    );
  } else if (mode === 'editPin' || mode === 'deletePin') {
    const action = mode === 'editPin' ? '수정' : '삭제';
    expandedContent = (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.72rem', color: '#718096' }}>
          {action} 비번:
        </span>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setPinError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') submitPin(); }}
          autoFocus
          inputMode="numeric"
          maxLength={6}
          style={{
            width: '70px', fontSize: '0.78rem', padding: '3px 6px',
            border: '1px solid #cbd5e1', borderRadius: '4px',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={submitPin}
          disabled={busy}
          style={{
            fontSize: '0.72rem', padding: '3px 8px',
            border: '1px solid #cbd5e1', background: '#fff',
            borderRadius: '4px', cursor: busy ? 'wait' : 'pointer',
          }}
        >확인</button>
        <button
          onClick={reset}
          disabled={busy}
          style={{
            fontSize: '0.72rem', padding: '3px 8px',
            border: 'none', background: 'none',
            color: '#a0aec0', cursor: busy ? 'wait' : 'pointer',
          }}
        >취소</button>
        {pinError && (
          <span style={{ fontSize: '0.7rem', color: '#ef4444' }}>
            {pinError}
          </span>
        )}
      </div>
    );
  } else if (showActions) {
    // mode === 'view' && showActions: (농부 아이콘 +) 버블박스 본문 + [수정] [삭제] [닫기]
    expandedContent = (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          {farmerIcon && (
            <img
              src={farmerIcon}
              alt=""
              style={{ width: 36, height: 36, flexShrink: 0 }}
            />
          )}
          {/* 버블박스 */}
          <div style={{
            position: 'relative',
            background: bubbleBg,
            border: `1.5px solid ${bubbleBorder}`,
            borderRadius: '12px',
            padding: '6px 10px',
            fontSize: '0.78rem', color: '#4a5568',
            flex: 1, minWidth: 0,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {/* 꼬리는 농부 아이콘이 있을 때만 */}
            {farmerIcon && (
              <>
                <div style={{
                  position: 'absolute', left: -7, top: 10,
                  width: 0, height: 0,
                  borderTop: '6px solid transparent',
                  borderRight: `7px solid ${bubbleBorder}`,
                  borderBottom: '6px solid transparent',
                }} />
                <div style={{
                  position: 'absolute', left: -5, top: 11,
                  width: 0, height: 0,
                  borderTop: '5px solid transparent',
                  borderRight: `6px solid ${bubbleBg}`,
                  borderBottom: '5px solid transparent',
                }} />
              </>
            )}
            {displayAuthor && (
              <span style={{ fontWeight: 700, color: filledColor }}>{displayAuthor}</span>
            )}
            {displayAuthor ? `: ${displayValue}` : displayValue}
          </div>
        </div>
        {/* 액션 버튼 — 버블 아래 (아이콘 있으면 들여쓰기) */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', paddingLeft: farmerIcon ? '44px' : 0 }}>
          <button
            onClick={() => { setShowActions(false); setMode('editPin'); }}
            style={{
              fontSize: '0.7rem', padding: '2px 8px',
              border: '1px solid #cbd5e1', background: '#fff',
              color: '#4a5568', borderRadius: '4px', cursor: 'pointer',
            }}
          >수정</button>
          <button
            onClick={() => { setShowActions(false); setMode('deletePin'); }}
            style={{
              fontSize: '0.7rem', padding: '2px 8px',
              border: '1px solid #fecaca', background: '#fff',
              color: '#dc2626', borderRadius: '4px', cursor: 'pointer',
            }}
          >삭제</button>
          <button
            onClick={() => setShowActions(false)}
            style={{
              fontSize: '0.7rem', padding: '2px 6px',
              border: 'none', background: 'none',
              color: '#a0aec0', cursor: 'pointer',
            }}
          >닫기</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 라벨: 부모 grid의 지정 위치 */}
      <div style={{ ...labelArea, minWidth: 0 }}>
        {label}
      </div>
      {/* 펼친 영역: 부모 grid의 지정 위치 (보통 row2 / col 전체) */}
      {expanded && expandedContent && (
        <div style={expandedArea}>
          {expandedContent}
        </div>
      )}
    </>
  );
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = WEEKDAYS[dt.getDay()];
  return `${m}/${d} (${wd})`;
}

function GreenDot() {
  return (
    <span style={{
      display: 'inline-block', width: '6px', height: '6px',
      borderRadius: '50%', backgroundColor: '#10b981',
      verticalAlign: 'middle', marginRight: '2px',
    }} />
  );
}

function MiniBar({ pct, incomplete }) {
  return (
    <div style={{
      width: '60px', height: '8px', borderRadius: '4px',
      backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: '4px',
        backgroundColor: pct >= 100 ? '#10b981' : incomplete ? '#f5b942' : pct > 0 ? '#f59e0b' : '#cbd5e1',
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

function DayRow({ date, label, completed, total, greenDots, kindDots, fakeDots, workers, isTomorrow, isToday, excuse, boast, excuseAuthor, boastAuthor, plan, planAuthor, onSaveNote, currentAuthor }) {
  const pct = total > 0 ? Math.round(completed / total * 100) : null;
  const isEmpty = total === 0;
  const isIncomplete = !isTomorrow && !isToday && !isEmpty && pct < 100;
  const isComplete = !isTomorrow && !isToday && !isEmpty && pct >= 100;

  // 슬롯 종류 결정:
  //   과거 미완료 → 변(辯)  (plan은 fallback)
  //   과거 완료 → 자랑(♫)  (plan은 fallback)
  //   그 외(오늘/내일/빈 일자) → plan(?) — 단독, fallback 없음
  let slotType, slotValue, slotAuthor, slotFallbackValue, slotFallbackAuthor;
  if (isIncomplete) {
    slotType = 'excuse';
    slotValue = excuse;
    slotAuthor = excuseAuthor;
    slotFallbackValue = plan;
    slotFallbackAuthor = planAuthor;
  } else if (isComplete) {
    slotType = 'boast';
    slotValue = boast;
    slotAuthor = boastAuthor;
    slotFallbackValue = plan;
    slotFallbackAuthor = planAuthor;
  } else {
    slotType = 'plan';
    slotValue = plan;
    slotAuthor = planAuthor;
    slotFallbackValue = null;
    slotFallbackAuthor = null;
  }
  const showNoteSlot = !!onSaveNote;

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0',
      backgroundColor: isIncomplete ? '#fef9ef' : undefined,
      marginLeft: '-12px', marginRight: '-12px',
      paddingLeft: '12px', paddingRight: '12px',
      borderRadius: isIncomplete ? '8px' : 0,
    }}>
      {/* 첫째 줄: 날짜 + 바 + 퍼센트 + 분자/분모 + 초록점 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: (showNoteSlot || (workers && workers.length > 0)) ? '4px' : 0,
      }}>
        <span style={{
          fontSize: '0.85rem', fontWeight: 700,
          color: isTomorrow ? '#7c3aed' : isIncomplete ? '#e09600' : '#2d3748',
          minWidth: '80px', flexShrink: 0,
        }}>
          {isTomorrow && '🔮 '}{isToday && '📍 '}{label}
        </span>

        {isEmpty ? (
          <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>돌볼 나무 없음 🌿</span>
        ) : (
          <>
            <MiniBar pct={isTomorrow ? 0 : (pct || 0)} incomplete={isIncomplete} />
            <span style={{
              fontSize: '0.8rem', fontWeight: 600,
              color: pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : isIncomplete ? '#e09600' : '#a0aec0',
              minWidth: '32px',
            }}>
              {isTomorrow ? '--' : `${pct}%`}
            </span>
            <span style={{ fontSize: '0.75rem', color: isIncomplete ? '#e09600' : '#718096' }}>
              {isTomorrow ? `0/${total}` : `${completed}/${total}`}
            </span>
            {isTomorrow && (
              <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontStyle: 'italic' }}>오늘 완료 가정</span>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: '0.72rem', color: '#718096' }}>
              {fakeDots != null && fakeDots > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px' }}>
                  <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', backgroundColor: '#f97316' }} />
                  <span>{fakeDots}</span>
                </span>
              )}
              {kindDots != null && kindDots > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', marginLeft: fakeDots > 0 ? '3px' : 0 }}>
                  <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', backgroundColor: '#667eea' }} />
                  <span>{kindDots}</span>
                </span>
              )}
              {greenDots != null && greenDots > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1px', marginLeft: '5px' }}>
                  <img src={treeIconSVG} alt="" style={{ width: 11, height: 11 }} />
                  <span>{greenDots}</span>
                </span>
              )}
            </span>
          </>
        )}
      </div>

      {/* 둘째 줄: 슬롯 라벨(col1) + 워커(col2) | 슬롯 펼침 영역은 row2 col 전체 (워커 밑) */}
      {(showNoteSlot || (workers && workers.length > 0)) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr',
          columnGap: '8px',
          alignItems: 'center',
          minHeight: '16px',
        }}>
          {showNoteSlot && (
            <NoteSlot
              date={date} type={slotType}
              value={slotValue} author={slotAuthor}
              fallbackValue={slotFallbackValue} fallbackAuthor={slotFallbackAuthor}
              onSave={onSaveNote} currentAuthor={currentAuthor}
            />
          )}
          {workers && workers.length > 0 && (
            <div style={{
              gridRow: 1, gridColumn: 2,
              fontSize: '0.72rem', color: '#a0aec0',
              minWidth: 0, lineHeight: 1.3,
            }}>
              {workers.map((w, i) => (
                <span key={w.name}>
                  {i > 0 && ' · '}👨‍🌾 {w.name} {w.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// 미래 plan row (모레~+6일) — 프로그레스바/워커/점들 없음, 날짜 + plan 슬롯만
function PlanRow({ date, label, plan, planAuthor, onSaveNote, currentAuthor }) {
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0',
      marginLeft: '-12px', marginRight: '-12px',
      paddingLeft: '12px', paddingRight: '12px',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr',
        columnGap: '8px',
        alignItems: 'center',
      }}>
        <span style={{
          gridRow: 1, gridColumn: 1,
          fontSize: '0.85rem', fontWeight: 700,
          color: '#0EA5E9',
        }}>
          ☁️ {label}
        </span>
        <NoteSlot
          date={date}
          type="plan"
          value={plan}
          author={planAuthor}
          onSave={onSaveNote}
          currentAuthor={currentAuthor}
          labelArea={{ gridRow: 1, gridColumn: 2 }}
          expandedArea={{ gridRow: 2, gridColumn: '1 / -1', marginTop: '4px' }}
        />
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

export default function HistoryPopup({ onClose, todayStats, tomorrowTotal, prefetchedSummaries, authorName }) {
  const [summaries, setSummaries] = useState(prefetchedSummaries || []);
  const [loading, setLoading] = useState(!prefetchedSummaries);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    prefetchedSummaries ? prefetchedSummaries.length >= PAGE_SIZE : false
  );
  // 구름 토글: 미래 7일(모레~+6일) plan 표시
  const [showFuture, setShowFuture] = useState(false);
  const [futureRows, setFutureRows] = useState([]);
  const [futureLoaded, setFutureLoaded] = useState(false);

  const today = getKSTToday();
  const tomorrowDate = offsetDate(today, 1);
  // 미래 일자 7일 (모레~+6일)
  const futureDates = Array.from({ length: 7 }, (_, i) => offsetDate(today, 2 + i));

  // prefetch 없을 때만 Supabase fetch
  useEffect(() => {
    if (prefetchedSummaries) return;
    async function fetchSummaries() {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .gte('date', DATA_START_DATE)
        .order('date', { ascending: false })
        .limit(PAGE_SIZE);
      if (!error && data) {
        setSummaries(data);
        setHasMore(data.length >= PAGE_SIZE);
      }
      setLoading(false);
    }
    fetchSummaries();
  }, [prefetchedSummaries]);

  // 미래 plan fetch (토글 ON 시 1회)
  useEffect(() => {
    if (!showFuture || futureLoaded) return;
    async function fetchFuture() {
      const start = futureDates[0];
      const end = futureDates[futureDates.length - 1];
      const { data } = await supabase
        .from('daily_summaries')
        .select('date, plan, plan_author')
        .gte('date', start)
        .lte('date', end);
      if (data) setFutureRows(data);
      setFutureLoaded(true);
    }
    fetchFuture();
  }, [showFuture, futureLoaded]);

  // 농부의 변/자랑/plan 저장 핸들러 — fields = { excuse: '...', excuse_author: '...' } 또는 모두 null로 삭제
  // 미래 일자라 row가 없을 수 있어서 upsert로 처리
  const handleSaveNote = async (date, fields) => {
    const { error } = await supabase
      .from('daily_summaries')
      .upsert({ date, ...fields }, { onConflict: 'date' });
    if (error) {
      alert('저장 실패: ' + error.message);
      return false;
    }
    setSummaries(prev => prev.map(s => s.date === date ? { ...s, ...fields } : s));
    setFutureRows(prev => {
      const exists = prev.some(r => r.date === date);
      if (exists) return prev.map(r => r.date === date ? { ...r, ...fields } : r);
      return [...prev, { date, ...fields }];
    });
    return true;
  };

  const loadMore = async () => {
    if (loadingMore || summaries.length === 0) return;
    setLoadingMore(true);
    const oldest = summaries[summaries.length - 1].date;
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .gte('date', DATA_START_DATE)
      .lt('date', oldest)
      .order('date', { ascending: false })
      .limit(PAGE_SIZE);
    if (!error && data) {
      setSummaries(prev => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '20px',
          width: '100%',
          maxWidth: '380px',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 타이틀 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748' }}>
              📋 작업 히스토리
            </span>
            <button
              onClick={() => setShowFuture(s => !s)}
              title={showFuture ? '미래 일주일 닫기' : '미래 일주일 보기'}
              style={{
                border: 'none', background: 'none',
                cursor: 'pointer',
                padding: '0 4px', lineHeight: 1,
                opacity: showFuture ? 1 : 0.5,
                filter: showFuture ? 'none' : 'grayscale(0.5)',
                transition: 'opacity 0.2s, filter 0.2s',
                display: 'inline-flex', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.85rem', marginRight: '-3px' }}>☁️</span>
              <span style={{ fontSize: '1.5rem' }}>☁️</span>
              <span style={{ fontSize: '0.85rem', marginLeft: '-3px' }}>☁️</span>
            </button>
          </span>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', fontSize: '1.2rem',
              cursor: 'pointer', color: '#a0aec0', padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#a0aec0' }}>
            불러오는 중...
          </div>
        ) : (
          <>
            {/* 미래 7일 (모레~+6일) — 토글 ON 시, 가장 먼 미래가 위 */}
            {showFuture && [...futureDates].reverse().map(d => {
              const row = futureRows.find(r => r.date === d);
              return (
                <PlanRow
                  key={d}
                  date={d}
                  label={formatDate(d)}
                  plan={row?.plan}
                  planAuthor={row?.plan_author}
                  onSaveNote={handleSaveNote}
                  currentAuthor={authorName}
                />
              );
            })}

            {/* 내일 — total=0이어도 plan 슬롯 보이게 항상 표시 */}
            {(() => {
              const tomorrowRow = summaries.find(s => s.date === tomorrowDate) || {};
              return (
                <DayRow
                  date={tomorrowDate}
                  label={formatDate(tomorrowDate)}
                  completed={0}
                  total={tomorrowTotal || 0}
                  isTomorrow
                  plan={tomorrowRow.plan}
                  planAuthor={tomorrowRow.plan_author}
                  onSaveNote={handleSaveNote}
                  currentAuthor={authorName}
                />
              );
            })()}

            {/* 오늘 (실시간, App.jsx에서 계산된 props) */}
            {todayStats && (() => {
              const todayRow = summaries.find(s => s.date === today) || {};
              return (
                <DayRow
                  date={today}
                  label={formatDate(today)}
                  completed={todayStats.completed}
                  total={todayStats.total}
                  greenDots={todayStats.green_dots}
                  kindDots={todayStats.green_dots - todayStats.completed}
                  fakeDots={todayStats.fake_dots}
                  workers={todayStats.workers}
                  isToday
                  plan={todayRow.plan}
                  planAuthor={todayRow.plan_author}
                  onSaveNote={handleSaveNote}
                  currentAuthor={authorName}
                />
              );
            })()}

            {/* 과거 (Supabase) */}
            {summaries
              .filter(s => s.date < today)
              .map(s => (
                <DayRow
                  key={s.date}
                  date={s.date}
                  label={formatDate(s.date)}
                  completed={s.completed}
                  total={s.total}
                  greenDots={s.green_dots}
                  kindDots={s.kind_dots}
                  fakeDots={s.fake_dots}
                  workers={typeof s.workers === 'string' ? JSON.parse(s.workers) : s.workers}
                  excuse={s.excuse}
                  boast={s.boast}
                  excuseAuthor={s.excuse_author}
                  boastAuthor={s.boast_author}
                  plan={s.plan}
                  planAuthor={s.plan_author}
                  onSaveNote={handleSaveNote}
                  currentAuthor={authorName}
                />
              ))
            }

            {summaries.filter(s => s.date < today).length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#a0aec0', fontSize: '0.8rem' }}>
                과거 기록이 없습니다
              </div>
            )}

            {hasMore && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontSize: '0.8rem',
                    color: '#718096',
                    cursor: loadingMore ? 'wait' : 'pointer',
                  }}
                >
                  {loadingMore ? '불러오는 중...' : '이전 기록 더보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
