// src/components/PestTreatmentModal.jsx
// 전체방제 입력 모달 — daily_notes.pest_treatment jsonb 컬럼에 저장
// - 약제 / 배율 / 방식 / 메모
// - 간격 설정 (app_settings)
// 영농일지 모달과 동일 톤앤매너

import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { summarizePest } from '../lib/treatments';

const PRESET_CYCLES = [3, 5, 7, 10, 14, 21];
const DEFAULT_CHEMICALS = ['보르도', 'J인섹터', '석회유황합제', '아바멕틴', '에톡사졸'];
const DEFAULT_DILUTIONS = ['50배', '100배', '500배', '1000배', '2000배'];
const DEFAULT_METHODS = ['연무기', '동력분무기', '수동분무기'];
const HISTORY_LIMIT = 60;

function formatDateShort(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const date = new Date(`${iso}T00:00:00+09:00`);
  const dow = ['일','월','화','수','목','금','토'][date.getDay()];
  return `${parseInt(m)}/${parseInt(d)} (${dow})`;
}

// 옵션 선택 버튼 — onDelete 있으면 추가된 항목으로 보고 × 표시
function OptionButton({ label, selected, onClick, onDelete }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={onClick}
        style={{
          padding: '0.4rem 0.7rem',
          paddingRight: onDelete ? '1.4rem' : '0.7rem',
          fontSize: '0.85rem', fontWeight: 600,
          border: selected ? '2px solid #d97706' : '1px solid #fde68a',
          background: selected ? '#fde68a' : '#fff',
          color: selected ? '#78350f' : '#a16207',
          borderRadius: '0.4rem', cursor: 'pointer',
        }}
      >{label}</button>
      {onDelete && (
        <span
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`${label} 삭제`}
          title="삭제"
          style={{
            position: 'absolute',
            top: -5, right: -5,
            width: 16, height: 16,
            borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', lineHeight: 1,
            border: '1px solid #fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            userSelect: 'none',
          }}
        >×</span>
      )}
    </div>
  );
}

function AddButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.4rem 0.7rem', fontSize: '0.85rem', fontWeight: 600,
        border: '1px dashed #9ca3af',
        background: '#f9fafb', color: '#6b7280',
        borderRadius: '0.4rem', cursor: 'pointer',
      }}
    >+ 기타 추가</button>
  );
}

export default function PestTreatmentModal({ user, onClose, onSaved }) {
  const today = todayKST();
  const [selectedDate, setSelectedDate] = useState(today);
  const [chemical, setChemical] = useState('');
  const [dilution, setDilution] = useState('1000배');
  const [method, setMethod] = useState('연무기');
  const [note, setNote] = useState('');
  const [cycleDays, setCycleDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  // 옵션 리스트 — 처음엔 DEFAULT_*, 사용자가 추가/삭제 가능 (app_settings에 영구 저장)
  const [chemicals, setChemicals] = useState(DEFAULT_CHEMICALS);
  const [dilutions, setDilutions] = useState(DEFAULT_DILUTIONS);
  const [methods, setMethods] = useState(DEFAULT_METHODS);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setExisting(null);
    setChemical('');
    setDilution('1000배');
    setMethod('연무기');
    setNote('');
    (async () => {
      const [dateRes, settingsRes, histRes] = await Promise.all([
        supabase.from('daily_notes')
          .select('*').eq('date', selectedDate).eq('type', 'journal').maybeSingle(),
        supabase.from('app_settings')
          .select('key,value').in('key', [
            'pest_cycle_days', 'pest_chemicals_list', 'pest_dilutions_list', 'pest_methods_list',
          ]),
        supabase.from('daily_notes')
          .select('id,date,author,pest_treatment')
          .not('pest_treatment', 'is', null)
          .order('date', { ascending: false })
          .limit(HISTORY_LIMIT),
      ]);
      if (!alive) return;
      const row = dateRes?.data;
      if (row) {
        setExisting(row);
        const pest = row.pest_treatment;
        if (pest) {
          setChemical(pest.chemical || '');
          setDilution(pest.dilution || '1000배');
          setMethod(pest.method || '연무기');
          setNote(pest.note || '');
        }
      }
      const settings = Object.fromEntries((settingsRes?.data || []).map(r => [r.key, r.value]));
      const cycle = parseInt(settings.pest_cycle_days);
      if (!isNaN(cycle)) setCycleDays(cycle);
      // 리스트 로드: 키가 존재하면 그 값 사용(빈 리스트도 OK), 없으면 DEFAULT
      const parseList = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
      setChemicals('pest_chemicals_list' in settings ? parseList(settings.pest_chemicals_list) : DEFAULT_CHEMICALS);
      setDilutions('pest_dilutions_list' in settings ? parseList(settings.pest_dilutions_list) : DEFAULT_DILUTIONS);
      setMethods('pest_methods_list' in settings ? parseList(settings.pest_methods_list) : DEFAULT_METHODS);
      setHistory((histRes.data || []).filter(h => h.pest_treatment && (h.pest_treatment.chemical || h.pest_treatment.note)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [selectedDate]);

  // 새 옵션 추가
  async function addOption(label, currentList, setter, settingKey, selectedSetter) {
    const value = window.prompt(`새 ${label} 입력:`)?.trim();
    if (!value) return;
    if (currentList.includes(value)) {
      alert('이미 있는 항목이에요.');
      return;
    }
    const newList = [...currentList, value];
    setter(newList);
    selectedSetter(value);
    const { error } = await supabase.from('app_settings')
      .upsert({ key: settingKey, value: newList.join(',') }, { onConflict: 'key' });
    if (error) {
      console.error('app_settings save error:', error);
      alert('저장 실패: ' + error.message + '\n\nSupabase에 app_settings 테이블이 있는지 확인해주세요.');
      // 롤백
      setter(currentList);
    }
  }

  // 옵션 삭제 (모든 옵션 삭제 가능)
  async function deleteOption(value, currentList, setter, settingKey, selectedValue, setSelected) {
    if (!window.confirm(`"${value}" 항목을 목록에서 지울까요?\n(과거 기록은 그대로 남아있어요)`)) return;
    const newList = currentList.filter(v => v !== value);
    setter(newList);
    if (selectedValue === value) setSelected('');
    const { error } = await supabase.from('app_settings')
      .upsert({ key: settingKey, value: newList.join(',') }, { onConflict: 'key' });
    if (error) {
      console.error('app_settings save error:', error);
      alert('삭제 실패: ' + error.message + '\n\nSupabase에 app_settings 테이블이 있는지 확인해주세요.');
      // 롤백
      setter(currentList);
      if (selectedValue === value) setSelected(value);
    }
  }

  // 히스토리에서 그 날의 방제 데이터만 제거 (row는 유지)
  async function handleDeletePest(entry) {
    if (!window.confirm(`${entry.date} 방제 기록을 지울까요?\n(영농일지/관수는 그대로 남아요)`)) return;
    const pw = window.prompt('삭제 비번 입력:');
    if (pw === null) return;
    if (pw !== '6687') { alert('비번이 틀려요'); return; }
    const { error } = await supabase.from('daily_notes')
      .update({ pest_treatment: null })
      .eq('id', entry.id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    setHistory(prev => prev.filter(h => h.id !== entry.id));
    if (existing && entry.id === existing.id) {
      setChemical('');
      setDilution('1000배');
      setMethod('연무기');
      setNote('');
    }
    onSaved?.();
  }

  async function handleSave() {
    if (!chemical.trim()) {
      alert('약제명을 입력해주세요.');
      return;
    }
    setSaving(true);
    const author = user?.user_metadata?.nickname || user?.email || '';
    const pest_treatment = {
      chemical: chemical.trim(),
      dilution: dilution.trim(),
      method: method.trim(),
      note: note.trim(),
      saved_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await supabase.from('daily_notes')
        .update({ pest_treatment, author: existing.author || author })
        .eq('id', existing.id);
    } else {
      result = await supabase.from('daily_notes')
        .insert({ date: selectedDate, type: 'journal', content: '', author, pest_treatment });
    }
    if (result?.error) {
      console.error('Pest treatment save error:', result.error);
      alert('저장 실패: ' + result.error.message);
      setSaving(false);
      return;
    }

    await supabase.from('app_settings')
      .upsert({ key: 'pest_cycle_days', value: String(cycleDays) }, { onConflict: 'key' });

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
          border: '3px solid #fcd34d',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
          <span style={{ fontSize: '1.4rem' }}>💊</span>
          <h2 style={{ margin: 0, fontSize: '1.15rem', flex: 1 }}>
            전체방제 기록 {selectedDate === today && <span style={{ fontSize: '0.8rem', color: '#78350f', fontWeight: 700, background: '#fde68a', padding: '1px 6px', borderRadius: 4 }}>오늘</span>}
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
            ? '오늘 사용한 약제, 배율, 방식을 기록하세요.'
            : '과거 방제 기록을 채워넣고 있어요.'}
        </p>

        {/* ── 방제 히스토리 — 상단 (판단 도움) ── */}
        <div style={{
          marginBottom: '1rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '0.5rem',
          padding: '0.6rem 0.7rem',
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#78350f', marginBottom: '0.4rem' }}>
            💊 최근 방제
            <span style={{ fontSize: '0.7rem', color: '#a3a3a3', fontWeight: 500, marginLeft: '0.3rem' }}>
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
                      background: isSelected ? '#fef3c7' : '#fff',
                      border: isSelected ? '2px solid #f59e0b' : '1px solid #fde68a',
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
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap' }}>
                          {formatDateShort(entry.date)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#78350f', flex: 1 }}>
                          {summarizePest(entry.pest_treatment)}
                        </span>
                        {entry.author && (
                          <span style={{ fontSize: '0.68rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {entry.author}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeletePest(entry)}
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
                    border: '1px dashed #fcd34d', borderRadius: '0.3rem',
                    color: '#92400e', fontSize: '0.75rem', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {showAllHistory ? '접기' : `더보기 (+${history.length - 2}건)`}
                </button>
              )}
            </>
          )}
        </div>

        {/* 약제 — 버튼 only, 모두 삭제 가능 */}
        <div style={{ marginBottom: '0.8rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
            약제 <span style={{ fontWeight: 500, color: '#9ca3af', fontSize: '0.75rem' }}>(× 길게 클릭으로 삭제)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {chemicals.map(c => (
              <OptionButton key={c} label={c} selected={chemical === c}
                onClick={() => setChemical(c)}
                onDelete={() => deleteOption(c, chemicals, setChemicals, 'pest_chemicals_list', chemical, setChemical)}
              />
            ))}
            <AddButton onClick={() => addOption('약제', chemicals, setChemicals, 'pest_chemicals_list', setChemical)} />
          </div>
        </div>

        {/* 배율 — 버튼 only, 모두 삭제 가능 */}
        <div style={{ marginBottom: '0.8rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
            배율 <span style={{ fontWeight: 500, color: '#9ca3af', fontSize: '0.75rem' }}>(× 클릭으로 삭제)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {dilutions.map(d => (
              <OptionButton key={d} label={d} selected={dilution === d}
                onClick={() => setDilution(d)}
                onDelete={() => deleteOption(d, dilutions, setDilutions, 'pest_dilutions_list', dilution, setDilution)}
              />
            ))}
            <AddButton onClick={() => addOption('배율 (예: 1500배)', dilutions, setDilutions, 'pest_dilutions_list', setDilution)} />
          </div>
        </div>

        {/* 방식 — 버튼 only, 모두 삭제 가능 */}
        <div style={{ marginBottom: '0.8rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.4rem' }}>
            방식 <span style={{ fontWeight: 500, color: '#9ca3af', fontSize: '0.75rem' }}>(× 클릭으로 삭제)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {methods.map(m => (
              <OptionButton key={m} label={m} selected={method === m}
                onClick={() => setMethod(m)}
                onDelete={() => deleteOption(m, methods, setMethods, 'pest_methods_list', method, setMethod)}
              />
            ))}
            <AddButton onClick={() => addOption('방식', methods, setMethods, 'pest_methods_list', setMethod)} />
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600, marginBottom: '0.3rem' }}>메모 (선택)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예시) 응애 초기 발생 발견"
            style={{
              width: '100%', minHeight: '50px', padding: '0.6rem',
              borderRadius: '0.5rem', border: '1px solid #e2e8f0',
              background: '#fffbeb', fontFamily: 'inherit', fontSize: '0.95rem',
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
            🔔 방제 간격 — {cycleDays}일에 한 번
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {PRESET_CYCLES.map(c => (
              <button key={c} onClick={() => setCycleDays(c)}
                style={{
                  padding: '0.3rem 0.7rem', fontSize: '0.85rem', fontWeight: 600,
                  border: cycleDays === c ? '2px solid #d97706' : '1px solid #fde68a',
                  background: cycleDays === c ? '#fde68a' : '#fff',
                  color: cycleDays === c ? '#78350f' : '#a16207',
                  borderRadius: '0.4rem', cursor: 'pointer',
                }}>{c}일</button>
            ))}
            <input
              type="number" min="1" max="60" value={cycleDays}
              onChange={(e) => setCycleDays(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 50, padding: '0.3rem', fontSize: '0.85rem', textAlign: 'center',
                border: '1px solid #fde68a', borderRadius: '0.4rem',
              }}
            />
          </div>
        </div>

        {/* 저장/취소 */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleSave}
            disabled={saving || !chemical.trim()}
            style={{
              flex: 1,
              backgroundColor: '#f59e0b', color: '#fff',
              padding: '0.85rem 1rem',
              border: '3px solid #b45309', borderRadius: '0.8rem',
              cursor: saving || !chemical.trim() ? 'not-allowed' : 'pointer',
              opacity: !chemical.trim() ? 0.5 : 1,
              fontSize: '1.05rem', fontWeight: 700,
              boxShadow: '0 5px 0 rgba(180, 83, 9, 0.5)',
            }}
          >
            {existing?.pest_treatment ? '수정 저장' : '저장하기'}
          </button>
          <button
            onClick={onClose} disabled={saving}
            style={{
              backgroundColor: '#fff', color: '#6b7280',
              padding: '0.85rem 1.2rem',
              border: '2px solid #d1d5db', borderRadius: '0.8rem',
              cursor: 'pointer', fontSize: '1.05rem', fontWeight: 600,
            }}
          >
            취소
          </button>
        </div>

        {/* ── 방제 히스토리 (하단 — 제거됨, 상단으로 이동됨) ── */}
        {false && (
        <div style={{ marginTop: '1.2rem', borderTop: '1px solid rgba(168, 132, 70, 0.25)', paddingTop: '0.9rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
            💊 전체방제 히스토리
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginLeft: '0.4rem' }}>
              (총 {history.length}회)
            </span>
          </div>

          {loading ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '0.6rem 0' }}>
              아직 방제 기록이 없어요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '280px', overflowY: 'auto' }}>
              {history.map(entry => {
                const isSelected = entry.date === selectedDate;
                return (
                  <div
                    key={entry.id}
                    style={{
                      position: 'relative',
                      background: isSelected ? '#fef3c7' : '#fffbeb',
                      border: isSelected ? '2px solid #f59e0b' : '1px solid #fde68a',
                      borderRadius: '0.5rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <button
                      onClick={() => setSelectedDate(entry.date)}
                      style={{
                        textAlign: 'left',
                        background: 'transparent', border: 'none',
                        padding: '0.55rem 1.8rem 0.55rem 0.7rem',
                        width: '100%',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                      }}
                    >
                      <span style={{
                        fontSize: '0.78rem', fontWeight: 700, color: '#92400e',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatDateShort(entry.date)}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#78350f', flex: 1 }}>
                        {summarizePest(entry.pest_treatment)}
                      </span>
                      {entry.author && (
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {entry.author}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeletePest(entry)}
                      aria-label="이 방제 기록 삭제"
                      title="이 기록 삭제 (비번 필요)"
                      style={{
                        position: 'absolute',
                        top: '50%', right: 6, transform: 'translateY(-50%)',
                        width: 20, height: 20, borderRadius: '50%',
                        border: '1px solid #d6c8a8', background: '#fff',
                        color: '#9ca3af', cursor: 'pointer',
                        fontSize: '0.7rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, padding: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.borderColor = '#fca5a5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.color = '#9ca3af';
                        e.currentTarget.style.borderColor = '#d6c8a8';
                      }}
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}
          {history.length > 0 && (
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.4rem', textAlign: 'center' }}>
              💡 카드 클릭 → 그 날짜로 이동해서 수정 가능
            </div>
          )}
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}
