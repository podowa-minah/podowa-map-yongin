// src/AnalysisPage.jsx
// 현황분석 — 자동 일일 리포트 + 농부 입력 (영농일지 통합 페이지)
// 디자인: 뉴스레터/잡지 풍

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { todayKST } from './lib/treatment-cycles';
import { buildDailyReport, getDominantSeason } from './lib/dailyReport';
import { irrigationGroupsText } from './lib/treatments';
import { getSeasonalTermInfo } from './lib/seasonalTerms';
import { getMoonPhase } from './lib/moonPhase';
import { getMoonZodiac, FRAMEWORK_NAME } from './lib/zodiacMoon';
import { getFarmCurrentStage, getStageFocus } from './lib/grape-stages';
import MoonZodiacPopup from './components/MoonZodiacPopup';
import Constellation from './components/Constellation';
import DayTypeIcon from './components/DayTypeIcon';
import { scoreBand, avgScore } from './lib/scoring';
import { avgFromRecords } from './lib/trends';
import { missionsByDate } from './lib/manual';
import { finalMarksByDate } from './lib/cluster-thinning';
import { fetchDailyWeather, WEATHER_LABEL } from './lib/weather';
import { createThumbnail } from './utils/imageThumbnail';
import AiUrgentTasks from './components/AiUrgentTasks';
import { clockOut } from './utils/farmerClock';

const ENV_MAX_PHOTOS = 2;

export default function AnalysisPage({ treeData = {}, labels = {}, user, onOpenIrrigation, onOpenPest, onSaved, onOpenScores, onOpenTree, onOpenBriefing, onClose }) {
  const today = todayKST();
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayNote, setDayNote] = useState(null);

  // 농부 입력 state
  const [envNote, setEnvNote] = useState('');
  const [growthNote, setGrowthNote] = useState('');   // 생육 농부 기록 (카테고리 저장)
  const [pestNote, setPestNote] = useState('');       // 병해충 농부 기록 (카테고리 저장)
  const [envImageUrls, setEnvImageUrls] = useState([]);
  const [envThumbnails, setEnvThumbnails] = useState([]);
  const [oneLiner, setOneLiner] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);   // 최종 퇴근 처리 중
  const [clockedOut, setClockedOut] = useState(false);      // 오늘 퇴근 완료 표시
  const [historyKey, setHistoryKey] = useState(0);   // 저장 시 history 새로고침
  const [history, setHistory] = useState([]);
  const [missionMap, setMissionMap] = useState({});   // {날짜: [미션칩…]} — manual_completions에서 계산
  const [showAllHistory, setShowAllHistory] = useState(false);   // 영농일지 더보기
  const [moonPopupOpen, setMoonPopupOpen] = useState(false);    // 오늘의 하늘 상세 팝업

  // 날씨
  const [weather, setWeather] = useState(null);

  // 과거 리포트 리스트
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('daily_notes')
        .select('id,date,author,content,journal_notes,weather,irrigation,pest_treatment')
        .eq('type', 'journal')
        .order('date', { ascending: false })
        .limit(60);
      if (!alive) return;
      setHistory(data || []);
    })();
    return () => { alive = false; };
  }, [historyKey]);

  // 이달의 포도 미션 "했어요" 완료 → 날짜별 묶음 (영농일지 칩용, 진실은 manual_completions 한 곳)
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: comps }, { data: its }] = await Promise.all([
        supabase.from('manual_completions').select('item_id,done_on').order('done_on', { ascending: false }).limit(500),
        supabase.from('manual_items').select('id,title,category,month'),
      ]);
      if (!alive) return;
      setMissionMap(missionsByDate(comps || [], its || []));
    })();
    return () => { alive = false; };
  }, [historyKey]);

  // 날짜별 "최종완료"(송이크기정리/알솎이) — trees에서 계산해 영농일지 칩으로 (저장 X, §10)
  const finalMap = useMemo(() => finalMarksByDate(treeData, labels), [treeData, labels]);

  // 밭 평균 현재 생육시기 — 만개 기록만 있으면 그날 기록 없어도 항상 뜸(§10 계산)
  const farmStage = useMemo(() => getFarmCurrentStage(treeData, selectedDate), [treeData, selectedDate]);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // 날씨 가져오기
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await fetchDailyWeather(selectedDate);
        if (alive) setWeather(w);
      } catch {}
    })();
    return () => { alive = false; };
  }, [selectedDate]);

  // daily_notes 그날 row
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('daily_notes')
        .select('*')
        .eq('date', selectedDate)
        .eq('type', 'journal')
        .maybeSingle();
      if (!alive) return;
      setDayNote(data || null);
      // 농부 입력 state 채우기
      const env = data?.journal_notes?.env || {};
      setEnvNote(env.note || '');
      setEnvImageUrls(env.image_urls || []);
      setEnvThumbnails(env.thumbnails || []);
      setGrowthNote(data?.journal_notes?.growth?.note || '');
      setPestNote(data?.journal_notes?.pest?.note || '');
      setOneLiner(data?.content || '');
    })();
    return () => { alive = false; };
  }, [selectedDate]);

  // 그날 trees 기록 추출
  const records = useMemo(() => {
    const out = [];
    for (const treeId of Object.keys(treeData)) {
      const days = treeData[treeId] || [];
      for (const r of days) {
        if (r.date === selectedDate) out.push({ id: treeId, ...r });
      }
    }
    return out;
  }, [treeData, selectedDate]);

  const report = useMemo(() => buildDailyReport({ records, labels }), [records, labels]);
  const past5 = useMemo(() => avgFromRecords(treeData, selectedDate, 5), [treeData, selectedDate]);

  const isToday = selectedDate === today;

  // 사진 업로드
  async function handleEnvUpload(file) {
    if (!file) return;
    if (envImageUrls.length >= ENV_MAX_PHOTOS) return;
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = ext || 'jpg';
    const fileName = `journal/${selectedDate}-env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const { error } = await supabase.storage.from('tree-images').upload(fileName, file);
    if (error) { alert('업로드 실패: ' + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('tree-images').getPublicUrl(fileName);
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
      setEnvImageUrls(prev => [...prev, urlData.publicUrl]);
      setEnvThumbnails(prev => [...prev, thumbUrl]);
    }
    setUploading(false);
  }

  function handleEnvDelete(idx) {
    const url = envImageUrls[idx]; const thumb = envThumbnails[idx];
    setEnvImageUrls(prev => prev.filter((_, i) => i !== idx));
    setEnvThumbnails(prev => prev.filter((_, i) => i !== idx));
    if (url) {
      const path = url.split('tree-images/')[1];
      if (path) supabase.storage.from('tree-images').remove([path]).catch(() => {});
    }
    if (thumb) {
      const path = thumb.split('tree-images/')[1];
      if (path) supabase.storage.from('tree-images').remove([path]).catch(() => {});
    }
  }

  // 과거 리포트 삭제 (비번 6687)
  async function handleDeleteReport(entry, e) {
    e?.stopPropagation();
    const dateStr = entry.date || '';
    if (!window.confirm(`${dateStr} 리포트를 삭제할까요?\n사진/관수/방제 기록까지 함께 사라져요.`)) return;
    const pw = window.prompt('삭제 비번 입력:');
    if (pw === null) return;
    if (pw !== '6687') { alert('비번이 틀려요'); return; }
    // 사진까지 스토리지에서 제거
    const allUrls = [];
    const jn = entry.journal_notes || {};
    ['growth', 'env', 'env_indoor', 'env_outdoor', 'pest'].forEach(k => {
      (jn[k]?.image_urls || []).forEach(u => allUrls.push(u));
      (jn[k]?.thumbnails || []).forEach(u => allUrls.push(u));
    });
    (entry.image_urls || []).forEach(u => allUrls.push(u));
    (entry.thumbnails || []).forEach(u => allUrls.push(u));
    for (const url of allUrls) {
      if (!url) continue;
      const filePath = url.split('tree-images/')[1];
      if (filePath) await supabase.storage.from('tree-images').remove([filePath]).catch(() => {});
    }
    // DB row 삭제
    const { error } = await supabase.from('daily_notes').delete().eq('id', entry.id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    // 로컬 상태 갱신
    setHistory(prev => prev.filter(h => h.id !== entry.id));
    if (entry.id === dayNote?.id) {
      setDayNote(null);
      setEnvNote(''); setEnvImageUrls([]); setEnvThumbnails([]); setGrowthNote(''); setPestNote(''); setOneLiner('');
    }
    onSaved?.();
  }

  // 보고서 완료 = 저장
  async function handleComplete() {
    setSaving(true);
    const author = user?.user_metadata?.nickname || user?.email || '';
    const isPastDate = selectedDate < today;
    // ⚠️ 최신 row 다시 읽어 briefing.snapshot(AI 긴급할일 체크=doneTasks 등) 보존
    //    — 페이지 연 뒤 체크한 게 옛 dayNote로 덮여 리셋되던 버그 방지
    const { data: fresh } = await supabase.from('daily_notes')
      .select('journal_notes').eq('date', selectedDate).eq('type', 'journal').maybeSingle();
    const journal_notes = {
      ...(fresh?.journal_notes || dayNote?.journal_notes || {}),
      env: {
        note: envNote.trim(),
        image_urls: envImageUrls,
        thumbnails: envThumbnails,
      },
      growth: { note: growthNote.trim() },   // 생육 농부 기록
      pest: { note: pestNote.trim() },        // 병해충 농부 기록
    };
    const payload = {
      content: oneLiner.trim(),
      author,
      journal_notes,
      weather: weather ? { ...weather, _final: isPastDate } : (dayNote?.weather || null),
    };
    let result;
    if (dayNote) {
      result = await supabase.from('daily_notes').update(payload).eq('id', dayNote.id);
    } else {
      result = await supabase.from('daily_notes').insert({ date: selectedDate, type: 'journal', ...payload });
    }
    setSaving(false);
    if (result?.error) {
      alert('저장 실패: ' + result.error.message);
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    // 새로 fetch
    const { data } = await supabase.from('daily_notes').select('*')
      .eq('date', selectedDate).eq('type', 'journal').maybeSingle();
    setDayNote(data || null);
    setHistoryKey(k => k + 1);
    onSaved?.();
  }

  // 최종 퇴근 — 이 순간을 퇴근 시각으로 기록(손님 앱 타임라인 연동)
  async function handleClockOut() {
    if (clockingOut || clockedOut) return;
    if (!window.confirm('오늘 최종 퇴근으로 기록할까요?\n(손님 앱에 이 시각이 퇴근으로 표시돼요)')) return;
    setClockingOut(true);
    const ok = await clockOut();
    setClockingOut(false);
    if (ok) setClockedOut(true);
    else alert('퇴근 기록에 실패했어요. 잠시 후 다시 시도해주세요.');
  }

  // 컬러
  const C = {
    headlineFont: 'Arvo, "Pretendard Variable", serif',
    border: '#1f2937',
    muted: '#9ca3af',
    text: '#1f2937',
    accentBg: '#fffbeb',
    accentBorder: '#fde68a',
  };
  // 존 카드 박스 — ① 생육시기 카드와 같은 톤(②③도 박스에 담기게)
  const zoneBox = {
    marginBottom: '1.8rem', padding: '0.95rem 1rem',
    background: '#fffefb', border: `1.5px solid ${C.border}`, borderRadius: '0.5rem',
  };

  return (
    <div style={{
      maxWidth: '580px', margin: '0 auto',
      padding: '1.2rem 1.2rem 6rem',
      color: C.text, fontFamily: '"Pretendard Variable", sans-serif',
      position: 'relative',
    }}>
      {/* ✕ 닫기 — 완전 우측 상단 (다른 요소와 분리) */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="닫기"
          title="닫기 (이전 화면으로)"
          style={{
            position: 'absolute',
            top: '0.6rem',
            right: '0.8rem',
            width: 36, height: 36, borderRadius: '50%',
            border: `1.5px solid ${C.border}`,
            background: '#fff', color: C.text,
            cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: 0,
            zIndex: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          }}
        >✕</button>
      )}
      {/* 날짜 선택 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
        <input
          type="date" value={selectedDate} max={today}
          onChange={(e) => setSelectedDate(e.target.value || today)}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #d6c8a8', borderRadius: '0.4rem', fontSize: '0.9rem' }}
        />
        {selectedDate !== today && (
          <button onClick={() => setSelectedDate(today)}
            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', border: '1px solid #d6c8a8', borderRadius: '0.4rem', background: '#fff', cursor: 'pointer' }}>
            오늘로
          </button>
        )}
      </div>

      {/* 헤더 */}
      <header style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: C.headlineFont, fontSize: '1.9rem', fontWeight: 700, margin: '0 0 0.2rem' }}>
            현황 분석
          </h1>
          <p style={{ fontSize: '0.85rem', color: C.muted, margin: 0 }}>
            {selectedDate === today ? '오늘의 밭, 한눈에' : `${selectedDate}의 밭, 한눈에`}
          </p>
        </div>
        {onOpenScores && (
          <button
            onClick={onOpenScores}
            style={{
              fontSize: '0.78rem', fontWeight: 600,
              padding: '6px 12px',
              border: `1px solid ${C.border}`,
              borderRadius: '6px',
              background: '#fff', color: C.text,
              cursor: 'pointer', whiteSpace: 'nowrap',
              marginRight: '3.2rem',           /* ✕ 버튼 자리 비우기 */
            }}
          >점수기준 →</button>
        )}
      </header>

      {/* ═══ ① 오늘의 포도와 — 상태 한눈에 ═══ */}
      <ZoneHeader num="1" title="오늘의 포도와" subtitle="생육시기 · 날씨 · 하늘" C={C} />

      {/* 생육시기 + 날씨 + 오늘의 하늘 카드 */}
      {(() => {
        const termInfo = getSeasonalTermInfo(selectedDate);
        const moon = getMoonPhase(selectedDate);
        const zodiac = getMoonZodiac(selectedDate);
        return (
          <div style={{
            marginBottom: '1.8rem',
            padding: '0.95rem 1rem',
            background: '#fffefb',
            border: `1.5px solid ${C.border}`,
            borderRadius: '0.5rem',
          }}>
            {/* 생육시기 — 밭 평균 + N주차 + 한 줄 핵심 */}
            <div style={{
              fontFamily: C.headlineFont,
              fontSize: '1.35rem',
              fontWeight: 700,
              color: C.text,
              marginBottom: farmStage && getStageFocus(farmStage.num) ? '0.15rem' : '0.35rem',
              letterSpacing: '0.3px',
            }}>
              생육시기 · {farmStage?.name || report.dominantSeason || '기록 없음'}{farmStage?.weekInStage ? ` ${farmStage.weekInStage}주차` : ''}
            </div>
            {farmStage && getStageFocus(farmStage.num) && (
              <div style={{ fontSize: '0.84rem', color: '#7a6a4a', marginBottom: '0.45rem', lineHeight: 1.45 }}>
                {getStageFocus(farmStage.num)}
              </div>
            )}

            {/* 날씨 줄 */}
            {weather && (
              <div style={{
                fontFamily: C.headlineFont,
                fontSize: '0.88rem',
                color: '#4b5563',
                lineHeight: 1.5,
                marginBottom: '0.7rem',
              }}>
                백암면 · {WEATHER_LABEL[weather.code] || ''} {weather.tempMax}°/{weather.tempMin}°
                {(weather.humidityMean != null || weather.currentHumidity != null) && (
                  <> · 습도 {weather.humidityMean ?? weather.currentHumidity}%</>
                )}
              </div>
            )}

            {/* 오늘의 하늘 — 깔끔 카드, 누르면 상세 팝업 */}
            {(moon || termInfo || zodiac) && (
              <button
                onClick={() => setMoonPopupOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  width: '100%', textAlign: 'left',
                  padding: '0.65rem 0.85rem',
                  background: '#fffaed',
                  border: `1px solid ${C.border}80`,
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                aria-label="오늘의 하늘 상세"
              >
                {moon && <span style={{ fontSize: '1.8rem', lineHeight: 1, flexShrink: 0 }}>{moon.emoji}</span>}
                <div style={{ flex: 1, fontSize: '0.84rem', color: '#374151', lineHeight: 1.65 }}>
                  {moon && <div><b style={skyLabel}>달</b> {moon.name}</div>}
                  {termInfo && <div><b style={skyLabel}>절기</b> {termInfo.name} <span style={{ color: '#9ca3af' }}>— {termInfo.meaning}</span></div>}
                  {zodiac && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <b style={skyLabel}>별자리</b>
                      <Constellation signName={zodiac.name} size={22} />
                      <span>{zodiac.name}</span>
                    </div>
                  )}
                  {zodiac && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <b style={skyLabel}>{FRAMEWORK_NAME}</b>
                      <DayTypeIcon type={zodiac.dayType} size={16} />
                      <span>{zodiac.dayLabel}</span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.85rem', color: '#a89968', flexShrink: 0 }}>ⓘ</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* ═══ ② 오늘 할 일 — AI가 알려줘요 ═══ */}
      <ZoneHeader num="2" title="오늘 할 일" subtitle="AI 브리핑 · 긴급 할일" C={C} />

      <div style={zoneBox}>
        {/* 오늘 AI 브리핑 다시 보기 (열면 풀 브리핑, 빠진 날은 자동 채움) */}
        {onOpenBriefing && (
          <button onClick={onOpenBriefing} style={todayBriefingBtn}>
            <span>🤖 오늘 AI 브리핑 보기</span>
            <span style={{ fontSize: '1.25rem', opacity: 0.85, lineHeight: 1 }}>›</span>
          </button>
        )}

        {/* AI 긴급 오늘 할 일 — 좌표 없는 밭 할 일 체크리스트(오늘만). 체크 → doneTasks 누적 */}
        {selectedDate === today && <AiUrgentTasks today={today} onChange={onSaved} />}
      </div>

      {/* ═══ ③ 오늘 기록 — 매일 꼭 쓰는 보고(강조) ═══ */}
      <ZoneHeader
        num="3"
        title={isToday ? '오늘 기록' : `${formatDateLine(selectedDate)} 기록`}
        subtitle="활동 · 환경/생육/병해충 · 한 줄 코멘트"
        badge="매일 꼭"
        C={C}
      />

      <div style={zoneBox}>
      {/* 오늘 활동 */}
      <Section title="오늘 활동" C={C}>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: 1.7 }}>
          {dayNote?.irrigation && (dayNote.irrigation.blocks?.length > 0 || dayNote.irrigation.duration_minutes) && (
            <li>
              관수: {irrigationGroupsText(dayNote.irrigation)}
              {dayNote.irrigation.note && <span style={{ color: '#6b7280' }}> · {dayNote.irrigation.note}</span>}
              {onOpenIrrigation && (
                <button onClick={onOpenIrrigation} style={editBtnStyle}>수정</button>
              )}
            </li>
          )}
          {!dayNote?.irrigation && onOpenIrrigation && (
            <li style={{ color: C.muted }}>
              관수 기록 없음 · <button onClick={onOpenIrrigation} style={editBtnStyle}>입력</button>
            </li>
          )}
          {dayNote?.pest_treatment && (dayNote.pest_treatment.chemical || dayNote.pest_treatment.note) && (
            <li>
              방제: {dayNote.pest_treatment.chemical} · {dayNote.pest_treatment.dilution}
              {dayNote.pest_treatment.method && ` · ${dayNote.pest_treatment.method}`}
              {onOpenPest && <button onClick={onOpenPest} style={editBtnStyle}>수정</button>}
            </li>
          )}
          {!dayNote?.pest_treatment && onOpenPest && (
            <li style={{ color: C.muted }}>
              방제 기록 없음 · <button onClick={onOpenPest} style={editBtnStyle}>입력</button>
            </li>
          )}
          {report.records.length > 0 ? (
            <li>
              {report.records.length}그루 기록 · 작업자 {' '}
              {report.workerBreakdown.map(w => `${w.name} ${w.count}`).join(', ')}
            </li>
          ) : (
            <li style={{ color: C.muted }}>나무 기록 없음</li>
          )}
          {report.bloomCount > 0 && <li>만개 {report.bloomCount}건</li>}
          {report.partialTreatmentCount > 0 && <li>부분방제 {report.partialTreatmentCount}그루</li>}
          {report.bugDetectedCount > 0 && <li>해충 발견 {report.bugDetectedCount}그루</li>}
        </ul>
      </Section>

      {/* ─── 농부 입력 (환경·생육·병해충 범주별 기록) ─── */}
      <Section title="오늘 기록 · 환경 · 생육 · 병해충" right="농부 입력" C={C}>
        <p style={{ fontSize: '0.78rem', color: C.muted, margin: '0 0 0.5rem' }}>
          꼭 남길 관찰을 범주별로 적어요 — 나중에 자료로 모입니다.
        </p>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c447c', margin: '0 0 0.3rem' }}>환경 <span style={{ fontWeight: 400, color: C.muted }}>날씨·관수·토양</span></div>
        <textarea
          value={envNote}
          onChange={(e) => setEnvNote(e.target.value)}
          placeholder="예: 오전 비 30mm, 4동 배수 막힘 확인"
          style={{
            width: '100%', minHeight: '60px', padding: '0.6rem',
            border: '1px solid #d6c8a8', borderRadius: '0.4rem',
            fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#27500a', margin: '0.8rem 0 0.3rem' }}>생육 <span style={{ fontWeight: 400, color: C.muted }}>세력·균형·생육시기</span></div>
        <textarea
          value={growthNote}
          onChange={(e) => setGrowthNote(e.target.value)}
          placeholder="예: 매니큐어 세력 강함, 2-13 끝순 약함"
          style={{
            width: '100%', minHeight: '55px', padding: '0.6rem',
            border: '1px solid #d6c8a8', borderRadius: '0.4rem',
            fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box',
          }}
        />

        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#a32d2d', margin: '0.8rem 0 0.3rem' }}>병해충 <span style={{ fontWeight: 400, color: C.muted }}>발생·방제</span></div>
        <textarea
          value={pestNote}
          onChange={(e) => setPestNote(e.target.value)}
          placeholder="예: 1-5 유충 발견, 4-2 깍지 줄어듦"
          style={{
            width: '100%', minHeight: '55px', padding: '0.6rem',
            border: '1px solid #d6c8a8', borderRadius: '0.4rem',
            fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </Section>

      <Section title="오늘 한 줄 코멘트" right="농부 입력" C={C}>
        <textarea
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="오늘 농장 전체를 한 줄로 종합..."
          style={{
            width: '100%', minHeight: '55px', padding: '0.6rem',
            border: '1px solid #d6c8a8', borderRadius: '0.4rem',
            fontFamily: 'inherit', fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </Section>

      <Section title="오늘 사진" right="선택" C={C}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading || envImageUrls.length >= ENV_MAX_PHOTOS}
            style={uploadBtn(envImageUrls.length >= ENV_MAX_PHOTOS, '#0284c7')}
          >촬영</button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={(e) => { handleEnvUpload(e.target.files?.[0]); e.target.value = ''; }} />
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading || envImageUrls.length >= ENV_MAX_PHOTOS}
            style={uploadBtnOutline(envImageUrls.length >= ENV_MAX_PHOTOS, '#0284c7')}
          >갤러리</button>
          <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { handleEnvUpload(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {envImageUrls.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', marginTop: '0.5rem' }}>
            {envImageUrls.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', width: 56, height: 56 }}>
                <img src={envThumbnails[idx] || url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 5, border: '1px solid #bfdbfe' }} />
                <button onClick={() => handleEnvDelete(idx)} style={deletePhotoBtn}>×</button>
              </div>
            ))}
          </div>
        )}
        {uploading && <div style={{ fontSize: '0.78rem', color: C.muted, marginTop: '0.3rem' }}>업로드 중...</div>}
      </Section>

      {/* 보고서 완료 버튼 */}
      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={handleComplete}
          disabled={saving}
          style={{
            width: '100%',
            padding: '1.1rem',
            background: savedFlash ? '#15803d' : '#16a34a',
            color: '#fff',
            border: 'none', borderRadius: '0.6rem',
            fontSize: '1.08rem', fontWeight: 800,
            cursor: saving ? 'wait' : 'pointer',
            transition: 'background 0.2s',
            fontFamily: C.headlineFont,
            boxShadow: '0 3px 12px rgba(22,163,74,0.30)',
          }}
        >
          {savedFlash ? '✓ 저장됐어요!' : (saving ? '저장 중…' : '💾 오늘 보고서 저장하기')}
        </button>
        <p style={{ fontSize: '0.76rem', color: '#b45309', textAlign: 'center', marginTop: '0.5rem', fontWeight: 700 }}>
          ⚠️ 이 버튼을 꼭 눌러야 영농일지에 저장돼요 (안 누르면 기록 안 됨)
        </p>
        <p style={{ fontSize: '0.7rem', color: C.muted, textAlign: 'center', marginTop: '0.2rem' }}>
          저장하면 아래 '보고' 불이 꺼져요 · 언제든 다시 수정 가능
        </p>

        {selectedDate === today && (
          <div style={{ marginTop: '1.1rem', paddingTop: '1.1rem', borderTop: '1px dashed #e0e0e0' }}>
            <button
              onClick={handleClockOut}
              disabled={clockingOut || clockedOut}
              style={{
                width: '100%', padding: '0.95rem',
                background: clockedOut ? '#e8efe9' : '#1c3d2e',
                color: clockedOut ? '#6b7280' : '#f0dcae',
                border: 'none', borderRadius: '0.6rem',
                fontWeight: 800, cursor: (clockingOut || clockedOut) ? 'default' : 'pointer',
                fontFamily: C.headlineFont,
              }}
            >
              {clockedOut ? '✓ 오늘 퇴근 기록됨 · 수고하셨어요' : (clockingOut ? '기록 중…' : '🌙 오늘 하루 마무리 · 최종 퇴근')}
            </button>
            <p style={{ fontSize: '0.7rem', color: C.muted, textAlign: 'center', marginTop: '0.45rem' }}>
              하루를 마치며 누르면, 손님 앱에 '퇴근'으로 기록돼요
            </p>
          </div>
        )}
      </div>
      </div>

      {/* ═══ ④ 영농일지 — 지난 기록 다시 보기 ═══ */}
      <ZoneHeader num="4" title="영농일지" subtitle="브리핑·활동·기록이 날짜별 한 장으로" C={C} />
      <Section title="지난 기록" right={`총 ${history.length}건`} C={C}>
        {history.length === 0 ? (
          <p style={{ color: C.muted, fontSize: '0.85rem' }}>아직 작성된 일지가 없어요.</p>
        ) : (
          <>
            {(showAllHistory ? history : history.slice(0, 3)).map(entry => (
              <JournalCard
                key={entry.id}
                entry={entry}
                treeData={treeData}
                today={today}
                selectedDate={selectedDate}
                missions={missionMap[entry.date] || []}
                finalMarks={finalMap[entry.date] || null}
                onSelect={() => setSelectedDate(entry.date)}
                onDelete={(e) => handleDeleteReport(entry, e)}
                C={C}
              />
            ))}
            {history.length > 3 && (
              <button
                onClick={() => setShowAllHistory(v => !v)}
                style={{
                  width: '100%', marginTop: '0.5rem', padding: '0.6rem',
                  background: '#fffefb', border: `1px solid ${C.accentBorder}`,
                  borderRadius: '0.5rem', color: '#6b7280', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                {showAllHistory ? '접기 ▴' : `더보기 (${history.length - 3}건 더) ▾`}
              </button>
            )}
          </>
        )}
      </Section>

      {/* 오늘의 하늘 상세 팝업 */}
      <MoonZodiacPopup
        open={moonPopupOpen}
        onClose={() => setMoonPopupOpen(false)}
        moon={getMoonPhase(selectedDate)}
        termInfo={getSeasonalTermInfo(selectedDate)}
        zodiac={getMoonZodiac(selectedDate)}
        dateLabel={formatDateLine(selectedDate)}
      />
    </div>
  );
}

// 🍇 영농일지 카드 — 달이름 + 절기뜻 + 생육시기 + 종합점수 배지
function JournalCard({ entry, treeData, today, selectedDate, missions = [], finalMarks = null, onSelect, onDelete, C }) {
  const isSelected = entry.date === selectedDate;
  const isToday = entry.date === today;
  const missionMonth = parseInt(entry.date.split('-')[1], 10);   // '6월 미션' 틀 라벨용
  // 영농일지엔 "그 달에 속한 미션"만 보여준다. (5월 미션을 6/11에 클리어해도 6월 일지엔 안 뜸)
  //   → 도장/달성률(manual_completions)은 그대로 두고, 표시에서만 다른 달 미션을 가린다.
  const monthMissions = missions.filter((m) => m.month == null || Number(m.month) === missionMonth);

  // 그 날짜의 trees 기록 → 평균점수 / 그루수
  const recs = [];
  for (const treeId of Object.keys(treeData)) {
    for (const r of (treeData[treeId] || [])) {
      if (r.date === entry.date) recs.push({ id: treeId, ...r });
    }
  }
  const dayScore = avgScore(recs);
  const hasScore = dayScore != null && !isNaN(dayScore);
  const band = hasScore ? scoreBand(dayScore) : null;

  const env = entry.journal_notes?.env || {};
  const growthNote = entry.journal_notes?.growth?.note || '';
  const pestNote = entry.journal_notes?.pest?.note || '';
  const hasIrr = !!(entry.irrigation && (entry.irrigation.blocks?.length > 0 || entry.irrigation.duration_minutes));
  const hasPest = !!(entry.pest_treatment && entry.pest_treatment.chemical);

  // 달 + 별자리·생명역동 일자 + 절기(뜻) + 생육시기
  const moon = getMoonPhase(entry.date);
  const zodiac = getMoonZodiac(entry.date);
  const termInfo = getSeasonalTermInfo(entry.date);
  const season = getDominantSeason(recs);
  const humidity = entry.weather?.humidityMean ?? entry.weather?.currentHumidity ?? null;

  return (
    <div style={{
      position: 'relative',
      background: isSelected ? '#fffefb' : '#fff',
      border: isSelected ? `2px solid ${C.border}` : '1px solid #e7d9b8',
      borderRadius: '0.55rem',
      marginBottom: '0.5rem',
      transition: 'all 0.15s',
    }}>
      <button
        onClick={onDelete}
        aria-label="이 일지 삭제"
        title="삭제 (비번 필요)"
        style={{
          position: 'absolute', top: 6, right: 6,
          width: 22, height: 22, borderRadius: '50%',
          border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af',
          cursor: 'pointer', fontSize: '0.72rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, padding: 0, zIndex: 1,
        }}
      >×</button>
      <button
        onClick={onSelect}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '0.75rem 2rem 0.75rem 0.85rem',
          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {/* 날짜 + 종합점수 배지 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: C.headlineFont, fontWeight: 700, fontSize: '0.95rem', color: C.text }}>
            {formatDateLine(entry.date)}
          </span>
          {moon && <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{moon.emoji}</span>}
          {moon && <span style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 600 }}>{moon.name}</span>}
          {zodiac && (
            <span
              title={`${zodiac.name}자리 · ${zodiac.dayLabel} — ${zodiac.dayShort}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.7rem', color: '#4b5563', fontWeight: 600,
              }}
            >
              <Constellation signName={zodiac.name} size={16} lineOpacity={0.35} />
              <DayTypeIcon type={zodiac.dayType} size={13} />
            </span>
          )}
          {isToday && (
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, color: '#92400e',
              background: '#fde68a', padding: '1px 6px', borderRadius: '3px',
            }}>오늘</span>
          )}
          {band && (
            <span style={{
              fontSize: '0.72rem', padding: '1px 8px', marginLeft: 'auto',
              background: band.color + '18', color: band.color,
              border: `1px solid ${band.color}50`, borderRadius: '999px', fontWeight: 700,
            }}>{dayScore.toFixed(1)} · {band.label}</span>
          )}
        </div>

        {/* 절기(뜻) + 생육시기 + 날씨 */}
        <div style={{ fontFamily: C.headlineFont, fontSize: '0.76rem', color: C.muted, marginBottom: '0.35rem', lineHeight: 1.45 }}>
          {termInfo && (
            <><b style={{ color: '#4b5563', fontWeight: 600 }}>{termInfo.name}</b> {termInfo.meaning}</>
          )}
          {season && <> · {season}</>}
        </div>
        <div style={{ fontFamily: C.headlineFont, fontSize: '0.74rem', color: C.muted, marginBottom: '0.35rem', lineHeight: 1.4 }}>
          {entry.weather?.code != null && entry.weather.tempMax != null && (
            <>{WEATHER_LABEL[entry.weather.code] || ''} {entry.weather.tempMax}°/{entry.weather.tempMin}°</>
          )}
          {humidity != null && <> · 습도 {humidity}%</>}
          {entry.author && <span style={{ marginLeft: 6 }}>· {entry.author}</span>}
        </div>

        {/* 농부 기록 — 한 줄 코멘트 + 범주별 환경·생육·병해충 (AI 진단처럼 박스 카드) */}
        {(entry.content || env.note || growthNote || pestNote) && (
          <div style={{ marginBottom: '0.3rem', background: '#fbf8f3', border: '1px solid #ead9c2', borderRadius: '0.4rem', padding: '0.4rem 0.55rem', lineHeight: 1.45 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6b4f1d', marginBottom: 2 }}>🧑‍🌾 농부 기록</div>
            {entry.content && (
              <div style={{ fontSize: '0.82rem', color: C.text, marginBottom: 3, fontStyle: 'italic' }}>"{entry.content}"</div>
            )}
            {env.note && (
              <div style={{ fontSize: '0.78rem', color: '#0c4a6e' }}>
                <span style={{ fontWeight: 700, marginRight: 4 }}>환경:</span>{env.note}
              </div>
            )}
            {growthNote && (
              <div style={{ fontSize: '0.78rem', color: '#27500a' }}>
                <span style={{ fontWeight: 700, marginRight: 4 }}>생육:</span>{growthNote}
              </div>
            )}
            {pestNote && (
              <div style={{ fontSize: '0.78rem', color: '#991b1b' }}>
                <span style={{ fontWeight: 700, marginRight: 4 }}>병해충:</span>{pestNote}
              </div>
            )}
          </div>
        )}

        {/* ✨ AI 진단 — 환경·생육·병해충 "기록"만(요청성 alert는 아침 브리핑에만). 날짜별로 쌓임 */}
        {(() => {
          const snap = entry?.journal_notes?.briefing?.snapshot;
          const aiD = snap?.ai;
          if (!aiD || (!aiD.env && !aiD.growth && !aiD.pest)) {
            // 브리핑은 했는데(snapshot 있음) AI만 비었으면 = 그날 AI 호출 실패. 빈칸 헷갈림 방지로 표시.
            if (snap) return <div style={{ fontSize: '0.74rem', color: '#9ca3af', marginBottom: '0.3rem' }}>✨ AI 진단 — 그날은 AI를 못 받았어요</div>;
            return null;
          }
          return (
            <div style={{ fontSize: '0.78rem', color: '#374151', marginBottom: '0.3rem', lineHeight: 1.5, background: '#f6f8f4', border: '1px solid #e3ebdc', borderRadius: '0.4rem', padding: '0.4rem 0.55rem' }}>
              <div style={{ fontWeight: 700, color: '#2f6b3c', marginBottom: 2 }}>✨ AI 진단 <span style={{ fontWeight: 400, color: '#9ca3af' }}>기록</span></div>
              {aiD.env ? <div><span style={{ fontWeight: 700, color: '#0c447c' }}>환경</span> {aiD.env}</div> : null}
              {aiD.growth ? <div><span style={{ fontWeight: 700, color: '#27500a' }}>생육</span> {aiD.growth}</div> : null}
              {aiD.pest ? <div><span style={{ fontWeight: 700, color: '#a32d2d' }}>병해충</span> {aiD.pest}</div> : null}
            </div>
          );
        })()}

        {/* 그날 한 일(AI 체크에서) + 아침 시작 시각 — 브리핑 기록 통합 */}
        {(() => {
          const snap = entry?.journal_notes?.briefing?.snapshot;
          const done = snap?.doneTasks || [];
          const started = snap?.startedAt ? new Date(snap.startedAt) : null;
          if (!done.length && !started) return null;
          return (
            <>
              {started && (
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.3rem' }}>🌅 아침 시작 {started.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
              )}
              {done.length > 0 && (
                <div style={{ fontSize: '0.78rem', marginBottom: '0.3rem', lineHeight: 1.5, background: '#f4f1fb', border: '1px solid #e0d8f5', borderRadius: '0.4rem', padding: '0.4rem 0.55rem' }}>
                  <div style={{ fontWeight: 700, color: '#5b3fb0', marginBottom: 2 }}>🤖 AI 진단 긴급 업무 — 완료 <span style={{ fontWeight: 400, color: '#9ca3af' }}>{done.length}건</span></div>
                  {done.map((t, i) => (
                    <div key={i} style={{ color: '#3c2a6e' }}>✓ <b>{t.kind === 'field' ? t.cat : t.treeId}</b>{t.kind !== 'field' && t.name ? ` ${t.name}` : ''}{t.label ? ` — ${t.label}` : ''}</div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {/* 사진 썸네일 (env + 최상위 legacy 합쳐서 보여줌) */}
        <JournalPhotos env={env} entry={entry} />

        {/* 상태 배지 */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
          {hasIrr && (
            <Badge color="#0284c7" bg="#eff6ff" border="#bfdbfe">
              관수 · {irrigationGroupsText(entry.irrigation)}
              {entry.irrigation.note && ` · ${entry.irrigation.note}`}
            </Badge>
          )}
          {hasPest && (
            <Badge color="#92400e" bg="#fffbeb" border="#fde68a">
              방제 · {entry.pest_treatment.chemical}
              {entry.pest_treatment.dilution && ` · ${entry.pest_treatment.dilution}`}
              {entry.pest_treatment.method && ` · ${entry.pest_treatment.method}`}
            </Badge>
          )}
          {recs.length > 0 && (
            <Badge color="#374151" bg="#f3f4f6" border="#d1d5db">
              {recs.length}그루 기록
            </Badge>
          )}
        </div>

        {/* 이달의 포도 미션 — 그날 '했어요' 완료 중 '그 달 미션'만 'N월 미션' 틀로 묶어 보여줌 */}
        {monthMissions.length > 0 && (
          <div style={{
            marginTop: '0.5rem',
            border: `1px solid ${C.accentBorder}`,
            borderRadius: '0.5rem',
            background: '#fcfbf7',
            padding: '0.45rem 0.55rem 0.55rem',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5a5446', marginBottom: '0.4rem' }}>
              {missionMonth}월 미션
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
              {monthMissions.map((m, i) => (
                <Badge key={i} color={m.color} bg={m.tint} border={m.color + '55'}>
                  {m.title}{m.count > 1 ? ` ×${m.count}` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 최종완료(송이크기정리/알솎이) — 그날 마커가 박힌 나무를 칩으로 (trees에서 계산) */}
        {finalMarks && (finalMarks.cluster.length > 0 || finalMarks.thinning.length > 0) && (
          <div style={{
            marginTop: '0.5rem',
            border: `1px solid ${C.accentBorder}`,
            borderRadius: '0.5rem',
            background: '#fcfbf7',
            padding: '0.45rem 0.55rem 0.55rem',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#5a5446', marginBottom: '0.4rem' }}>
              최종완료
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
              {finalMarks.cluster.length > 0 && (
                <Badge color="#854f0b" bg="#fef9c3" border="#eab30855">
                  송이크기정리 ×{finalMarks.cluster.length}
                </Badge>
              )}
              {finalMarks.thinning.length > 0 && (
                <Badge color="#1e40af" bg="#dbeafe" border="#2563eb55">
                  알솎이 ×{finalMarks.thinning.length}
                </Badge>
              )}
            </div>
          </div>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 작은 헬퍼 컴포넌트들
// ─────────────────────────────────────────────

function formatDateLine(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const date = new Date(`${iso}T00:00:00+09:00`);
  const dow = ['일','월','화','수','목','금','토'][date.getDay()];
  return `${parseInt(m)}/${parseInt(d)} (${dow})`;
}

// 영농일지 카드 안 사진 썸네일 줄 — env(새 구조)와 entry top-level(legacy) 사진 모두 표시
function JournalPhotos({ env = {}, entry = {} }) {
  // 썸네일이 있으면 썸네일, 없으면 원본으로 fallback
  const envPics = ((env.thumbnails && env.thumbnails.length) ? env.thumbnails : env.image_urls) || [];
  const topPics = ((entry.thumbnails && entry.thumbnails.length) ? entry.thumbnails : entry.image_urls) || [];
  const all = [...envPics, ...topPics].filter(Boolean);
  if (all.length === 0) return null;
  const MAX_SHOW = 4;
  const show = all.slice(0, MAX_SHOW);
  const extra = all.length - MAX_SHOW;
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: '0.1rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
      {show.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            width: 48, height: 48, objectFit: 'cover',
            borderRadius: 5, border: '1px solid #e7d9b8',
            background: '#f3f4f6',
          }}
        />
      ))}
      {extra > 0 && (
        <div style={{
          width: 48, height: 48, borderRadius: 5,
          background: '#f3f4f6', color: '#6b7280',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.78rem', fontWeight: 700, border: '1px solid #e5e7eb',
        }}>+{extra}</div>
      )}
    </div>
  );
}

function Badge({ children, color, bg, border }) {
  return (
    <span style={{
      padding: '2px 7px',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: '0.3rem', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Section({ title, right, C, children }) {
  return (
    <section style={{ marginBottom: '1.8rem' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline',
        borderBottom: `1.5px solid ${C.border}`,
        paddingBottom: '0.3rem', marginBottom: '0.7rem',
      }}>
        <h2 style={{
          fontFamily: C.headlineFont,
          fontSize: '1.1rem', fontWeight: 700, margin: 0, flex: 1, color: C.text,
        }}>{title}</h2>
        {right && (
          <span style={{ fontSize: '0.7rem', color: C.muted, letterSpacing: '0.4px' }}>
            {right}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// ①②③ 구역 헤더 — 큰 번호 + 제목 + 부제 (농부 뇌구조 구분용)
//   highlight=true → 매일 꼭 작성하는 보고처럼 강조(크림 카드 + 배지)
function ZoneHeader({ num, title, subtitle, C, highlight, badge }) {
  const base = {
    display: 'flex', alignItems: 'center', gap: '0.7rem',
    margin: '2.2rem 0 1rem',
    paddingBottom: '0.5rem',
    borderBottom: `2.5px solid ${C.border}`,
  };
  const hi = highlight ? {
    padding: '0.85rem 1rem',
    background: '#fdf3df',
    border: `2px solid ${C.border}`,
    borderBottom: `2px solid ${C.border}`,
    borderRadius: '0.7rem',
    boxShadow: '0 2px 8px rgba(146,64,14,0.10)',
  } : {};
  return (
    <div style={{ ...base, ...hi }}>
      <span style={{
        flexShrink: 0,
        width: 34, height: 34, borderRadius: '0.55rem',
        background: C.border, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: C.headlineFont, fontSize: '1.25rem', fontWeight: 700,
      }}>{num}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: C.headlineFont, fontSize: highlight ? '1.4rem' : '1.25rem', fontWeight: 700, color: C.text, lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {title}
          {badge && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', background: '#fde68a', padding: '2px 9px', borderRadius: '999px' }}>{badge}</span>
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.74rem', color: C.muted, marginTop: '1px' }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// 오늘 vs 과거 평균 바 (가로)
function MetricBar({ label, idealLabel, today, past, idealValue, reverse }) {
  const max = 5;
  // NaN/Infinity 방어
  const safe = (v) => (v != null && Number.isFinite(v)) ? v : null;
  const todayN = safe(today);
  const pastN  = safe(past);
  const todayPct = todayN != null ? (todayN / max) * 100 : 0;
  const pastPct  = pastN  != null ? (pastN  / max) * 100 : 0;
  const idealPct = idealValue != null ? (idealValue / max) * 100 : null;

  // 톤앤매너 — 크림 테마에 어울리는 따뜻한 색
  const colors = {
    todayBar: 'linear-gradient(90deg, #15803d 0%, #047857 100%)',  // 진한 에메랄드 (헤더와 톤 매치)
    pastBar:  '#b8a169',                                            // 따뜻한 머스타드 골드
    barBg:    '#ede4ce',                                            // 부드러운 베이지 크림
    pastBg:   '#f5efe0',                                            // 더 옅은 크림
    ideal:    '#d97706',                                            // 따뜻한 오렌지 — 이상점 마커
    text:     '#5f4a1f',                                            // 진한 카키
    muted:    '#a89968',                                            // 톤다운 모카
  };

  // 오늘값 표시 — NaN/null이면 "기록없음"
  const todayLabel = todayN != null ? todayN.toFixed(1) : '기록없음';
  const pastLabel  = pastN  != null ? pastN.toFixed(1)  : '기록없음';

  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: colors.text }}>
          {label} <span style={{ color: colors.muted, fontSize: '0.75rem', fontWeight: 500 }}>({idealLabel})</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: colors.text, fontWeight: 600 }}>
          <span style={{ color: colors.muted, fontWeight: 400 }}>오늘 </span>
          {todayLabel}
        </div>
      </div>

      {/* 오늘 바 (큰) */}
      <div style={{
        position: 'relative',
        height: '12px',
        background: colors.barBg,
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '0.3rem',
        boxShadow: 'inset 0 1px 2px rgba(120, 90, 30, 0.08)',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, todayPct)}%`,
          background: colors.todayBar,
          borderRadius: '6px',
          transition: 'width 0.4s ease',
        }} />
        {/* 이상점 표시 — 작은 마커 */}
        {idealPct != null && (
          <div
            title={`이상점 ${idealValue}`}
            style={{
              position: 'absolute',
              top: '-2px',
              left: `calc(${idealPct}% - 1px)`,
              width: '2px',
              height: '16px',
              background: colors.ideal,
              borderRadius: '1px',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.7)',
            }}
          />
        )}
      </div>

      {/* 5일 평균 바 (작은) */}
      <div style={{
        position: 'relative',
        height: '5px',
        background: colors.pastBg,
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, pastPct)}%`,
          background: colors.pastBar,
          borderRadius: '3px',
          transition: 'width 0.4s ease',
        }} />
      </div>
      <div style={{
        fontSize: '0.7rem',
        color: colors.muted,
        marginTop: '3px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px', height: '4px',
          background: colors.pastBar,
          borderRadius: '2px',
        }} />
        5일 평균 <b style={{ color: colors.text, fontWeight: 600 }}>{pastLabel}</b>
      </div>
    </div>
  );
}

// 오늘의 하늘 카드 — 라벨 스타일 (바이오다이내믹 들어가게 5.4rem)
const skyLabel = {
  display: 'inline-block', width: '5.4rem', flexShrink: 0,
  fontSize: '0.75rem', color: '#92845c', fontWeight: 700,
  whiteSpace: 'nowrap',
};

const editBtnStyle = {
  marginLeft: '0.4rem',
  fontSize: '0.7rem', padding: '1px 8px',
  border: '1px solid #d6c8a8', borderRadius: '0.3rem',
  background: '#fff', color: '#6b7280', cursor: 'pointer',
};

const todayBriefingBtn = {
  width: '100%', margin: '0 0 0.7rem', padding: '0.8rem 0.9rem',
  background: '#7c3aed',
  color: '#fff', border: 'none', borderRadius: '0.6rem',
  fontWeight: 800, fontSize: '1rem', cursor: 'pointer',
  fontFamily: 'Arvo, "Pretendard Variable", serif',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left',
};

function uploadBtn(disabled, color) {
  return {
    flex: 1, padding: '0.45rem 0.6rem',
    background: disabled ? '#d1d5db' : color, color: '#fff',
    border: 'none', borderRadius: '0.4rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.85rem', fontWeight: 600,
  };
}
function uploadBtnOutline(disabled, color) {
  return {
    flex: 1, padding: '0.45rem 0.6rem',
    background: '#fff', color: disabled ? '#9ca3af' : color,
    border: `1.5px solid ${disabled ? '#d1d5db' : color}`,
    borderRadius: '0.4rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.85rem', fontWeight: 600,
  };
}
const deletePhotoBtn = {
  position: 'absolute', top: -5, right: -5,
  width: 19, height: 19, borderRadius: '50%',
  border: 'none', background: '#ef4444', color: '#fff',
  fontSize: '0.7rem', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1, padding: 0,
};
