import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getKSTToday, offsetDate } from '../utils/dailyStats';
import { monthAvgCompletion, topWorkers } from '../lib/historyStats';
import treeIconSVG from '../assets/icons/tree_icon_1.svg';
import farmerCrySVG from '../assets/icons/farmer_cry.svg';
import farmerProudSVG from '../assets/icons/farmer_proud.svg';
import farmerCuriousSVG from '../assets/icons/farmer_curious.svg';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DATA_START_DATE = '2026-04-09'; // 데이터 시작일

// 농부의 변(辯) / 긍지 / ? 비밀번호 — 클라이언트 사이드 가벼운 게이트(보안 X)
const PIN_EDIT = '1234';
const PIN_DELETE = '6687';

// 댓글 시간을 상대 시간으로
function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, ms / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400 / 7)}주 전`;
  if (sec < 86400 * 365) return `${Math.floor(sec / 86400 / 30)}개월 전`;
  return `${Math.floor(sec / 86400 / 365)}년 전`;
}

// 일자별 댓글 슬롯 — 다중 댓글 지원.
// slotType은 부모가 그날 stats 기반으로 결정 ('excuse'|'boast'|'plan').
// 댓글 자체엔 type 정보 없음 (통합 모델). 라벨/색상/아이콘은 slotType에 따라 자동.
function NoteSlot({
  date,
  slotType,
  notes,
  onCreate,
  onUpdate,
  onDelete,
  currentAuthor,
  labelArea = { gridRow: 1, gridColumn: 1 },
  expandedArea = { gridRow: 2, gridColumn: '1 / -1', marginTop: '4px' },
}) {
  const [expanded, setExpanded] = useState(false);
  const [composeDraft, setComposeDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [pinAction, setPinAction] = useState(null); // { type: 'edit'|'delete', noteId }
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [busy, setBusy] = useState(false);

  const symbol = slotType === 'excuse' ? '辯' : slotType === 'boast' ? '긍지' : '?';
  const filledColor =
    slotType === 'excuse' ? '#f5b942' :
    slotType === 'boast' ? '#10b981' :
    '#7DD3FC';
  const bubbleBg =
    slotType === 'excuse' ? '#fef9ef' :
    slotType === 'boast' ? '#ecfdf5' :
    '#f0f9ff';
  const bubbleBorder = filledColor;
  const farmerIcon =
    slotType === 'excuse' ? farmerCrySVG :
    slotType === 'boast' ? farmerProudSVG :
    farmerCuriousSVG;

  const sortedNotes = useMemo(() => {
    return [...(notes || [])].sort((a, b) => {
      const ac = a.created_at || '';
      const bc = b.created_at || '';
      return ac.localeCompare(bc);
    });
  }, [notes]);
  const isEmpty = sortedNotes.length === 0;

  const closeAll = () => {
    setExpanded(false);
    setComposeDraft('');
    setEditingId(null);
    setEditDraft('');
    setPinAction(null);
    setPin('');
    setPinError('');
    setBusy(false);
  };

  const submitCompose = async () => {
    const text = composeDraft.trim();
    if (!text) return;
    setBusy(true);
    const ok = await onCreate(date, text);
    setBusy(false);
    if (ok) setComposeDraft('');
  };

  const submitEdit = async () => {
    const text = editDraft.trim();
    if (!text || editingId == null) return;
    setBusy(true);
    const ok = await onUpdate(editingId, text);
    setBusy(false);
    if (ok) {
      setEditingId(null);
      setEditDraft('');
    }
  };

  const submitPin = async () => {
    if (!pinAction) return;
    const required = pinAction.type === 'edit' ? PIN_EDIT : PIN_DELETE;
    if (pin !== required) {
      setPinError('비밀번호가 틀렸어요');
      return;
    }
    if (pinAction.type === 'edit') {
      const note = sortedNotes.find(n => n.id === pinAction.noteId);
      setEditingId(pinAction.noteId);
      setEditDraft(note?.content || '');
      setPinAction(null);
      setPin('');
      setPinError('');
      return;
    }
    setBusy(true);
    const ok = await onDelete(pinAction.noteId);
    setBusy(false);
    if (ok) {
      setPinAction(null);
      setPin('');
      setPinError('');
    }
  };

  const cancelPin = () => {
    setPinAction(null);
    setPin('');
    setPinError('');
  };

  // 라벨
  const label = isEmpty ? (
    <button
      onClick={() => setExpanded(e => !e)}
      style={{
        background: 'none', border: 'none',
        color: '#a0aec0',
        fontSize: '0.72rem', cursor: 'pointer', padding: 0,
        fontFamily: 'inherit', lineHeight: 1.3,
      }}
    >
      농부의 {symbol}
    </button>
  ) : (
    <span
      onClick={() => setExpanded(e => !e)}
      style={{
        fontSize: '0.72rem', color: filledColor, fontWeight: 700,
        cursor: 'pointer', lineHeight: 1.3,
      }}
    >
      농부의 {symbol} · {sortedNotes.length}
    </span>
  );

  // 댓글 한 개 렌더
  const renderNoteItem = (note) => {
    const isThisEditing = editingId === note.id;
    const isPinForThis = pinAction?.noteId === note.id;

    if (isThisEditing) {
      return (
        <div key={note.id} style={{ marginBottom: '10px' }}>
          <textarea
            value={editDraft}
            onChange={e => setEditDraft(e.target.value)}
            autoFocus
            rows={2}
            style={{
              width: '100%', fontSize: '0.78rem', padding: '6px 8px',
              border: '1px solid #cbd5e1', borderRadius: '6px',
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button onClick={submitEdit} disabled={busy} style={{
              fontSize: '0.7rem', padding: '4px 10px',
              border: `1px solid ${filledColor}`, background: filledColor,
              color: '#fff', borderRadius: '4px',
              cursor: busy ? 'wait' : 'pointer',
            }}>저장</button>
            <button onClick={() => { setEditingId(null); setEditDraft(''); }} disabled={busy} style={{
              fontSize: '0.7rem', padding: '4px 10px',
              border: '1px solid #cbd5e1', background: '#fff',
              color: '#718096', borderRadius: '4px',
              cursor: busy ? 'wait' : 'pointer',
            }}>취소</button>
          </div>
        </div>
      );
    }

    return (
      <div key={note.id} style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <img src={farmerIcon} alt="" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <div style={{
            position: 'relative',
            background: bubbleBg,
            border: `1.5px solid ${bubbleBorder}`,
            borderRadius: '10px',
            padding: '5px 8px',
            fontSize: '0.78rem', color: '#4a5568',
            flex: 1, minWidth: 0,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {/* 꼬리 */}
            <div style={{
              position: 'absolute', left: -7, top: 8,
              width: 0, height: 0,
              borderTop: '5px solid transparent',
              borderRight: `7px solid ${bubbleBorder}`,
              borderBottom: '5px solid transparent',
            }} />
            <div style={{
              position: 'absolute', left: -5, top: 9,
              width: 0, height: 0,
              borderTop: '4px solid transparent',
              borderRight: `6px solid ${bubbleBg}`,
              borderBottom: '4px solid transparent',
            }} />
            {note.author && (
              <span style={{ fontWeight: 700, color: filledColor }}>{note.author}</span>
            )}
            {note.author ? `: ${note.content}` : note.content}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          marginTop: '2px', paddingLeft: '34px',
          fontSize: '0.65rem', color: '#a0aec0',
        }}>
          <span>{relativeTime(note.created_at)}</span>
          {!isPinForThis && (
            <>
              <button onClick={() => { setPinAction({ type: 'edit', noteId: note.id }); setPin(''); setPinError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: '#718096', padding: '0 2px', lineHeight: 1,
                }}>✎</button>
              <button onClick={() => { setPinAction({ type: 'delete', noteId: note.id }); setPin(''); setPinError(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: '#718096', padding: '0 2px', lineHeight: 1,
                }}>🗑</button>
            </>
          )}
        </div>
        {isPinForThis && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
            marginTop: '4px', paddingLeft: '34px',
          }}>
            <span style={{ fontSize: '0.68rem', color: '#718096' }}>
              {pinAction.type === 'edit' ? '수정' : '삭제'} 비번:
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
                width: '60px', fontSize: '0.72rem', padding: '2px 5px',
                border: '1px solid #cbd5e1', borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            />
            <button onClick={submitPin} disabled={busy} style={{
              fontSize: '0.68rem', padding: '2px 6px',
              border: '1px solid #cbd5e1', background: '#fff',
              borderRadius: '4px', cursor: busy ? 'wait' : 'pointer',
            }}>확인</button>
            <button onClick={cancelPin} disabled={busy} style={{
              fontSize: '0.68rem', padding: '2px 6px',
              border: 'none', background: 'none',
              color: '#a0aec0', cursor: busy ? 'wait' : 'pointer',
            }}>취소</button>
            {pinError && (
              <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>
                {pinError}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // 펼친 영역
  let expandedContent = null;
  if (expanded) {
    expandedContent = (
      <div>
        {sortedNotes.map(renderNoteItem)}
        {/* 새 댓글 작성 */}
        <div>
          <textarea
            value={composeDraft}
            onChange={e => setComposeDraft(e.target.value)}
            placeholder={`농부의 ${symbol}...`}
            rows={2}
            style={{
              width: '100%', fontSize: '0.78rem', padding: '6px 8px',
              border: '1px solid #cbd5e1', borderRadius: '6px',
              fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
            <button onClick={submitCompose} disabled={busy || !composeDraft.trim()} style={{
              fontSize: '0.7rem', padding: '4px 10px',
              border: `1px solid ${composeDraft.trim() ? filledColor : '#cbd5e1'}`,
              background: composeDraft.trim() ? filledColor : '#fff',
              color: composeDraft.trim() ? '#fff' : '#cbd5e1',
              borderRadius: '4px',
              cursor: busy || !composeDraft.trim() ? 'not-allowed' : 'pointer',
            }}>댓글 달기</button>
            <button onClick={closeAll} style={{
              fontSize: '0.7rem', padding: '4px 10px',
              border: 'none', background: 'none',
              color: '#a0aec0', cursor: 'pointer',
            }}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ ...labelArea, minWidth: 0 }}>
        {label}
      </div>
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

function DayRow({
  date, label, completed, total, greenDots, kindDots, fakeDots, workers,
  isTomorrow, isToday,
  notes, onCreate, onUpdate, onDelete, currentAuthor,
  onWorkerClick,
}) {
  const pct = total > 0 ? Math.round(completed / total * 100) : null;
  const isEmpty = total === 0;
  const isPast = !isTomorrow && !isToday;
  const isIncomplete = isPast && !isEmpty && pct != null && pct < 100;
  const isComplete = isPast && !isEmpty && pct != null && pct >= 100;

  // 슬롯 종류:
  //   과거 100% → 긍지
  //   과거 미완료 → 변(辯)
  //   그 외(오늘/내일/빈 일자) → ?
  let slotType;
  if (isComplete) slotType = 'boast';
  else if (isIncomplete) slotType = 'excuse';
  else slotType = 'plan';

  const showSlot = !!onCreate;
  const hasWorkers = workers && workers.length > 0;

  return (
    <div style={{
      padding: '0.55rem 0.7rem',
      marginBottom: '0.4rem',
      background: isIncomplete ? '#fef9ef' : isComplete ? '#f0fdf4' : '#ffffff',
      border: isIncomplete
        ? '1px solid #fcd34d'
        : isComplete
          ? '1px solid #86efac'
          : '1px solid #e7d9b8',
      borderRadius: '0.5rem',
    }}>
      {/* 첫째 줄 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        marginBottom: (showSlot || hasWorkers) ? '4px' : 0,
        flexWrap: 'wrap',
        minWidth: 0,
      }}>
        <span style={{
          fontSize: '0.85rem', fontWeight: 700,
          color: isTomorrow ? '#7c3aed' : isIncomplete ? '#e09600' : '#2d3748',
          flexShrink: 0,
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

      {/* 둘째 줄: 슬롯 라벨(col1) + 워커(col2), 펼친 영역은 row2 col 전체 */}
      {(showSlot || hasWorkers) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr',
          columnGap: '8px',
          alignItems: 'center',
          minHeight: '16px',
        }}>
          {/* 미달일 사유 — 단순 inline 표시 (row2 전체) */}
          {isIncomplete && showSlot && (() => {
            const reasonNotes = notes.filter(n => n.type === 'incomplete_reason' || !n.type || n.type === 'summary');
            const latestReason = reasonNotes[reasonNotes.length - 1];
            return (
              <div style={{
                gridRow: 2, gridColumn: '1 / -1',
                marginTop: '4px',
                fontSize: '0.74rem',
                color: '#7c4a00',
                fontStyle: 'italic',
                lineHeight: 1.4,
                padding: '4px 7px',
                background: '#fffbeb',
                borderRadius: '4px',
                borderLeft: '3px solid #f59e0b',
                minWidth: 0,
              }}>
                {latestReason
                  ? `📝 ${latestReason.content}${latestReason.author ? ` (${latestReason.author})` : ''}`
                  : '📝 사유 미제출 — 헤더 ⚠️ 배너에서 입력'}
              </div>
            );
          })()}
          {hasWorkers && (
            <div style={{
              gridRow: 1, gridColumn: '1 / -1',
              fontSize: '0.72rem', color: '#a0aec0',
              minWidth: 0, lineHeight: 1.3,
              wordBreak: 'keep-all',
            }}>
              {workers.map((w, i) => (
                <span key={w.name}>
                  {i > 0 && ' · '}
                  <button
                    onClick={() => onWorkerClick?.(w.name, date)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: '#1f2937', fontSize: 'inherit',
                      fontWeight: 700, cursor: 'pointer',
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      textUnderlineOffset: '2px',
                    }}
                    title={`${w.name}의 ${date} 작업 상세`}
                  >
                    👨‍🌾 {w.name} {w.count}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 미래 plan row (모레~+6일) — 프로그레스바/워커/점들 없음, 날짜 + ? 슬롯만
// 통계 카드 (월평균/TOP/예측)
function StatCard({ label, value, subValue, color }) {
  return (
    <div style={{
      padding: '8px 10px',
      background: '#ffffff',
      border: '1px solid #d1fae5',
      borderRadius: '8px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.65rem', color: '#6b7280', fontWeight: 600, marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '2px' }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

function PlanRow({ date, label }) {
  return (
    <div style={{
      padding: '0.45rem 0.7rem',
      marginBottom: '0.35rem',
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      borderRadius: '0.5rem',
    }}>
      <span style={{
        fontSize: '0.82rem', fontWeight: 700,
        color: '#0c4a6e',
      }}>
        ☁️ {label}
      </span>
    </div>
  );
}

const PAGE_SIZE = 30;

export default function HistoryPopup({ onClose, todayStats, tomorrowTotal, prefetchedSummaries, authorName, onWorkerClick }) {
  const [summaries, setSummaries] = useState(prefetchedSummaries || []);
  const [loading, setLoading] = useState(!prefetchedSummaries);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(
    prefetchedSummaries ? prefetchedSummaries.length >= PAGE_SIZE : false
  );
  // 모든 댓글 (daily_notes)
  const [allNotes, setAllNotes] = useState([]);
  // 구름 토글: 미래 7일(모레~+6일)
  const [showFuture, setShowFuture] = useState(false);

  const today = getKSTToday();
  const tomorrowDate = offsetDate(today, 1);
  // 미래 일자 7일 (모레~+6일)
  const futureDates = Array.from({ length: 7 }, (_, i) => offsetDate(today, 2 + i));

  // 일자별 댓글 인덱스
  const notesByDate = useMemo(() => {
    const map = new Map();
    for (const n of allNotes) {
      const d = typeof n.date === 'string' ? n.date : String(n.date);
      const arr = map.get(d) || [];
      arr.push(n);
      map.set(d, arr);
    }
    return map;
  }, [allNotes]);

  // prefetched 없을 때 stats fetch
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

  // 모든 댓글 fetch (마운트 시)
  useEffect(() => {
    async function fetchNotes() {
      const { data, error } = await supabase
        .from('daily_notes')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) setAllNotes(data);
    }
    fetchNotes();
  }, []);

  // 댓글 작성
  const handleCreateNote = async (date, content, type = 'incomplete_reason') => {
    const { data, error } = await supabase
      .from('daily_notes')
      .insert({ date, author: authorName || null, content, type })
      .select()
      .single();
    if (error) {
      alert('저장 실패: ' + error.message);
      return false;
    }
    if (data) setAllNotes(prev => [...prev, data]);
    return true;
  };

  // 댓글 수정 (작성자도 마지막 수정자로 갱신)
  const handleUpdateNote = async (id, content) => {
    const { data, error } = await supabase
      .from('daily_notes')
      .update({ content, author: authorName || null })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      alert('수정 실패: ' + error.message);
      return false;
    }
    if (data) setAllNotes(prev => prev.map(n => n.id === id ? data : n));
    return true;
  };

  // 댓글 삭제
  const handleDeleteNote = async (id) => {
    const { error } = await supabase
      .from('daily_notes')
      .delete()
      .eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return false;
    }
    setAllNotes(prev => prev.filter(n => n.id !== id));
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
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 9999,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '5vh 1rem',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '1.2rem',
          borderRadius: '1.2rem',
          width: '100%',
          maxWidth: '540px',
          margin: '0 auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '3px solid #86efac',                /* 그린 — 작업/농장 톤 */
          fontFamily: '"Pretendard Variable", sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 타이틀 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '0.7rem',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📋</span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#14532d', fontWeight: 700 }}>
              작업 히스토리
            </h2>
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
            aria-label="닫기"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid #d6c8a8', background: '#fffefb',
              color: '#6b7280', cursor: 'pointer',
              fontSize: '1.05rem', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(120, 90, 40, 0.15)',
              lineHeight: 1, padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 0.9rem' }}>
          매일의 작업 기록과 성취를 한눈에 볼 수 있어요.
        </p>

        {/* ── 📊 통계 카드 (관수/방제 스타일) ── */}
        {!loading && (() => {
          const allSummaries = [
            ...summaries,
            ...(todayStats ? [{ date: today, ...todayStats, workers: todayStats.workers }] : []),
          ];
          const now = new Date();
          const kst = new Date(now.getTime() + 9 * 3600 * 1000);
          const monthYear = kst.getUTCFullYear();
          const monthNum = kst.getUTCMonth() + 1;
          const avgPct = monthAvgCompletion(allSummaries, monthYear, monthNum);
          const top = topWorkers(allSummaries, 30, 1)[0];
          // 내일 예상 = 오늘 다 완료했을 때 내일 켜질 그루수 (시뮬레이션 — 아래 일별 기록의 '오늘 완료 가정' 값과 동일)
          return (
            <div style={{
              padding: '0.7rem 0.8rem',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '0.6rem',
              marginBottom: '0.9rem',
            }}>
              <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700, marginBottom: '0.5rem' }}>
                📊 이번 달 요약
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px',
              }}>
                <StatCard label={`${monthNum}월 평균`} value={avgPct != null ? `${avgPct}%` : '—'} color="#16a34a" />
                <StatCard label="30일 TOP" value={top ? top.name : '—'} subValue={top ? `${top.count}그루` : ''} color="#0284c7" />
                <StatCard
                  label="내일 예상"
                  value={tomorrowTotal != null ? `${tomorrowTotal}그루` : '—'}
                  subValue="오늘 다 완료 가정"
                  color="#a16207"
                />
              </div>
            </div>
          );
        })()}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#a0aec0' }}>
            불러오는 중...
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700, marginBottom: '0.45rem', paddingTop: '0.3rem' }}>
              📅 일별 기록
            </div>
            {/* 미래 7일 (모레~+6일) — 토글 ON 시, 가장 먼 미래가 위 */}
            {showFuture && [...futureDates].reverse().map(d => (
              <PlanRow
                key={d}
                date={d}
                label={formatDate(d)}
                notes={notesByDate.get(d) || []}
                onCreate={handleCreateNote}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
                currentAuthor={authorName}
              />
            ))}

            {/* 내일 — total=0이어도 슬롯 보이게 항상 표시 */}
            <DayRow
              date={tomorrowDate}
              label={formatDate(tomorrowDate)}
              completed={0}
              total={tomorrowTotal || 0}
              isTomorrow
              notes={notesByDate.get(tomorrowDate) || []}
              onCreate={handleCreateNote}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              currentAuthor={authorName}
            />

            {/* 오늘 */}
            {todayStats && (
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
                notes={notesByDate.get(today) || []}
                onCreate={handleCreateNote}
                onUpdate={handleUpdateNote}
                onDelete={handleDeleteNote}
                currentAuthor={authorName}
                onWorkerClick={onWorkerClick}
              />
            )}

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
                  notes={notesByDate.get(s.date) || []}
                  onCreate={handleCreateNote}
                  onUpdate={handleUpdateNote}
                  onDelete={handleDeleteNote}
                  currentAuthor={authorName}
                  onWorkerClick={onWorkerClick}
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
