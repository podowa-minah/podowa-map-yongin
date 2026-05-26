// @ts-nocheck
// src/TreeModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useLabels } from './LabelContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine, ComposedChart, Area } from 'recharts';
import grasslink from './assets/icons/grass.svg';
import SaveCelebration from './components/SaveCelebration';
import farmerAnnounceSVG from './assets/icons/farmer_announce.svg';


// ---------- PINCH ZOOM WRAPPER FOR TABLE ---------- //
function PinchZoomWrapper({ children }) {
  const containerRef = React.useRef(null);
  const scaleRef = React.useRef(1);
  const lastDistRef = React.useRef(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const inner = el.firstElementChild;
    if (!inner) return;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        lastDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length !== 2) return;
      const dist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      );
      if (lastDistRef.current === null) { lastDistRef.current = dist; return; }
      const ratio = dist / lastDistRef.current;
      lastDistRef.current = dist;
      scaleRef.current = Math.max(1, Math.min(3, scaleRef.current * ratio));
      inner.style.transform = `scale(${scaleRef.current})`;
      inner.style.transformOrigin = 'top left';
      e.preventDefault();
    };

    const onTouchEnd = () => { lastDistRef.current = null; };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '0.2rem' }}>
      <div style={{ minWidth: 'fit-content' }}>
        {children}
      </div>
    </div>
  );
}

// ---------- THUMB IMAGE WITH BLUR LOADING ---------- //
function ThumbImg({ src, fullSrc, onPreview }) {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onPreview(fullSrc); }}
      style={{
        width: '40px', height: '40px', borderRadius: '4px', cursor: 'zoom-in',
        overflow: 'hidden', position: 'relative',
        backgroundColor: '#e0e0e0',
      }}
    >
      <img
        src={src}
        alt="기록 이미지"
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{
          width: '40px', height: '40px', objectFit: 'cover',
          filter: loaded ? 'none' : 'blur(4px)',
          opacity: loaded ? 1 : 0.6,
          transition: 'filter 0.3s, opacity 0.3s',
        }}
      />
    </div>
  );
}

// ---------- HELPER FUNCTIONS ---------- //
function parseTreeId(treeId) {
  if (treeId.startsWith('Tree-')) {
    return treeId.replace('Tree-', '');
  }
  const numericPart = treeId.split(' ')[0];
  return numericPart;
}

function formatDateForDisplay(isoDate) {
  if (!isoDate) return "";
  const parts = isoDate.split('-');
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function parseDateForSupabase(mmddyyyy) {
  if (!mmddyyyy) return null;
  const parts = mmddyyyy.split('/');
  if(parts.length !== 3) return null;
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

function getTodayMMDDYYYY() {
  // KST (UTC+9) 기준 오늘 날짜
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const isoDate = kst.toISOString().slice(0, 10);
  return formatDateForDisplay(isoDate);
}

// ---------- CONFIGURATION OPTIONS ---------- //
const POWER_OPTIONS = ['판단불가/지켜봐야함', '1', '2', '3', '4', '5'];
const BALANCE_OPTIONS = ['판단불가/지켜봐야함', '1', '2', '3', '4', '5'];
const BUG_OPTIONS = [0, 1, 2, 3, 4, 5];

// 보이는 라벨만 따로 (DB 값은 그대로 두고 표시만 짧게)
const OPTION_LABELS = {
  '판단불가/지켜봐야함': '판단불가 / 보류',
};
const labelOf = (v) => OPTION_LABELS[v] ?? v;

const SEASON_CHECKBOX_COUNTS = { 1: 5, 2: 4, 3: 6, 4: 6, 5: 3, 6: 3 };

const SEASON_OPTION_LABELS = {
  1: ['지켜봄', '맹아정리 (약한 것들)', '맹아정리 (센 것들)', '가지배치', '해충잡기'],
  2: ['약한가지 세력조절 - 어깨송이, 3번과제거, 꽃송이제거', '강한가지 세력조절 - 적심 및 제거', '해충잡기', '개화직전 세력조절 - 꽃송이 본격적 제거, (강한가지) 적심'],
  3: ['4-5엽기~개화기: 꽃송이로 세력조절', '개화 3-7일전: 송이손질', '개화직전: 최종송이결정 - 잎수(세력)에 따른', '가지뉘임', '개화시작**', '만개**'],
  4: ['송이털기', '송이크기정리', '알솎이', '세력조절 (강한가지)', '세력조절 (약한가지/송이떨구기)', '가지정리'],
  5: ['세력조절 (강한가지)', '세력조절 (약한가지/송이떨구기)', '알솎이'],
  6: ['세력조절 (강한가지)', '세력조절 (약한가지/송이떨구기)', '알솎이'],
};

const SEASON7_QUALITIES = ['착색', '당도', '등숙', '잎상태', '열매품질'];
const SEASON7_SCORES = [1, 2, 3, 4, 5];

const SEASONS = [1, 2, 3, 4, 5, 6, 7];

const SEASON_INSTRUCTIONS = {
  1: `조금이라도 적용되었거나, 시도했던 기술에는 체크해주세요.\n영농일지 리포트로 기록에 남습니다.`,
  2: `평균수준의 세력을 관찰하고, 가장 약한 가지들이 세력을 따라갈 수 있게\n포도송이의 짐을 덜어줍니다. (매일 매일 조금씩 관찰)\n강하게 먼저 4‑5엽기가 오거나 도장하는 가지들은 적심, 또는 제거합니다.\n균형있게 자랄 수 있게 하는 것이 4‑5엽기의 핵심입니다.\n균형있게 자라야 꽃이 안정적으로 피고, 수정이 잘 이루어집니다.`,
  3: `개화기 (14일)`,
  4: `착과기,비대기 (14일)`,
  5: `경핵기 (25일) 끝순이 죽지 않아야한다. 세력통제를 확실하게해야한다.`,
  6: `성숙기 (40일) `,
};

const SEASON_NAMES = {
  1: '맹아기',
  2: '4-5엽기',
  3: '개화기',
  4: '착과기',
  5: '경핵기',
  6: '성숙기',
  7: '수확기',
};

// row.season_data에서 체크된 항목 라벨만 뽑아 콤마로 이어붙임
function getCheckedOptionLabels(row) {
  if (!row?.season) return '';
  const labels = SEASON_OPTION_LABELS[row.season] || [];
  const state = row.season_data?.[row.season] || {};
  return labels
    .filter((_, i) => state[`option${i + 1}`])
    .join(', ');
}

// ---------- MAIN COMPONENT ---------- //
const TreeModal = ({ treeId, initialData, onClose, onOpenGrass, user }) => {
  const todayMMDDYYYY = getTodayMMDDYYYY();
  const actualTreeId = parseTreeId(treeId);
  const { labels } = useLabels();
  const lbl = labels[treeId] || {};
  const displayName = lbl.name ? `${actualTreeId} ${lbl.name}` : actualTreeId;

  const [treeData, setTreeData] = useState(() => ({
    date: todayMMDDYYYY,
    season: '',
    power: '',
    balance: '',
    bugs: '',
    partial_treatment: false,
    images: [],
    thumbnails: [],
    comments: '',
    season_data: {},
  }));

  const [history, setHistory] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const toggleShowTable = () => setShowTable(!showTable);
  const [sortCol, setSortCol] = useState('date');
  const [sortAsc, setSortAsc] = useState(false); // 디폴트: 최신 먼저 (내림차순)

  // 새로 시작 (백지화) 관련
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

  async function handleArchive() {
    if (archivePassword !== '6687') {
      setArchiveError('비밀번호가 틀렸습니다');
      return;
    }
    setArchiveLoading(true);
    setArchiveError('');
    // 이 나무의 모든 활성 trees row를 archived_at=NOW()로 UPDATE
    // ⚠️ DELETE 안 함. 기록은 Supabase에 그대로 남음.
    const { error } = await supabase
      .from('trees')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', actualTreeId)
      .is('archived_at', null);
    setArchiveLoading(false);
    if (error) {
      setArchiveError('실행 실패: ' + error.message);
      return;
    }
    // 성공 → 모달 닫고 상위 모달도 닫기
    setShowArchiveModal(false);
    setArchivePassword('');
    onClose();
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  }

  function getSortedHistory() {
    return [...history].sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];
      // 숫자 비교 가능한 컬럼
      if (['power', 'balance', 'bugs', 'season'].includes(sortCol)) {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }
      // boolean (partial_treatment)
      if (sortCol === 'partial_treatment') {
        valA = valA ? 1 : 0;
        valB = valB ? 1 : 0;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  // ✅ 핵심 수정: 선택된 날짜의 기존 데이터 불러오기
  async function loadDataForDate(dateMMDDYYYY) {
    const isoDate = parseDateForSupabase(dateMMDDYYYY);
    if (!isoDate) return;

    const { data, error } = await supabase
      .from('trees')
      .select('*')
      .eq('id', actualTreeId)
      .eq('date', isoDate)
      .is('archived_at', null)  // 보관된 나무 기록 제외
      .maybeSingle();

    if (error) {
      console.error('Error loading date data:', error);
      return;
    }

    if (data) {
      // 해당 날짜 데이터가 있으면 폼에 채움
      setTreeData({
        date: dateMMDDYYYY,
        season: data.season ? String(data.season) : '',
        power: data.power || '',
        balance: data.balance || '',
        bugs: data.bugs !== null && data.bugs !== undefined ? String(data.bugs) : '',
        partial_treatment: data.partial_treatment || false,
        images: data.images || [],
        thumbnails: data.thumbnails || [],
        comments: data.comments || '',
        season_data: data.season_data || {},
      });
    } else {
      // 해당 날짜 데이터 없으면 날짜만 유지하고 나머지 초기화
      setTreeData({
        date: dateMMDDYYYY,
        season: '',
        power: '',
        balance: '',
        bugs: '',
        partial_treatment: false,
        images: [],
        thumbnails: [],
        comments: '',
        season_data: {},
      });
    }
  }

  // 모달 열릴 때 오늘 날짜 데이터 자동 로드
  useEffect(() => {
    loadDataForDate(todayMMDDYYYY);
  }, [actualTreeId]);

  // 히스토리 불러오기
  useEffect(() => {
    async function fetchHistory() {
      const { data, error } = await supabase
        .from('trees')
        .select('*')
        .eq('id', actualTreeId)
        .is('archived_at', null)  // 보관된 나무 기록 제외
        .order('date');

      if (!error && data) {
        const formattedData = data.map(d => ({
          date: d.date,
          season: d.season,
          season_data: d.season_data || {},
          power: d.power,
          balance: d.balance,
          bugs: d.bugs,
          comments: d.comments || '',
          producer: d.producer || '',
          images: d.images || [],
          thumbnails: d.thumbnails || [],
          partial_treatment: d.partial_treatment || false,
          powerJ: d.power != null && d.power !== '' && d.power !== '판단불가/지켜봐야함' ? parseInt(d.power) : null,
          balanceJ: d.balance != null && d.balance !== '' && d.balance !== '판단불가/지켜봐야함' ? parseInt(d.balance) : null,
          bugsJ: d.bugs != null && d.bugs !== '' ? parseInt(d.bugs) : null,
          powerNA: d.power === '판단불가/지켜봐야함' ? 0 : null,
          balanceNA: d.balance === '판단불가/지켜봐야함' ? 0 : null,
        }));
        setHistory(formattedData);
      }
    }
    fetchHistory();
  }, [actualTreeId]);

  const cellStyle = {
    border: '1px solid #ccc',
    padding: '6px 8px',
    textAlign: 'center',
  };

  function handleChange(field, value) {
    setTreeData((prev) => ({ ...prev, [field]: value }));
  }

  // 날짜 변경 시 해당 날짜 데이터 로드
  function handleDateChange(isoDateValue) {
    const mmddyyyy = formatDateForDisplay(isoDateValue);
    loadDataForDate(mmddyyyy);
  }

  const buttonStyle = (active) => ({
    padding: '1rem 1.5rem',
    margin: '0.3rem',
    fontSize: '1.2rem',
    border: active ? '3px solid #16a34a' : '2px solid #e2e8f0',
    borderRadius: '0.7rem',
    backgroundColor: active ? '#16a34a' : '#fff',
    color: active ? '#ffffff' : '#1f2937',
    fontWeight: active ? 700 : 400,
    boxShadow: active ? '0 4px 0 rgba(20, 83, 45, 0.5)' : 'none',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  });

  // 평가 행에서 쓰는 컴팩트 버튼 (flex로 너비 균등 분배)
  const ratingBtnStyle = (active) => ({
    flex: '1 1 0',
    minWidth: 0,
    padding: '0.85rem 0',
    fontSize: '1.2rem',
    textAlign: 'center',
    border: active ? '3px solid #16a34a' : '2px solid #e2e8f0',
    borderRadius: '0.7rem',
    backgroundColor: active ? '#16a34a' : '#fff',
    color: active ? '#ffffff' : '#1f2937',
    fontWeight: active ? 700 : 400,
    boxShadow: active ? '0 4px 0 rgba(20, 83, 45, 0.5)' : 'none',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  });

  function handleCheckboxChange(season, optionKey, checked) {
    setTreeData((prev) => ({
      ...prev,
      season_data: {
        ...prev.season_data,
        [season]: { ...(prev.season_data[season] || {}), [optionKey]: checked },
      },
    }));
  }

  function handleLikertChange(seasonKey, quality, score) {
    setTreeData((prev) => ({
      ...prev,
      season_data: {
        ...prev.season_data,
        [seasonKey]: { ...(prev.season_data[seasonKey] || {}), [quality]: score },
      },
    }));
  }

  // ---------- IMAGE HANDLERS ---------- //
  function createThumbnail(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }

  const [uploading, setUploading] = useState(false);
  const [showSaveCelebration, setShowSaveCelebration] = useState(false);

  async function handleImageUploadDirect(file) {
    if (!file || treeData.images.length >= 5) return;
    setUploading(true);
    const fileName = `${treeId}-${Date.now()}-${file.name}`;

    // 원본 업로드
    const { error } = await supabase.storage.from('tree-images').upload(fileName, file);
    if (error) {
      console.error('Error uploading image:', error.message);
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
      setTreeData((prev) => ({
        ...prev,
        images: [...prev.images, urlData.publicUrl],
        thumbnails: [...(prev.thumbnails || []), thumbUrl],
      }));
    }
    setUploading(false);
  }

  async function handleImageDelete(url) {
    const bucketName = 'tree-images';
    const filePath = url.split(`${bucketName}/`)[1];
    if (!filePath) {
      console.error('Could not parse file path from URL:', url);
      return;
    }
    // 원본 삭제
    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    if (error) {
      console.error('Error deleting image:', error.message);
      return;
    }
    // 썸네일도 삭제 시도
    supabase.storage.from(bucketName).remove([`thumb/${filePath}`]).catch(() => {});

    setTreeData((prev) => {
      const idx = prev.images.indexOf(url);
      const newThumbs = [...(prev.thumbnails || [])];
      if (idx >= 0) newThumbs.splice(idx, 1);
      return {
        ...prev,
        images: prev.images.filter((img) => img !== url),
        thumbnails: newThumbs,
      };
    });
  }

  // ---------- SAVE FUNCTION ----------
  async function saveChanges() {
    const isoDate = parseDateForSupabase(treeData.date);

    const row = {
      id: actualTreeId,
      date: isoDate,
      season: treeData.season ? Number(treeData.season) : null,
      power: treeData.power,
      balance: treeData.balance,
      bugs: treeData.bugs === '' ? null : Number(treeData.bugs),
      partial_treatment: treeData.partial_treatment,
      images: treeData.images,
      thumbnails: treeData.thumbnails || [],
      comments: treeData.comments,
      season_data: treeData.season_data,
      producer: user?.user_metadata?.nickname || user?.email || '',
    };

    // partial unique index(trees_active_id_date_unique)는 ON CONFLICT에서 인식 안 됨
    // → 수동으로 active row 있는지 확인 후 INSERT or UPDATE
    const { data: existing, error: checkError } = await supabase
      .from('trees')
      .select('row_id')
      .eq('id', actualTreeId)
      .eq('date', isoDate)
      .is('archived_at', null)
      .maybeSingle();

    if (checkError) { console.error(checkError); return; }

    let error;
    if (existing) {
      // active row가 있으면 UPDATE
      ({ error } = await supabase
        .from('trees')
        .update(row)
        .eq('row_id', existing.row_id));
    } else {
      // 없으면 INSERT (archived row 있어도 공존 가능 — partial unique index 덕분)
      ({ error } = await supabase
        .from('trees')
        .insert(row));
    }

    if (error) {
      console.error(error);
      onClose();
      return;
    }

    // 저장 성공 → 농부 축하 애니메이션 띄우고 잠시 후 모달 닫기
    setShowSaveCelebration(true);
    setTimeout(() => {
      onClose();
    }, 1400);
  }

  const currentSeason = Number(treeData.season);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
      }}
    >
      <SaveCelebration show={showSaveCelebration} />
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(180deg, #faf7f0 0%, #f3ede0 100%)',
          padding: '0 0.8rem 1rem',
          borderRadius: '1.5rem',
          maxWidth: '720px', width: '92%', maxHeight: '92vh', overflowY: 'auto', zIndex: 1000,
          boxShadow: '0 30px 80px rgba(91, 33, 182, 0.18), 0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid rgba(124, 58, 237, 0.08)',
        }}
      >
        {/* 상단 액센트 바 — 단색 포도 보라 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 11,
          height: '6px',
          backgroundColor: '#7c3aed',
          borderRadius: '1.5rem 1.5rem 0 0',
          margin: '0 -0.8rem',
        }} />

        {/* Sticky header */}
        <div
          style={{
            position: 'sticky', top: '6px', zIndex: 10, padding: '1.1rem 0.5rem 1rem',
            backdropFilter: 'blur(10px)',
            background: 'linear-gradient(180deg, rgba(250,247,240,0.96) 0%, rgba(250,247,240,0.85) 100%)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <span
            onClick={() => { setArchivePassword(''); setArchiveError(''); setShowArchiveModal(true); }}
            style={{
              fontSize: '1.4rem', fontWeight: 600, flex: 1,
              textDecoration: 'underline', textDecorationColor: '#a0aec0',
              textDecorationStyle: 'dotted', textUnderlineOffset: '4px',
              cursor: 'pointer',
            }}
            title="클릭: 이 나무 새로 시작"
          >
            {displayName}
          </span>
          {onOpenGrass && (
            <img
              src={grasslink}
              alt="풀 모달"
              onClick={() => onOpenGrass(`Grass-${actualTreeId}`)}
              style={{ width: 32, height: 32, cursor: 'pointer', opacity: 0.7 }}
            />
          )}
        </div>

        {/* Chart 카드 — 가장자리까지 확장 */}
        {history.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '1.2rem',
            padding: '0.5rem 0 0.4rem',
            marginBottom: '0.7rem',
            marginLeft: '-0.6rem',
            marginRight: '-0.6rem',
            boxShadow: '0 4px 0 rgba(0,0,0,0.06)',
            border: '2px solid #f0ebe0',
            height: 240,
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={history}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="grad-power" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#66bb6a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#66bb6a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-balance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-bugs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e57373" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e57373" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} horizontal={false} />
                {[0, 1, 2, 3, 4, 5].map((y) => (
                  <ReferenceLine key={y} y={y} stroke="#ede4d3" strokeDasharray="3 3" ifOverflow="extendDomain" />
                ))}
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => { const [, month, day] = d.split('-'); return `${month}/${day}`; }}
                  axisLine={{ stroke: '#e5e0d0' }}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tickFormatter={(v) => (v === 0 ? '0/NA' : v)}
                  axisLine={{ stroke: '#e5e0d0' }}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const colorMap = { powerJ: '#66bb6a', powerNA: '#66bb6a', balanceJ: '#7c3aed', balanceNA: '#7c3aed', bugsJ: '#e57373' };
                    const nameMap = { powerJ: '세력', powerNA: '세력', balanceJ: '균형', balanceNA: '균형', bugsJ: '해충' };
                    const order = ['powerJ', 'powerNA', 'balanceJ', 'balanceNA', 'bugsJ'];
                    const items = payload
                      .filter(p => p.value != null)
                      .sort((a, b) => order.indexOf(a.dataKey) - order.indexOf(b.dataKey));
                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, #fffaf0 0%, #fff5e6 100%)',
                        border: '2px solid #fde68a',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 12,
                        boxShadow: '0 4px 12px rgba(251, 191, 36, 0.18)',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, color: '#78350f' }}>{label}</div>
                        {items.map(p => (
                          <div key={p.dataKey} style={{ color: colorMap[p.dataKey], fontWeight: 600 }}>
                            {nameMap[p.dataKey]} : {p.dataKey.endsWith('NA') ? '판단불가' : Math.round(p.value)}
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ display: 'flex', justifyContent: 'center' }}
                  content={() => (
                    <div style={{ display: 'flex', gap: 18 }}>
                      {[
                        { color: '#66bb6a', label: '세력' },
                        { color: '#7c3aed', label: '균형' },
                        { color: '#e57373', label: '해충' },
                      ].map(({ color, label }) => (
                        <span key={label} style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                          <svg width="30" height="10" style={{ marginRight: 4 }}>
                            <line x1="0" y1="5" x2="26" y2="5" stroke={color} strokeWidth="2" />
                            <circle cx="13" cy="5" r="3" fill={color} />
                          </svg>
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                />
                {history.filter(h => h.partial_treatment).map((h) => (
                  <ReferenceLine
                    key={`pt-${h.date}`}
                    x={h.date}
                    stroke="#e91e63"
                    strokeDasharray="2 2"
                    strokeWidth={2}
                  />
                ))}
                {/* 메인 3개: Area로 변경 (선 + 그라데이션 채우기) */}
                <Area
                  type="basis" dataKey="bugsJ"
                  stroke="#e57373" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                  fill="url(#grad-bugs)"
                  activeDot={false}
                  dot={({ cx, cy, value, index }) => value != null ? <circle key={index} cx={cx - 4} cy={cy} r={5} fill="#e57373" stroke="#fff" strokeWidth={2} /> : null}
                  isAnimationActive={false} connectNulls={true}
                />
                <Area
                  type="basis" dataKey="balanceJ"
                  stroke="#7c3aed" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                  fill="url(#grad-balance)"
                  activeDot={false}
                  dot={({ cx, cy, value, index }) => value != null ? <circle key={index} cx={cx} cy={cy} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={2} /> : null}
                  isAnimationActive={false} connectNulls={true}
                />
                <Area
                  type="basis" dataKey="powerJ"
                  stroke="#66bb6a" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                  fill="url(#grad-power)"
                  activeDot={false}
                  dot={({ cx, cy, value, index }) => value != null ? <circle key={index} cx={cx + 4} cy={cy} r={5} fill="#66bb6a" stroke="#fff" strokeWidth={2} /> : null}
                  isAnimationActive={false} connectNulls={true}
                />
                {/* NA 표시 점만 (선 없음) */}
                <Line dataKey="powerNA" stroke="#66bb6a" strokeWidth={0} activeDot={false} dot={({ cx, cy, value, index }) => value != null ? <circle key={index} cx={cx + 4} cy={cy} r={5} fill="#66bb6a" stroke="#fff" strokeWidth={2} /> : null} isAnimationActive={false} legendType="none" />
                <Line dataKey="balanceNA" stroke="#7c3aed" strokeWidth={0} activeDot={false} dot={({ cx, cy, value, index }) => value != null ? <circle key={index} cx={cx} cy={cy} r={5} fill="#7c3aed" stroke="#fff" strokeWidth={2} /> : null} isAnimationActive={false} legendType="none" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 차트 직후: 최근 2회 기록 — 농부 일기장 느낌, 가로 2단 (좁으면 자동 1단) */}
        {history.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.7rem',
            marginBottom: '1rem',
          }}>
            {[...history]
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .slice(0, 2)
              .map((row, idx) => {
                const checked = getCheckedOptionLabels(row);
                const hasImages = row.images && row.images.length > 0;
                const producerInitial = row.producer ? row.producer.charAt(0) : '';
                return (
                  <div
                    key={`recent-${idx}`}
                    style={{
                      background: 'linear-gradient(135deg, #fffaf0 0%, #fff5e6 100%)',
                      border: '2px solid #fde68a',
                      borderRadius: '0.85rem',
                      padding: '0.6rem 0.75rem',
                      boxShadow: '0 2px 8px rgba(251, 191, 36, 0.12), 0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* 헤더: 날짜 칩 + 생육시기 칩 + 작업자 아바타 + 부분방제 배지 */}
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.4rem' }}>
                      {/* 날짜 칩 (햇살 노랑) */}
                      <span style={{
                        backgroundColor: '#fbbf24',
                        color: '#78350f',
                        padding: '0.18rem 0.5rem',
                        borderRadius: '0.4rem',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        boxShadow: '0 1px 0 rgba(146, 64, 14, 0.2)',
                      }}>
                        {row.date}
                      </span>
                      {/* 생육시기 칩 (잎 초록) */}
                      {row.season && (
                        <span style={{
                          backgroundColor: '#bef264',
                          color: '#365314',
                          padding: '0.18rem 0.5rem',
                          borderRadius: '0.4rem',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          boxShadow: '0 1px 0 rgba(54, 83, 20, 0.2)',
                        }}>
                          {SEASON_NAMES[row.season]}
                        </span>
                      )}
                      {/* 부분방제 배지 */}
                      {row.partial_treatment && (
                        <span style={{
                          backgroundColor: '#fecaca',
                          color: '#991b1b',
                          padding: '0.18rem 0.45rem',
                          borderRadius: '0.4rem',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                        }}>
                          부분방제
                        </span>
                      )}
                      {/* 작업자 아바타 (오른쪽 끝) */}
                      {row.producer && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          marginLeft: 'auto',
                          color: '#6b7280',
                          fontSize: '0.85rem',
                        }}>
                          <span style={{
                            width: '22px', height: '22px',
                            background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            boxShadow: '0 1px 3px rgba(168, 85, 247, 0.4)',
                          }}>
                            {producerInitial}
                          </span>
                          {row.producer}
                        </span>
                      )}
                    </div>

                    {/* 한일 — 깔끔한 흰 미니박스 */}
                    {checked && (
                      <div style={{
                        marginBottom: '0.3rem',
                        padding: '0.4rem 0.55rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '0.45rem',
                        border: '1px solid #fef3c7',
                      }}>
                        <span style={{ color: '#92400e', fontWeight: 700, marginRight: '0.35rem' }}>한일</span>
                        <span style={{ color: '#374151' }}>{checked}</span>
                      </div>
                    )}

                    {/* 코멘트 — 따뜻한 양피지, 인용 느낌 */}
                    {row.comments && (
                      <div style={{
                        marginBottom: '0.3rem',
                        padding: '0.4rem 0.55rem',
                        backgroundColor: '#fef3c7',
                        borderLeft: '4px solid #f59e0b',
                        borderRadius: '0.4rem',
                      }}>
                        <div style={{ color: '#92400e', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.1rem' }}>
                          💬 코멘트
                        </div>
                        <div style={{ color: '#451a03', fontStyle: 'italic' }}>
                          "{row.comments}"
                        </div>
                      </div>
                    )}

                    {/* 사진 — 폴라로이드 52px */}
                    {hasImages && (
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                        {row.images.map((img, imgIdx) => (
                          <div
                            key={imgIdx}
                            onClick={() => setPreviewImg(img)}
                            style={{
                              width: '52px', height: '52px',
                              borderRadius: '0.4rem',
                              overflow: 'hidden',
                              border: '2px solid #ffffff',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                              cursor: 'zoom-in',
                              backgroundColor: '#f3f4f6',
                            }}
                          >
                            <img
                              src={row.thumbnails?.[imgIdx] || img}
                              alt="기록 사진"
                              loading="lazy"
                              decoding="async"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* 오늘 작업 카드 (날짜 + 생육시기) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.2rem',
          padding: '0.9rem 1rem',
          marginBottom: '0.7rem',
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.06), 0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid rgba(124, 58, 237, 0.08)',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed',
            backgroundColor: '#f3e8ff',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem',
          }}>
            오늘 작업
          </div>

          {/* 1. Date */}
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ color: '#4b5563', fontWeight: 500 }}>날짜</label>
            <input
              type="date"
              value={parseDateForSupabase(treeData.date)}
              onChange={(e) => handleDateChange(e.target.value)}
              style={{
                marginLeft: '0.5rem', padding: '0.5rem 0.7rem', fontSize: '1rem',
                border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                backgroundColor: '#fafaf7',
              }}
            />
          </div>

          {/* 2. Season */}
          <div>
            <label style={{ color: '#4b5563', fontWeight: 500 }}>생육시기</label>
            <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
              {SEASONS.map((s) => (
                <button key={s} onClick={() => handleChange('season', treeData.season === String(s) ? '' : String(s))} style={buttonStyle(treeData.season === String(s))}>
                  {SEASON_NAMES[s] || `Season ${s}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Season-specific items */}
        {treeData.season && currentSeason >= 1 && currentSeason <= 6 && (
          <div style={{
            border: '1px solid #e8dfc9',
            backgroundColor: '#fffdf7',
            padding: '0.7rem 0.7rem 0.6rem',
            marginBottom: '1rem',
            borderRadius: '0.7rem',
          }}>
            <h3 style={{ whiteSpace: 'pre-wrap' }}>
              {SEASON_NAMES[currentSeason] || `Season ${currentSeason}`}:{' '}
              {SEASON_INSTRUCTIONS[currentSeason] || 'Choose All That Apply'}
            </h3>
            {[...Array(SEASON_CHECKBOX_COUNTS[currentSeason])].map((_, i) => {
              const optionKey = `option${i + 1}`;
              const labelText = SEASON_OPTION_LABELS[currentSeason]?.[i] ?? `Option ${i + 1}`;
              return (
                <label key={optionKey} style={{ display: 'block', fontSize: '1rem', margin: '0.3rem 0' }}>
                  <input
                    type="checkbox"
                    checked={treeData.season_data[currentSeason]?.[optionKey] || false}
                    onChange={(e) => handleCheckboxChange(currentSeason, optionKey, e.target.checked)}
                    style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.5rem', accentColor: '#16a34a' }}
                  />
                  {labelText}
                </label>
              );
            })}
          </div>
        )}

        {treeData.season && currentSeason === 7 && (
          <div style={{ border: '1px solid #ccc', padding: '0.5rem', marginBottom: '1rem' }}>
            <h3>{SEASON_NAMES[treeData.season] || `Season ${treeData.season}`}:</h3>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th></th>
                  {SEASON7_SCORES.map((score) => (
                    <th key={score} style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{score}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEASON7_QUALITIES.map((q) => {
                  const seasonObj = treeData.season_data[7] || {};
                  const currentScore = seasonObj[q] || '';
                  return (
                    <tr key={q}>
                      <td style={{ padding: '0.5rem', border: '1px solid #ccc' }}>{q}</td>
                      {SEASON7_SCORES.map((score) => (
                        <td key={score} style={{ textAlign: 'center', border: '1px solid #ccc' }}>
                          <input
                            type="radio"
                            name={`quality_${q}`}
                            checked={currentScore === score}
                            onClick={() => { if (currentScore === score) handleLikertChange(7, q, ''); }}
                            onChange={() => handleLikertChange(7, q, score)}
                            style={{ width: '1.5rem', height: '1.5rem', accentColor: '#16a34a' }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 평가 카드 (세력 + 균형 + 해충 + 부분방제 한 묶음) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.2rem',
          padding: '0.9rem 1rem',
          marginBottom: '0.7rem',
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.06), 0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid rgba(124, 58, 237, 0.08)',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '0.78rem', fontWeight: 700, color: '#16a34a',
            backgroundColor: '#dcfce7',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem',
          }}>
            평가
          </div>

          {/* 4. Power — 2줄 (판단불가 / 1~5) */}
          <div style={{ marginBottom: '0.45rem' }}>
            <label style={{ color: '#4b5563', fontWeight: 500 }}>나무의 세력</label>
            {/* 1줄: 판단불가 / 보류 */}
            <div style={{ marginLeft: '0.5rem', display: 'flex', marginTop: '0.3rem' }}>
              <button
                onClick={() => handleChange('power', treeData.power === POWER_OPTIONS[0] ? '' : POWER_OPTIONS[0])}
                style={ratingBtnStyle(treeData.power === POWER_OPTIONS[0])}
              >
                {labelOf(POWER_OPTIONS[0])}
              </button>
            </div>
            {/* 2줄: 1~5 */}
            <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'nowrap', gap: '0.3rem', marginTop: '0.3rem' }}>
              {POWER_OPTIONS.slice(1).map((p) => (
                <button key={p} onClick={() => handleChange('power', treeData.power === p ? '' : p)} style={ratingBtnStyle(treeData.power === p)}>{p}</button>
              ))}
            </div>
          </div>

          {/* 5. Balance — 2줄 (판단불가 / 1~5) */}
          <div style={{ marginBottom: '0.45rem' }}>
            <label style={{ color: '#4b5563', fontWeight: 500 }}>나무의 균형도</label>
            <div style={{ marginLeft: '0.5rem', display: 'flex', marginTop: '0.3rem' }}>
              <button
                onClick={() => handleChange('balance', treeData.balance === BALANCE_OPTIONS[0] ? '' : BALANCE_OPTIONS[0])}
                style={ratingBtnStyle(treeData.balance === BALANCE_OPTIONS[0])}
              >
                {labelOf(BALANCE_OPTIONS[0])}
              </button>
            </div>
            <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'nowrap', gap: '0.3rem', marginTop: '0.3rem' }}>
              {BALANCE_OPTIONS.slice(1).map((b) => (
                <button key={b} onClick={() => handleChange('balance', treeData.balance === b ? '' : b)} style={ratingBtnStyle(treeData.balance === b)}>{b}</button>
              ))}
            </div>
          </div>

          {/* 6. Bugs — 2줄 (0 / 1~5) */}
          <div style={{ marginBottom: '0.45rem' }}>
            <label style={{ color: '#4b5563', fontWeight: 500 }}>해충관리</label>
            <div style={{ marginLeft: '0.5rem', display: 'flex', marginTop: '0.3rem' }}>
              <button
                onClick={() => handleChange('bugs', treeData.bugs === '0' ? '' : '0')}
                style={ratingBtnStyle(treeData.bugs === '0')}
              >
                0
              </button>
            </div>
            <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'nowrap', gap: '0.3rem', marginTop: '0.3rem' }}>
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => handleChange('bugs', treeData.bugs === String(num) ? '' : String(num))}
                  style={ratingBtnStyle(treeData.bugs === String(num))}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* 6.5 부분방제 */}
          <div>
            <label style={{ color: '#4b5563', fontWeight: 500 }}>부분방제</label>
          <div style={{ marginLeft: '0.5rem', display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
            <button
              onClick={() => handleChange('partial_treatment', true)}
              style={{
                padding: '0.7rem 1.5rem',
                fontSize: '1.1rem',
                border: treeData.partial_treatment === true ? '3px solid #dc2626' : '2px solid #ccc',
                borderRadius: '0.5rem',
                backgroundColor: treeData.partial_treatment === true ? '#dc2626' : '#fff',
                color: treeData.partial_treatment === true ? '#fff' : '#333',
                fontWeight: treeData.partial_treatment === true ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              onClick={() => handleChange('partial_treatment', false)}
              style={{
                padding: '0.7rem 1.5rem',
                fontSize: '1.1rem',
                border: treeData.partial_treatment === false ? '3px solid #6b7280' : '2px solid #ccc',
                borderRadius: '0.5rem',
                backgroundColor: treeData.partial_treatment === false ? '#6b7280' : '#fff',
                color: treeData.partial_treatment === false ? '#fff' : '#374151',
                fontWeight: treeData.partial_treatment === false ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        </div>
        </div>
        {/* / 평가 카드 끝 */}

        {/* 메모 카드 (사진 + 코멘트 한 묶음) */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.2rem',
          padding: '0.9rem 1rem',
          marginBottom: '0.7rem',
          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.06), 0 1px 3px rgba(0,0,0,0.04)',
          border: '1px solid rgba(124, 58, 237, 0.08)',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '0.78rem', fontWeight: 700, color: '#d97706',
            backgroundColor: '#fef3c7',
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            letterSpacing: '0.04em',
            marginBottom: '0.6rem',
          }}>
            기록
          </div>

        {/* 7. Images */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label style={{ color: '#4b5563', fontWeight: 500 }}>사진기록 ({treeData.images.length}/5)</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            {/* 📷 카메라 직접 촬영 */}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              backgroundColor: (treeData.images.length >= 5 || uploading) ? '#ccc' : '#16a34a',
              color: 'white', padding: '1rem 1.5rem', borderRadius: '0.7rem',
              cursor: (treeData.images.length >= 5 || uploading) ? 'not-allowed' : 'pointer',
              fontSize: '1.2rem', fontWeight: 600,
              boxShadow: (treeData.images.length >= 5 || uploading) ? 'none' : '0 4px 0 rgba(20, 83, 45, 0.5)',
            }}>
              📷 촬영
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => { if (e.target.files[0]) { handleImageUploadDirect(e.target.files[0]); e.target.value = ''; } }}
                disabled={treeData.images.length >= 5 || uploading}
                style={{ display: 'none' }}
              />
            </label>

            {/* 🖼 갤러리에서 선택 */}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              backgroundColor: (treeData.images.length >= 5 || uploading) ? '#ccc' : '#f97316',
              color: 'white', padding: '1rem 1.5rem', borderRadius: '0.7rem',
              cursor: (treeData.images.length >= 5 || uploading) ? 'not-allowed' : 'pointer',
              fontSize: '1.2rem', fontWeight: 600,
              boxShadow: (treeData.images.length >= 5 || uploading) ? 'none' : '0 4px 0 rgba(154, 52, 18, 0.5)',
            }}>
              🖼 갤러리
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { if (e.target.files[0]) { handleImageUploadDirect(e.target.files[0]); e.target.value = ''; } }}
                disabled={treeData.images.length >= 5 || uploading}
                style={{ display: 'none' }}
              />
            </label>

            {uploading && (
              <span style={{ fontSize: '0.85rem', color: '#555', alignSelf: 'center' }}>업로드 중...</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {treeData.images.map((url, idx) => (
            <div key={idx} style={{ position: 'relative', margin: '0.5rem' }}>
              <img src={treeData.thumbnails?.[idx] || url} alt="Tree" style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
              <button
                onClick={() => handleImageDelete(url)}
                style={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer' }}
              >
                X
              </button>
            </div>
          ))}
        </div>
        {treeData.images.length >= 5 && <p style={{ color: 'red' }}>Max 5 images reached</p>}

        {/* 8. Comments */}
        <div>
          <label style={{ color: '#4b5563', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <img
              src={farmerAnnounceSVG}
              alt="농부"
              style={{ width: '36px', height: 'auto', verticalAlign: 'middle' }}
            />
            농부진단
          </label>
          <textarea
            value={treeData.comments}
            onChange={(e) => handleChange('comments', e.target.value)}
            style={{
              display: 'block', width: '100%', height: '60px', marginTop: '0.3rem',
              padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
              fontFamily: 'inherit', fontSize: '1rem', resize: 'vertical',
              backgroundColor: '#fafaf7',
            }}
          />
        </div>
        </div>
        {/* / 메모 카드 끝 */}

        {/* 더보기 */}
        <div style={{ marginBottom: '0.5rem' }}>
          <button
            onClick={toggleShowTable}
            style={{ padding: '1rem 1.5rem', backgroundColor: '#5c6bc0', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1.2rem' }}
          >
            {showTable ? '간단히 보기' : '더보기'}
          </button>
        </div>

        {showTable && (
          <PinchZoomWrapper>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f3f3' }}>
                  {[
                    ['date', '날짜', true],
                    ['season', '생육시기', true],
                    ['power', '세력', true],
                    ['balance', '균형', true],
                    ['bugs', '해충', true],
                    ['partial_treatment', '부분방제', true],
                    ['comments', '코멘트', true],
                    ['done_tasks', '한일', false],
                    ['images', '사진', true],
                    ['producer', '생산자', true],
                  ].map(([key, label, sortable]) => (
                    <th
                      key={key}
                      style={{ ...cellStyle, cursor: sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={sortable ? () => handleSort(key) : undefined}
                    >
                      {label}{sortable && sortCol === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getSortedHistory().map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => loadDataForDate(formatDateForDisplay(row.date))}  // ✅ 행 클릭 시 해당 날짜 데이터 폼에 로드
                    style={{ cursor: 'pointer' }}
                    title="클릭하면 해당 날짜 데이터를 불러옵니다"
                  >
                    <td style={cellStyle}>{row.date}</td>
                    <td style={cellStyle}>{SEASON_NAMES[row.season]}</td>
                    <td style={cellStyle}>{row.power}</td>
                    <td style={cellStyle}>{row.balance}</td>
                    <td style={cellStyle}>{row.bugs}</td>
                    <td style={cellStyle}>{row.partial_treatment ? '✔' : ''}</td>
                    <td
                      style={{ ...cellStyle, maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={row.comments || ''}
                    >
                      {row.comments}
                    </td>
                    <td style={{ ...cellStyle, maxWidth: '280px', wordBreak: 'keep-all' }}>
                      {getCheckedOptionLabels(row)}
                    </td>
                    <td style={cellStyle}>
                      {row.images && row.images.length > 0 ? (
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                          {row.images.map((img, imgIdx) => (
                            <ThumbImg
                              key={imgIdx}
                              src={row.thumbnails?.[imgIdx] || img}
                              fullSrc={img}
                              onPreview={(url) => { setPreviewImg(url); }}
                            />
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={cellStyle}>{row.producer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PinchZoomWrapper>
        )}

        {/* SAVE & CANCEL — LEGO 단색 */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem' }}>
          <button
            onClick={saveChanges}
            style={{
              flex: 1,
              backgroundColor: '#facc15',
              color: '#1f2937',
              padding: '1rem 1.5rem',
              border: '3px solid #ca8a04',
              borderRadius: '0.9rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              fontWeight: 700,
              boxShadow: '0 6px 0 rgba(133, 77, 14, 0.5)',
              transition: 'transform 0.08s ease, box-shadow 0.08s ease',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(3px)';
              e.currentTarget.style.boxShadow = '0 3px 0 rgba(133, 77, 14, 0.5)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 0 rgba(133, 77, 14, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 0 rgba(133, 77, 14, 0.5)';
            }}
          >
            저장하기
          </button>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#ffffff',
              color: '#6b7280',
              padding: '1rem 1.5rem',
              border: '2px solid #d1d5db',
              borderRadius: '0.9rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              fontWeight: 600,
            }}
          >
            취소
          </button>
        </div>
      </div>

      {/* 사진 원본 팝업 */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, cursor: 'zoom-out',
          }}
        >
          <img
            src={previewImg}
            alt="원본 이미지"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}

      {/* 새로 시작 (백지화) 확인 팝업 */}
      {showArchiveModal && (
        <div
          onClick={() => !archiveLoading && setShowArchiveModal(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 3000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px',
              maxWidth: '360px', width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#dc2626' }}>
              🆕 {displayName} 새로 시작
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.4' }}>
              이 나무의 모든 작업 기록을 <b>앱에서 숨깁니다</b>.<br />
              기록 자체는 삭제되지 않고 엑셀 내보내기에 "예전" 표시로 남습니다.<br />
              <br />
              정말 새로 시작하시겠습니까?
            </p>
            <input
              type="password"
              placeholder="비밀번호"
              value={archivePassword}
              onChange={(e) => { setArchivePassword(e.target.value); setArchiveError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleArchive(); }}
              autoFocus
              disabled={archiveLoading}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '0.6rem',
                fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '6px',
                marginBottom: '0.5rem',
              }}
            />
            {archiveError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                {archiveError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={archiveLoading}
                style={{
                  flex: 1, padding: '0.6rem', border: '1px solid #d1d5db',
                  backgroundColor: 'white', color: '#4b5563',
                  borderRadius: '6px', cursor: archiveLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                취소
              </button>
              <button
                onClick={handleArchive}
                disabled={archiveLoading || !archivePassword}
                style={{
                  flex: 1, padding: '0.6rem', border: 'none',
                  backgroundColor: archivePassword ? '#dc2626' : '#fca5a5',
                  color: 'white', borderRadius: '6px',
                  cursor: (archiveLoading || !archivePassword) ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem', fontWeight: 600,
                }}
              >
                {archiveLoading ? '처리 중...' : '새로 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreeModal;