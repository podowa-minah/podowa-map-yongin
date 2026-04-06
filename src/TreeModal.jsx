// @ts-nocheck
// src/TreeModal.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useLabels } from './LabelContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';


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
  return formatDateForDisplay(new Date().toISOString().slice(0, 10));
}

// ---------- CONFIGURATION OPTIONS ---------- //
const POWER_OPTIONS = ['판단불가/지켜봐야함', '1', '2', '3', '4', '5'];
const BALANCE_OPTIONS = ['판단불가/지켜봐야함', '1', '2', '3', '4', '5'];
const BUG_OPTIONS = [0, 1, 2, 3, 4, 5];

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

// ---------- MAIN COMPONENT ---------- //
const TreeModal = ({ treeId, initialData, onClose, user }) => {
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

  const [newImage, setNewImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);
  const toggleShowTable = () => setShowTable(!showTable);
  const [sortCol, setSortCol] = useState('date');
  const [sortAsc, setSortAsc] = useState(false); // 디폴트: 최신 먼저 (내림차순)

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
        .order('date');

      if (!error && data) {
        const formattedData = data.map(d => ({
          date: d.date,
          season: d.season,
          power: d.power,
          balance: d.balance,
          bugs: d.bugs,
          comments: d.comments || '',
          producer: d.producer || '',
          images: d.images || [],
          thumbnails: d.thumbnails || [],
          partial_treatment: d.partial_treatment || false,
          powerJ: (parseInt(d.power) || 0),
          balanceJ: (parseInt(d.balance) || 0),
          bugsJ: (parseInt(d.bugs) || 0),
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
    border: active ? '2px solid blue' : '2px solid #ccc',
    borderRadius: '0.5rem',
    backgroundColor: active ? '#e0f0ff' : '#fff',
    cursor: 'pointer',
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

  async function handleImageUpload() {
    if (!newImage || treeData.images.length >= 5) return;
    const fileName = `${treeId}-${Date.now()}-${newImage.name}`;

    // 원본 업로드
    const { error } = await supabase.storage.from('tree-images').upload(fileName, newImage);
    if (error) {
      console.error('Error uploading image:', error.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('tree-images').getPublicUrl(fileName);

    // 썸네일 생성 & 업로드
    let thumbUrl = '';
    const thumbBlob = await createThumbnail(newImage);
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
    setNewImage(null);
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

    const { error } = await supabase
      .from('trees')
      .upsert(row, { onConflict: ['id', 'date'] });

    if (error) console.error(error);
    onClose();
  }

  const currentSeason = Number(treeData.season);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
      }}
    >
      <div
        style={{
          position: 'relative', backgroundColor: 'white', padding: '0 1rem 1rem', borderRadius: '0.5rem',
          maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto', zIndex: 1000,
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 10, padding: '1rem 1rem',
            backdropFilter: 'blur(6px)', backgroundColor: 'rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '1.4rem', fontWeight: 600 }}>{displayName}</span>
        </div>

        {/* Chart */}
        {history.length > 0 && (
          <div style={{ height: 220, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={history.map(h => ({
                  ...h,
                  powerJ: (h.powerJ || 0) + (Math.random() - 0.5) * 0.5,
                  balanceJ: (h.balanceJ || 0) + (Math.random() - 0.5) * 0.5,
                  bugsJ: (h.bugsJ || 0) + (Math.random() - 0.5) * 0.5,
                }))}
                margin={{ top: 10, right: 20 }}
              >
                <CartesianGrid vertical={false} horizontal={false} />
                {[1, 2, 3, 4, 5].map((y) => (
                  <ReferenceLine key={y} y={y} stroke="#ccc" strokeDasharray="3 3" ifOverflow="extendDomain" />
                ))}
                <XAxis dataKey="date" tickFormatter={(d) => { const [, month, day] = d.split('-'); return `${month}/${day}`; }} axisLine />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickFormatter={(v) => (v === 0 ? '0/NA' : v)} axisLine />
                <Tooltip cursor={false} formatter={(val) => Math.round(val)} />
                <Legend
                  wrapperStyle={{ display: 'flex', justifyContent: 'center' }}
                  content={({ payload }) => (
                    <div style={{ display: 'flex', gap: 18 }}>
                      {payload.map(({ color, value }) => {
                        const label = { powerJ: '세력', balanceJ: '균형', bugsJ: '해충' }[value] || value;
                        return (
                          <span key={value} style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                            <svg width="30" height="10" style={{ marginRight: 4 }}>
                              <line x1="0" y1="5" x2="26" y2="5" stroke={color} strokeWidth="2" />
                              <circle cx="13" cy="5" r="3.5" fill={color} />
                            </svg>
                            {label}
                          </span>
                        );
                      })}
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
                <Line type="basis" dataKey="powerJ" stroke="green" strokeWidth={2} dot={{ r: 4, fill: 'green' }} name="세력" isAnimationActive={false} />
                <Line type="basis" dataKey="balanceJ" stroke="blue" strokeWidth={2} dot={{ r: 4, fill: 'blue' }} name="균형" isAnimationActive={false} />
                <Line type="basis" dataKey="bugsJ" stroke="red" strokeWidth={2} dot={{ r: 4, fill: 'red' }} name="해충" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 1. Date */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>날짜:</label>
          <input
            type="date"
            value={parseDateForSupabase(treeData.date)}
            onChange={(e) => handleDateChange(e.target.value)}  // ✅ 날짜 변경 시 데이터 로드
            style={{ marginLeft: '0.5rem', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>

        {/* 2. Season */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>생육시기:</label>
          <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
            {SEASONS.map((s) => (
              <button key={s} onClick={() => handleChange('season', String(s))} style={buttonStyle(treeData.season === String(s))}>
                {SEASON_NAMES[s] || `Season ${s}`}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Season-specific items */}
        {treeData.season && currentSeason >= 1 && currentSeason <= 6 && (
          <div style={{ border: '1px solid #ccc', padding: '0.5rem', marginBottom: '1rem' }}>
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
                    style={{ width: '1.5rem', height: '1.5rem', marginRight: '0.5rem' }}
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
                            onChange={() => handleLikertChange(7, q, score)}
                            style={{ width: '1.5rem', height: '1.5rem' }}
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

        {/* 4. Power */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>나무의 세력:</label>
          <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
            {POWER_OPTIONS.map((p) => (
              <button key={p} onClick={() => handleChange('power', p)} style={buttonStyle(treeData.power === p)}>{p}</button>
            ))}
          </div>
        </div>

        {/* 5. Balance */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>나무의 균형도:</label>
          <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
            {BALANCE_OPTIONS.map((b) => (
              <button key={b} onClick={() => handleChange('balance', b)} style={buttonStyle(treeData.balance === b)}>{b}</button>
            ))}
          </div>
        </div>

        {/* 6. Bugs */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>해충관리:</label>
          <div style={{ marginLeft: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
            {BUG_OPTIONS.map((num) => (
              <button key={num} onClick={() => handleChange('bugs', String(num))} style={buttonStyle(treeData.bugs === String(num))}>{num}</button>
            ))}
          </div>
        </div>

        {/* 6.5 부분방제 */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>부분방제:</label>
          <div style={{ marginLeft: '0.5rem', display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
            <button
              onClick={() => handleChange('partial_treatment', true)}
              style={{
                padding: '0.7rem 1.5rem',
                fontSize: '1.1rem',
                border: treeData.partial_treatment === true ? '2px solid #e91e63' : '2px solid #ccc',
                borderRadius: '0.5rem',
                backgroundColor: treeData.partial_treatment === true ? '#fce4ec' : '#fff',
                color: treeData.partial_treatment === true ? '#e91e63' : '#333',
                fontWeight: treeData.partial_treatment === true ? 'bold' : 'normal',
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
                border: treeData.partial_treatment === false ? '2px solid blue' : '2px solid #ccc',
                borderRadius: '0.5rem',
                backgroundColor: treeData.partial_treatment === false ? '#e0f0ff' : '#fff',
                cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        </div>

        {/* 7. Images */}
        <div style={{ marginBottom: '0.5rem' }}>
          <label>사진 ({treeData.images.length}/5):</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            {/* 📷 카메라 직접 촬영 */}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              backgroundColor: treeData.images.length >= 5 ? '#ccc' : '#2196f3',
              color: 'white', padding: '0.5rem 1rem', borderRadius: '0.3rem',
              cursor: treeData.images.length >= 5 ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
            }}>
              📷 촬영
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => { if (e.target.files[0]) { setNewImage(e.target.files[0]); } }}
                disabled={treeData.images.length >= 5}
                style={{ display: 'none' }}
              />
            </label>

            {/* 🖼 갤러리에서 선택 */}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              backgroundColor: treeData.images.length >= 5 ? '#ccc' : '#607d8b',
              color: 'white', padding: '0.5rem 1rem', borderRadius: '0.3rem',
              cursor: treeData.images.length >= 5 ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem',
            }}>
              🖼 갤러리
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { if (e.target.files[0]) { setNewImage(e.target.files[0]); } }}
                disabled={treeData.images.length >= 5}
                style={{ display: 'none' }}
              />
            </label>

            {/* 선택된 파일명 + 업로드 버튼 */}
            {newImage && (
              <>
                <span style={{ fontSize: '0.85rem', color: '#555', alignSelf: 'center', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {newImage.name}
                </span>
                <button
                  onClick={handleImageUpload}
                  style={{ backgroundColor: 'green', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
                >
                  ✅ 업로드
                </button>
                <button
                  onClick={() => setNewImage(null)}
                  style={{ backgroundColor: '#ccc', color: '#333', padding: '0.5rem 0.7rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </>
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
        <div style={{ marginBottom: '1rem' }}>
          <label>Comments:</label>
          <textarea
            value={treeData.comments}
            onChange={(e) => handleChange('comments', e.target.value)}
            style={{ display: 'block', width: '100%', height: '60px' }}
          />
        </div>

        {/* 더보기 */}
        <div style={{ marginBottom: '0.5rem' }}>
          <button
            onClick={toggleShowTable}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#5c6bc0', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            {showTable ? '간단히 보기' : '더보기'}
          </button>
        </div>

        {showTable && (
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '0.2rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f3f3' }}>
                  {[
                    ['date', '날짜'],
                    ['season', '생육시기'],
                    ['power', '세력'],
                    ['balance', '균형'],
                    ['bugs', '해충'],
                    ['partial_treatment', '부분방제'],
                    ['comments', '코멘트'],
                    ['images', '사진'],
                    ['producer', '생산자'],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      style={{ ...cellStyle, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSort(key)}
                    >
                      {label}{sortCol === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
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
                    <td style={cellStyle}>{row.comments}</td>
                    <td style={cellStyle}>
                      {row.images && row.images.length > 0 ? (
                        <ThumbImg
                          src={row.thumbnails?.[0] || row.images[0]}
                          fullSrc={row.images[0]}
                          onPreview={(url) => { setPreviewImg(url); }}
                        />
                      ) : '-'}
                    </td>
                    <td style={cellStyle}>{row.producer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SAVE & CANCEL */}
        <button
          onClick={saveChanges}
          style={{ backgroundColor: 'blue', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
        >
          Save & Close
        </button>
        <button
          onClick={onClose}
          style={{ marginLeft: '0.5rem', backgroundColor: '#ccc', color: 'black', padding: '0.5rem 1rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer' }}
        >
          Cancel
        </button>
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
    </div>
  );
};

export default TreeModal;