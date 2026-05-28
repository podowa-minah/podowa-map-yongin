// src/components/JournalInputModal.jsx
// 오늘 영농일지 한 줄 + 사진(최대 3) + 과거 일지 히스토리
// - 헤더 "Podowa" 버튼 탭 시 열림
// - daily_notes.type='journal' 사용 (CLAUDE.md 섹션 10 — 기존 테이블 확장만)

import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../supabaseClient';
import { todayKST } from '../lib/treatment-cycles';
import { createThumbnail } from '../utils/imageThumbnail';
import { fetchDailyWeather, WEATHER_EMOJI, WEATHER_LABEL } from '../lib/weather';
import { summarizeIrrigation, summarizePest, countIrrigation, countPest, countJournal } from '../lib/treatments';

const MAX_PHOTOS = 3;
const HISTORY_LIMIT = 60;  // 최근 60일까지

// "2026-05-28T14:30:00+09:00" → "5/28 (수) 14:30"
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dow = ['일','월','화','수','목','금','토'][d.getDay()];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} (${dow}) ${hh}:${mm}`;
}

export default function JournalInputModal({ user, onClose, onSaved }) {
  const today = todayKST();
  const [selectedDate, setSelectedDate] = useState(today);
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existing, setExisting] = useState(null);
  const [history, setHistory] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // 선택된 날짜의 백암면 날씨 가져오기 (날짜 바뀌면 자동 재요청)
  useEffect(() => {
    let alive = true;
    setWeather(null);
    setWeatherError(false);
    (async () => {
      try {
        const w = await fetchDailyWeather(selectedDate);
        if (alive) setWeather(w);
      } catch (e) {
        console.error('Weather fetch error:', e);
        if (alive) setWeatherError(true);
      }
    })();
    return () => { alive = false; };
  }, [selectedDate]);

  // 선택된 날짜의 일지 + 전체 히스토리
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setExisting(null);
    setContent('');
    setImageUrls([]);
    setThumbnails([]);
    (async () => {
      const { data } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('type', 'journal')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (!alive) return;
      if (data) {
        const dateRow = data.find(n => n.date === selectedDate);
        if (dateRow) {
          setExisting(dateRow);
          setContent(dateRow.content || '');
          setImageUrls(dateRow.image_urls || []);
          setThumbnails(dateRow.thumbnails || []);
        }
        setHistory(data);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [selectedDate]);

  async function handleFileSelected(file) {
    if (!file) return;
    if (imageUrls.length >= MAX_PHOTOS) return;
    setUploading(true);

    // 한글/공백 등 invalid char 방지 — 확장자만 살리고 안전한 ID 사용
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = ext || 'jpg';
    const fileName = `journal/${selectedDate}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const { error } = await supabase.storage.from('tree-images').upload(fileName, file);
    if (error) {
      console.error('Journal photo upload error:', error.message);
      alert('사진 업로드 실패: ' + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('tree-images').getPublicUrl(fileName);

    // 썸네일 생성 & 업로드
    let thumbUrl = '';
    const thumbBlob = await createThumbnail(file);
    if (thumbBlob) {
      const thumbName = `thumb/${fileName}`;
      const { error: thumbErr } = await supabase.storage.from('tree-images').upload(thumbName, thumbBlob);
      if (!thumbErr) {
        const { data: thumbData } = supabase.storage.from('tree-images').getPublicUrl(thumbName);
        thumbUrl = thumbData?.publicUrl || '';
      }
    }

    if (urlData?.publicUrl) {
      setImageUrls(prev => [...prev, urlData.publicUrl]);
      setThumbnails(prev => [...prev, thumbUrl]);
    }
    setUploading(false);
  }

  function handleDeletePhoto(idx) {
    const url = imageUrls[idx];
    const thumb = thumbnails[idx];
    setImageUrls(prev => prev.filter((_, i) => i !== idx));
    setThumbnails(prev => prev.filter((_, i) => i !== idx));
    // 스토리지에서도 제거 (실패 무시)
    if (url) {
      const filePath = url.split('tree-images/')[1];
      if (filePath) {
        supabase.storage.from('tree-images').remove([filePath]).catch(() => {});
      }
    }
    if (thumb) {
      const thumbPath = thumb.split('tree-images/')[1];
      if (thumbPath) {
        supabase.storage.from('tree-images').remove([thumbPath]).catch(() => {});
      }
    }
  }

  // 히스토리 한 건 삭제 (사진까지 같이)
  async function handleDeleteEntry(entry) {
    const dateStr = entry.date || '';
    if (!window.confirm(`${dateStr} 영농일지를 삭제할까요?\n\n사진도 함께 삭제되며 되돌릴 수 없어요.`)) {
      return;
    }
    // 비번 게이트 (앱 컨벤션: 6687 = 삭제)
    const pw = window.prompt('삭제 비번을 입력하세요:');
    if (pw === null) return;             // 취소
    if (pw !== '6687') {
      alert('비번이 틀려요');
      return;
    }

    // 1. 스토리지 사진 제거 (실패 무시)
    const allUrls = [...(entry.image_urls || []), ...(entry.thumbnails || [])];
    for (const url of allUrls) {
      if (!url) continue;
      const filePath = url.split('tree-images/')[1];
      if (filePath) {
        await supabase.storage.from('tree-images').remove([filePath]).catch(() => {});
      }
    }

    // 2. DB row 삭제
    const { error } = await supabase.from('daily_notes').delete().eq('id', entry.id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }

    // 3. 로컬 상태 업데이트
    setHistory(prev => prev.filter(e => e.id !== entry.id));
    // 오늘 거 지운 경우 입력창도 초기화
    if (existing && entry.id === existing.id) {
      setExisting(null);
      setContent('');
      setImageUrls([]);
      setThumbnails([]);
    }
    onSaved?.();
  }

  async function handleSave() {
    const value = content.trim();
    if (!value && imageUrls.length === 0) return;
    setSaving(true);
    const author = user?.user_metadata?.nickname || user?.email || '';
    const payload = {
      content: value,
      author,
      image_urls: imageUrls,
      thumbnails,
      weather: weather || null,  // 그날 백암면 날씨 스냅샷 (jsonb)
    };
    let result;
    if (existing) {
      result = await supabase.from('daily_notes').update(payload).eq('id', existing.id);
    } else {
      result = await supabase.from('daily_notes').insert({ date: selectedDate, type: 'journal', ...payload });
    }
    setSaving(false);
    if (result?.error) {
      console.error('Journal save error:', result.error);
      alert('저장 실패: ' + result.error.message + '\n\nSupabase에서 daily_notes에 type, image_urls, thumbnails 컬럼이 추가됐는지 확인해주세요.');
      return;
    }
    onSaved?.();
    onClose();
  }

  const canSave = !saving && !uploading && (content.trim().length > 0 || imageUrls.length > 0);

  return ReactDOM.createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '4vh 1rem',
        zIndex: 9999,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '1.2rem',
          borderRadius: '1.2rem',
          maxWidth: '540px', width: '100%',
          margin: '0 auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '3px solid #f59e0b',
        }}
      >
        {/* ── 헤더 ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '1.4rem' }}>📔</span>
          <h2 style={{ margin: 0, fontSize: '1.15rem', flex: 1 }}>
            영농일지 {selectedDate === today && <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 700, background: '#fde68a', padding: '1px 6px', borderRadius: 4 }}>오늘</span>}
          </h2>
          {/* 닫기 X — 우측 상단 */}
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

        {/* 날짜 선택 — 과거 일지 채워넣기 가능 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
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

        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.6rem' }}>
          {selectedDate === today
            ? '오늘 농장 전체의 한 줄 감각/요약을 적어주세요.'
            : '과거 일지를 채워넣고 있어요. 사진/날씨 모두 그날 기준으로 저장됩니다.'}
        </p>

        {/* ── 백암면 날씨 자동 표시 — 순수 텍스트 (CSV/Excel 친화) ── */}
        {weather && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '0.6rem',
            padding: '0.5rem 0.7rem',
            marginBottom: '0.7rem',
            fontSize: '0.82rem',
            color: '#78350f',
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.15rem' }}>
              백암면 · {WEATHER_LABEL[weather.code] || ''}
              {weather.tempMax != null && weather.tempMin != null && (
                <span style={{ fontWeight: 500 }}>
                  {' '}· 최고 <b>{weather.tempMax}°</b> 최저 {weather.tempMin}°
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
              {weather.currentTemp != null && <span>지금 {weather.currentTemp}° · </span>}
              {weather.precipitation > 0 && <span>강수 {weather.precipitation}mm · </span>}
              {weather.sunrise && <span>일출 {weather.sunrise} · </span>}
              {weather.sunset && <span>일몰 {weather.sunset}</span>}
              {weather.currentHumidity != null && <span> · 습도 {weather.currentHumidity}%</span>}
            </div>
          </div>
        )}
        {weatherError && (
          <div style={{
            fontSize: '0.75rem', color: '#9ca3af',
            marginBottom: '0.6rem',
          }}>
            날씨 정보를 불러오지 못했어요
          </div>
        )}

        {/* ── 본문 입력 ── */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예시) 비 많이 와서 잎 늘어짐. 내일 배수 점검 필요."
          disabled={loading}
          autoFocus
          style={{
            width: '100%', minHeight: '80px', padding: '0.8rem',
            borderRadius: '0.6rem', border: '1px solid #e2e8f0',
            backgroundColor: '#fffbeb', fontFamily: 'inherit', fontSize: '1rem',
            resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5,
          }}
        />

        {/* ── 사진 ── */}
        <div style={{ marginTop: '0.7rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#4a5568', fontWeight: 600, marginBottom: '0.4rem' }}>
            📷 사진 ({imageUrls.length}/{MAX_PHOTOS})
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading || imageUrls.length >= MAX_PHOTOS}
              style={{
                flex: 1,
                backgroundColor: imageUrls.length >= MAX_PHOTOS ? '#ccc' : '#16a34a',
                color: '#fff',
                padding: '0.55rem 0.6rem',
                border: 'none', borderRadius: '0.5rem',
                cursor: imageUrls.length >= MAX_PHOTOS ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: 600,
              }}
            >
              📷 촬영
            </button>
            <input
              ref={cameraInputRef}
              type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ''; }}
            />
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploading || imageUrls.length >= MAX_PHOTOS}
              style={{
                flex: 1,
                backgroundColor: imageUrls.length >= MAX_PHOTOS ? '#ccc' : '#f97316',
                color: '#fff',
                padding: '0.55rem 0.6rem',
                border: 'none', borderRadius: '0.5rem',
                cursor: imageUrls.length >= MAX_PHOTOS ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: 600,
              }}
            >
              🖼 갤러리
            </button>
            <input
              ref={galleryInputRef}
              type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { handleFileSelected(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>

          {/* 미리보기 썸네일 */}
          {imageUrls.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {imageUrls.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 60, height: 60 }}>
                  <img
                    src={thumbnails[idx] || url}
                    alt=""
                    style={{
                      width: 60, height: 60, objectFit: 'cover',
                      borderRadius: 6, border: '1px solid #e2e8f0',
                    }}
                  />
                  <button
                    onClick={() => handleDeletePhoto(idx)}
                    aria-label="사진 삭제"
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 20, height: 20, borderRadius: '50%',
                      border: 'none', background: '#ef4444', color: '#fff',
                      fontSize: '0.75rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, padding: 0,
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {uploading && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.4rem' }}>
              사진 업로드 중...
            </div>
          )}
        </div>

        {/* ── 저장/취소 ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 1,
              backgroundColor: '#facc15', color: '#1f2937',
              padding: '0.85rem 1rem',
              border: '3px solid #ca8a04', borderRadius: '0.8rem',
              cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: canSave ? 1 : 0.6,
              fontSize: '1.05rem', fontWeight: 700,
              boxShadow: '0 5px 0 rgba(133, 77, 14, 0.5)',
            }}
          >
            {existing ? '수정 저장' : '저장하기'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
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

        {/* ── 히스토리 ── */}
        <div style={{ marginTop: '1.2rem', borderTop: '1px solid rgba(168, 132, 70, 0.25)', paddingTop: '0.9rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
            📚 영농일지 히스토리
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginLeft: '0.4rem' }}>
              (최근 {history.length}건)
            </span>
          </div>

          {/* 년도별 누적 요약 카드 */}
          {history.length > 0 && (() => {
            const currentYear = new Date().getFullYear();
            const thisYearHistory = history.filter(h => h.date && h.date.startsWith(String(currentYear)));
            return (
              <div style={{
                marginBottom: '0.7rem',
                background: '#fffefb',
                border: '1px solid #d6c8a8',
                borderRadius: '0.6rem',
                padding: '0.6rem 0.8rem',
                boxShadow: '0 1px 2px rgba(120, 90, 40, 0.06)',
              }}>
                <div style={{
                  fontSize: '0.78rem', fontWeight: 700, color: '#92400e',
                  marginBottom: '0.4rem',
                }}>
                  {currentYear}년 누적
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                }}>
                  <div style={{
                    textAlign: 'center',
                    padding: '0.4rem 0',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '0.4rem',
                  }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>관수</div>
                    <div style={{ fontSize: '1.05rem', color: '#1e40af', fontWeight: 800 }}>
                      {countIrrigation(thisYearHistory)}<span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '2px' }}>회</span>
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    padding: '0.4rem 0',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '0.4rem',
                  }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>방제</div>
                    <div style={{ fontSize: '1.05rem', color: '#92400e', fontWeight: 800 }}>
                      {countPest(thisYearHistory)}<span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '2px' }}>회</span>
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    padding: '0.4rem 0',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '0.4rem',
                  }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>일지</div>
                    <div style={{ fontSize: '1.05rem', color: '#166534', fontWeight: 800 }}>
                      {countJournal(thisYearHistory)}<span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: '2px' }}>건</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {loading ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>불러오는 중...</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '0.6rem 0' }}>
              아직 작성된 일지가 없어요. 오늘부터 한 줄씩 쌓아가요!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '360px', overflowY: 'auto' }}>
              {history.map(entry => {
                const isToday = entry.date === today;
                const isSelected = entry.date === selectedDate;
                return (
                <div
                  key={entry.id}
                  style={{
                    background: isToday ? '#fef9e7' : '#fffefb',
                    border: isToday ? '2px solid #f59e0b' : '1px solid #e7d9b8',
                    borderRadius: '0.6rem',
                    padding: '0.6rem 0.7rem',
                    boxShadow: '0 1px 2px rgba(120, 90, 40, 0.06)',
                    position: 'relative',
                  }}
                >
                  {/* 삭제 버튼 (우측 상단) */}
                  <button
                    onClick={() => handleDeleteEntry(entry)}
                    aria-label="이 일지 삭제"
                    title="이 일지 삭제 (비번 필요)"
                    style={{
                      position: 'absolute',
                      top: 4, right: 4,
                      width: 22, height: 22,
                      borderRadius: '50%',
                      border: '1px solid #d6c8a8',
                      background: '#fff',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1,
                      padding: 0,
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
                  >
                    ×
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                    {isToday && (
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, color: '#92400e',
                        background: '#fde68a', padding: '1px 6px', borderRadius: '4px',
                      }}>오늘</span>
                    )}
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400e' }}>
                      {formatDateTime(entry.created_at)}
                    </span>
                    {entry.author && (
                      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        · {entry.author}
                      </span>
                    )}
                  </div>
                  {/* 그날 날씨 (있으면) — 작게 */}
                  {entry.weather && (
                    <div style={{ fontSize: '0.72rem', color: '#92400e', marginBottom: '0.25rem' }}>
                      {WEATHER_LABEL[entry.weather.code] || ''}
                      {entry.weather.tempMax != null && entry.weather.tempMin != null && (
                        <span> · 최고 {entry.weather.tempMax}° 최저 {entry.weather.tempMin}°</span>
                      )}
                      {entry.weather.precipitation > 0 && (
                        <span> · 강수 {entry.weather.precipitation}mm</span>
                      )}
                    </div>
                  )}
                  {entry.content && (
                    <div style={{ fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.45, marginBottom: entry.thumbnails?.length > 0 ? '0.4rem' : 0 }}>
                      {entry.content}
                    </div>
                  )}
                  {entry.thumbnails && entry.thumbnails.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginBottom: (entry.irrigation || entry.pest_treatment) ? '0.4rem' : 0 }}>
                      {entry.thumbnails.map((t, i) => t && (
                        <a key={i} href={entry.image_urls?.[i] || t} target="_blank" rel="noreferrer">
                          <img
                            src={t}
                            alt=""
                            style={{
                              width: 44, height: 44, objectFit: 'cover',
                              borderRadius: 4, border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* 관수 라인 (있으면) — 파란 배경으로 강조 */}
                  {entry.irrigation && (entry.irrigation.blocks?.length > 0 || entry.irrigation.note) && (
                    <div style={{
                      marginTop: '0.35rem',
                      padding: '0.4rem 0.55rem',
                      background: '#eff6ff',
                      borderLeft: '3px solid #3b82f6',
                      borderRadius: '0.35rem',
                      fontSize: '0.8rem',
                      color: '#1e3a8a',
                    }}>
                      <span style={{ fontWeight: 700 }}>💧 관수</span>
                      {' '}{summarizeIrrigation(entry.irrigation)}
                    </div>
                  )}
                  {/* 방제 라인 (있으면) — 노란 배경으로 강조 */}
                  {entry.pest_treatment && (entry.pest_treatment.chemical || entry.pest_treatment.note) && (
                    <div style={{
                      marginTop: '0.35rem',
                      padding: '0.4rem 0.55rem',
                      background: '#fffbeb',
                      borderLeft: '3px solid #f59e0b',
                      borderRadius: '0.35rem',
                      fontSize: '0.8rem',
                      color: '#78350f',
                    }}>
                      <span style={{ fontWeight: 700 }}>💊 방제</span>
                      {' '}{summarizePest(entry.pest_treatment)}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
