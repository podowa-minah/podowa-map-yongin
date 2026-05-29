// src/components/IrrigationModal.jsx
// 전체관수 입력 모달 — daily_notes.irrigation jsonb 컬럼에 저장
// - 동(1~4) 다중 선택
// - 시간(분) 직접 입력
// - 메모
// - 간격(주기) 설정 (app_settings에 저장)
// - 헤더 💧 아이콘 탭 시 열림
// 영농일지 모달과 동일 톤앤매너

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { summarizeIrrigation } from '../lib/treatments';

const BLOCKS = ['1', '2', '3', '4'];
const PRESET_CYCLES = [2, 3, 5, 7, 10, 14];
const HISTORY_LIMIT = 60;

function formatDateShort(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const date = new Date(`${iso}T00:00:00+09:00`);
  const dow = ['일','월','화','수','목','금','토'][date.getDay()];
  return `${parseInt(m)}/${parseInt(d)} (${dow})`;
}

export default function IrrigationModal({ user, onClose, onSaved }) {
  const today = todayKST();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBlocks, setSelectedBlocks] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [note, setNote] = useState('');
  const [cycleDays, setCycleDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setExisting(null);
    setSelectedBlocks([]);
    setDurationMinutes(30);
    setNote('');
    (async () => {
      const [dateRes, settingsRes, histRes] = await Promise.all([
        supabase.from('daily_notes')
          .select('*')
          .eq('date', selectedDate).eq('type', 'journal')
          .maybeSingle(),
        supabase.from('app_settings')
          .select('value').eq('key', 'irrigation_cycle_days').maybeSingle(),
        supabase.from('daily_notes')
          .select('id,date,author,irrigation')
          .not('irrigation', 'is', null)
          .order('date', { ascending: false })
          .limit(HISTORY_LIMIT),
      ]);
      if (!alive) return;
      const row = dateRes?.data;
      if (row) {
        setExisting(row);
        const irr = row.irrigation;
        if (irr) {
          setSelectedBlocks(irr.blocks || []);
          setDurationMinutes(irr.duration_minutes || 30);
          setNote(irr.note || '');
        }
      }
      const cycle = parseInt(settingsRes?.data?.value);
      if (!isNaN(cycle)) setCycleDays(cycle);
      // 관수 있는 날만 (실제로 데이터 들어있는 경우)
      setHistory((histRes.data || []).filter(h => h.irrigation && (h.irrigation.blocks?.length > 0 || h.irrigation.duration_minutes > 0)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [selectedDate]);

  function toggleBlock(b) {
    setSelectedBlocks(prev =>
      prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b].sort()
    );
  }

  // 히스토리에서 그 날의 관수 데이터만 제거 (row는 유지 — journal/방제 있을 수 있음)
  async function handleDeleteIrrigation(entry) {
    if (!window.confirm(`${entry.date} 관수 기록을 지울까요?\n(영농일지/방제는 그대로 남아요)`)) return;
    const pw = window.prompt('삭제 비번 입력:');
    if (pw === null) return;
    if (pw !== '6687') { alert('비번이 틀려요'); return; }
    const { error } = await supabase.from('daily_notes')
      .update({ irrigation: null })
      .eq('id', entry.id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    setHistory(prev => prev.filter(h => h.id !== entry.id));
    // 지금 그 날짜를 보고 있었으면 입력창도 초기화
    if (existing && entry.id === existing.id) {
      setSelectedBlocks([]);
      setDurationMinutes(30);
      setNote('');
    }
    onSaved?.();
  }

  async function handleSave() {
    if (selectedBlocks.length === 0) {
      alert('동을 하나 이상 선택해주세요.');
      return;
    }
    setSaving(true);
    const author = user?.user_metadata?.nickname || user?.email || '';
    const irrigation = {
      blocks: selectedBlocks,
      duration_minutes: durationMinutes,
      note: note.trim(),
      saved_at: new Date().toISOString(),
    };

    // 1. daily_notes 오늘 row UPSERT
    let result;
    if (existing) {
      result = await supabase.from('daily_notes')
        .update({ irrigation, author: existing.author || author })
        .eq('id', existing.id);
    } else {
      result = await supabase.from('daily_notes')
        .insert({ date: selectedDate, type: 'journal', content: '', author, irrigation });
    }
    if (result?.error) {
      console.error('Irrigation save error:', result.error);
      alert('저장 실패: ' + result.error.message);
      setSaving(false);
      return;
    }

    // 2. 간격 설정 동기화 (변경됐을 수 있음)
    await supabase.from('app_settings')
      .upsert({ key: 'irrigation_cycle_days', value: String(cycleDays) }, { onConflict: 'key' });

    setSaving(false);
    onSaved?.();
    onClose();
  }

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 1rem', zIndex: 9999, overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '1.2rem', borderRadius: '1.2rem',
          maxWidth: '500px', width: '100%', margin: '0 auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '3px solid #7dd3fc',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.4rem' }}>💧</span>
          <h2 style={{ margin: 0, fontSize: '1.15rem', flex: 1 }}>
            전체관수 기록 {selectedDate === today && <span style={{ fontSize: '0.8rem', color: '#0c4a6e', fontWeight: 700, background: '#bae6fd', padding: '1px 6px', borderRadius: 4 }}>오늘</span>}
          </h2>
          {/* 닫기 X */}
          <button
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
            style={{
              width: 32, height: 32, flexShrink: 0,
              borderRadius: '50%',
              border: '1px solid #d6c8a8',
              backgroundColor: '#fffefb',
              color: '#6b7280',
              fontSize: '1.05rem', fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(120, 90, 40, 0.15)',
              lineHeight: 1, padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* 날짜 선택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>날짜:</label>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value || today)}
            style={{
              padding: '0.35rem 0.6rem',
              border: '1px solid #d6c8a8', borderRadius: '0.4rem',
              background: '#fffefb', fontFamily: 'inherit', fontSize: '0.9rem',
            }}
          />
          {selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              style={{
                fontSize: '0.75rem', padding: '0.25rem 0.55rem',
                border: '1px solid #d6c8a8', borderRadius: '0.4rem',
                background: '#fff', color: '#6b7280', cursor: 'pointer',
              }}
            >오늘로</button>
          )}
        </div>

        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.9rem' }}>
          {selectedDate === today
            ? '오늘 관수한 동, 시간을 기록하세요.'
            : '과거 관수 기록을 채워넣고 있어요.'}
        </p>

        {/* ── 관수 히스토리 — 상단에 (판단 도움) ── */}
        <div style={{
          marginBottom: '1rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0.5rem',
          padding: '0.6rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c4a6e', marginBottom: '0.4rem' }}>
            💧 최근 관수
            <span style={{ fontSize: '0.7rem', color: '#7c8da3', fontWeight: 500, marginLeft: '0.3rem' }}>
              (총 {history.length}회)
            </span>
          </div>
          {loading ? (
            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>아직 기록 없음</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {(showAllHistory ? history : history.slice(0, 2)).map(entry => {
                  const isSelected = entry.date === selectedDate;
                  return (
                    <div key={entry.id} style={{
                      position: 'relative',
                      background: isSelected ? '#dbeafe' : '#fff',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #bae6fd',
                      borderRadius: '0.4rem',
                    }}>
                      <button
                        onClick={() => setSelectedDate(entry.date)}
                        style={{
                          textAlign: 'left', background: 'transparent', border: 'none',
                          padding: '0.45rem 1.8rem 0.45rem 0.6rem',
                          width: '100%', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}
                      >
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap' }}>
                          {formatDateShort(entry.date)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#1e3a8a', flex: 1 }}>
                          {summarizeIrrigation(entry.irrigation)}
                        </span>
                        {entry.author && (
                          <span style={{ fontSize: '0.68rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {entry.author}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteIrrigation(entry)}
                        aria-label="삭제"
                        title="삭제 (비번 필요)"
                        style={{
                          position: 'absolute', top: '50%', right: 5, transform: 'translateY(-50%)',
                          width: 19, height: 19, borderRadius: '50%',
                          border: '1px solid #d6c8a8', background: '#fff',
                          color: '#9ca3af', cursor: 'pointer', fontSize: '0.68rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          lineHeight: 1, padding: 0,
                        }}
                      >×</button>
                    </div>
                  );
                })}
              </div>
              {history.length > 2 && (
                <button
                  onClick={() => setShowAllHistory(v => !v)}
                  style={{
                    marginTop: '0.4rem', width: '100%',
                    padding: '0.35rem', background: 'transparent',
                    border: '1px dashed #93c5fd', borderRadius: '0.3rem',
                    color: '#1e40af', fontSize: '0.75rem', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {showAllHistory ? '접기' : `더보기 (+${history.length - 2}건)`}
                </button>
              )}
            </>
          )}
        </div>

        {/* 동 선택 */}
        <div style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
            동 선택 (다중)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            {BLOCKS.map(b => {
              const on = selectedBlocks.includes(b);
              return (
                <button
                  key={b}
                  onClick={() => toggleBlock(b)}
                  disabled={loading}
                  style={{
                    padding: '0.85rem 0',
                    border: on ? '2px solid #0ea5e9' : '2px solid #d6c8a8',
                    background: on
                      ? 'linear-gradient(180deg, #bae6fd 0%, #7dd3fc 100%)'
                      : '#fffefb',
                    color: on ? '#0c4a6e' : '#6b7280',
                    fontSize: '1rem', fontWeight: 700,
                    borderRadius: '0.6rem',
                    cursor: 'pointer',
                    boxShadow: on
                      ? '0 3px 0 #0284c7, 0 4px 8px rgba(14, 165, 233, 0.25)'
                      : '0 1px 2px rgba(120, 90, 40, 0.08)',
                    transform: on ? 'translateY(-1px)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {b}동
                </button>
              );
            })}
          </div>
        </div>

        {/* 시간 (분) */}
        <div style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
            시간 (분)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
            <button
              onClick={() => setDurationMinutes(d => Math.max(5, d - 5))}
              style={{
                width: 40, height: 40, flexShrink: 0,
                fontSize: '1.2rem', fontWeight: 700,
                border: '2px solid #d6c8a8', background: '#fffefb',
                borderRadius: '0.5rem', cursor: 'pointer',
              }}
            >−</button>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 0))}
              style={{
                flex: 1, minWidth: 0,
                padding: '0.6rem', fontSize: '1.1rem', fontWeight: 700,
                textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                background: '#f0f9ff', color: '#0c4a6e',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setDurationMinutes(d => Math.min(300, d + 5))}
              style={{
                width: 40, height: 40, flexShrink: 0,
                fontSize: '1.2rem', fontWeight: 700,
                border: '2px solid #d6c8a8', background: '#fffefb',
                borderRadius: '0.5rem', cursor: 'pointer',
              }}
            >+</button>
            <span style={{ fontSize: '0.85rem', color: '#6b7280', flexShrink: 0 }}>분</span>
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
            메모 (선택)
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예시) 비 오기 전 마지막 관수"
            disabled={loading}
            style={{
              width: '100%', minHeight: '50px', padding: '0.6rem',
              borderRadius: '0.5rem', border: '1px solid #e2e8f0',
              backgroundColor: '#f0f9ff', fontFamily: 'inherit', fontSize: '0.95rem',
              resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
        </div>

        {/* 간격 설정 */}
        <div style={{
          marginBottom: '1rem', padding: '0.7rem',
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.6rem',
        }}>
          <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600, marginBottom: '0.4rem' }}>
            🔔 관수 간격 — {cycleDays}일에 한 번
            <span style={{ fontWeight: 500, color: '#a16207', marginLeft: '0.3rem' }}>
              (이 일수 지나면 헤더 💧 불 켜짐)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {PRESET_CYCLES.map(c => (
              <button
                key={c}
                onClick={() => setCycleDays(c)}
                style={{
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.85rem', fontWeight: 600,
                  border: cycleDays === c ? '2px solid #d97706' : '1px solid #fde68a',
                  background: cycleDays === c ? '#fde68a' : '#fff',
                  color: cycleDays === c ? '#78350f' : '#a16207',
                  borderRadius: '0.4rem', cursor: 'pointer',
                }}
              >
                {c}일
              </button>
            ))}
            <input
              type="number"
              min="1" max="30"
              value={cycleDays}
              onChange={(e) => setCycleDays(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 50, padding: '0.3rem',
                fontSize: '0.85rem', textAlign: 'center',
                border: '1px solid #fde68a', borderRadius: '0.4rem',
              }}
            />
          </div>
        </div>

        {/* 저장/취소 */}
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
          <button
            onClick={handleSave}
            disabled={saving || selectedBlocks.length === 0}
            style={{
              flex: 1, minWidth: 0,
              backgroundColor: '#0ea5e9', color: '#fff',
              padding: '0.85rem 0.5rem',
              border: '3px solid #0369a1', borderRadius: '0.8rem',
              cursor: saving || selectedBlocks.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedBlocks.length === 0 ? 0.5 : 1,
              fontSize: '1.05rem', fontWeight: 700,
              boxShadow: '0 5px 0 rgba(3, 105, 161, 0.5)',
              boxSizing: 'border-box',
            }}
          >
            {existing?.irrigation ? '수정 저장' : '저장하기'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              flexShrink: 0,
              backgroundColor: '#fff', color: '#6b7280',
              padding: '0.85rem 1rem',
              border: '2px solid #d1d5db', borderRadius: '0.8rem',
              cursor: 'pointer', fontSize: '1.05rem', fontWeight: 600,
              boxSizing: 'border-box',
            }}
          >
            취소
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
