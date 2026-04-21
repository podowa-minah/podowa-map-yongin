// src/GrassModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { useGrassTypes } from './GrassTypesContext';
import { useLabels } from './LabelContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import grapelink from './assets/icons/grape.svg';

// ── KST 오늘 ──
function getKSTToday() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ── 썸네일 생성 ──
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

// ── 분포 막대 입력 (10% 단위) ──
function DistributionBar({ name, color, value, maxAvailable, onChange, onRemove }) {
  const slots = 10;
  const filled = value / 10;

  const handleTap = (idx) => {
    const newFilled = idx + 1;
    const newVal = newFilled * 10;
    if (newFilled === filled) {
      onChange(Math.max(0, (filled - 1) * 10));
    } else if (newVal <= value + maxAvailable) {
      onChange(newVal);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      <span style={{
        fontSize: '0.8rem', fontWeight: 600, color: '#333',
        minWidth: '50px', flexShrink: 0,
      }}>
        <span style={{
          display: 'inline-block', width: 10, height: 10, borderRadius: 2,
          backgroundColor: color, marginRight: 4, verticalAlign: 'middle',
        }} />
        {name}
      </span>

      <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {Array.from({ length: slots }, (_, i) => {
          const isFilled = i < filled;
          const canFill = !isFilled && ((i + 1) * 10 <= value + maxAvailable);
          return (
            <div
              key={i}
              onClick={() => handleTap(i)}
              style={{
                flex: 1,
                height: '28px',
                borderRadius: '3px',
                backgroundColor: isFilled ? color : '#e8e8e8',
                opacity: isFilled ? 1 : canFill ? 0.6 : 0.25,
                cursor: (isFilled || canFill) ? 'pointer' : 'default',
                transition: 'background-color 0.15s',
              }}
            />
          );
        })}
      </div>

      <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
        {value}%
      </span>

      <button
        onClick={onRemove}
        style={{
          border: 'none', background: 'none', fontSize: '1rem',
          color: '#aaa', cursor: 'pointer', padding: '2px 4px',
        }}
      >
        &times;
      </button>
    </div>
  );
}

// ── 풀 종류 추가 팝업 ──
function AddGrassPopup({ currentNames, allTypes, onSelect, onCreateNew, onChangeColor, onChangeName, onDelete, onClose }) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#ffffff');
  const [showCreate, setShowCreate] = useState(false);

  // 수정 모드: 비밀번호 입력 → 편집 패널
  const [editTargetId, setEditTargetId] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordError, setEditPasswordError] = useState('');
  const [editUnlocked, setEditUnlocked] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#ffffff');

  // 뒤로가기로 팝업 닫기
  React.useEffect(() => {
    window.history.pushState({ grassPopup: true }, '');
    const handlePop = () => onClose();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [onClose]);

  const handleClose = () => {
    if (window.history.state?.grassPopup) window.history.back();
    else onClose();
  };

  const openEdit = (t) => {
    setEditTargetId(t.id);
    setEditPassword('');
    setEditPasswordError('');
    setEditUnlocked(false);
    setEditName(t.name);
    setEditColor(t.color);
  };

  const confirmEditPassword = () => {
    if (editPassword !== '1234') {
      setEditPasswordError('비밀번호가 틀렸습니다');
      return;
    }
    setEditUnlocked(true);
  };

  const handleEditSave = async () => {
    const t = allTypes.find(x => x.id === editTargetId);
    if (!t) return;
    if (editName.trim() && editName.trim() !== t.name) await onChangeName(t.id, editName.trim());
    if (editColor !== t.color) await onChangeColor(t.id, editColor);
    setEditTargetId(null);
  };

  const handleEditDelete = async () => {
    await onDelete(editTargetId);
    setEditTargetId(null);
  };

  const searchFiltered = allTypes.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  // 풀 항목 한 줄 렌더 (원래 순서 유지, 토글)
  const renderGrassRow = (t) => {
    const isAdded = currentNames.includes(t.name);
    return (
    <div
      key={t.id}
      onClick={() => onSelect(t)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer',
        backgroundColor: isAdded ? '#f6fff0' : 'transparent',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <span style={{
          width: 14, height: 14, borderRadius: 3, backgroundColor: t.color,
          display: 'inline-block', border: '1px solid #ddd', flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.85rem' }}>{t.name}</span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {isAdded ? (
          <span style={{ fontSize: '0.7rem', color: '#7cb342' }}>추가됨</span>
        ) : (
          <span style={{ fontSize: '1.2rem', color: '#7cb342', fontWeight: 700 }}>+</span>
        )}
        <span
          onClick={e => { e.stopPropagation(); openEdit(t); }}
          style={{
            fontSize: '0.7rem', color: '#999', cursor: 'pointer',
            padding: '3px 8px', border: '1px solid #ddd', borderRadius: 4,
            background: '#fafafa',
          }}
        >수정</span>
      </span>
    </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
    }} onClick={handleClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '12px', padding: '20px',
        width: '90%', maxWidth: '340px', maxHeight: '70vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700 }}>+ 풀 종류 추가</span>
          <button onClick={handleClose} style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="풀 이름 검색..."
          style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            border: '1px solid #ddd', fontSize: '0.9rem', marginBottom: '12px',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '8px' }}>
          등록된 풀 ({allTypes.length}종)
        </div>

        {searchFiltered.map(t => renderGrassRow(t))}

        <div style={{ marginTop: '16px', textAlign: 'center', color: '#888', fontSize: '0.8rem' }}>
          찾는 풀이 없어요?
        </div>

        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              width: '100%', padding: '12px', marginTop: '8px',
              border: '2px dashed #c5e1a5', borderRadius: '8px',
              background: '#f9fbe7', color: '#558b2f', fontWeight: 600,
              fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            + 새로운 풀 만들기
          </button>
        ) : (
          <div style={{ marginTop: '12px', padding: '12px', background: '#f9fbe7', borderRadius: '8px' }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="풀 이름"
              style={{
                width: '100%', padding: '8px', borderRadius: '6px',
                border: '1px solid #ddd', fontSize: '0.9rem', marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem' }}>색상:</span>
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                style={{ width: 36, height: 28, border: 'none', cursor: 'pointer' }}
              />
            </div>
            <button
              onClick={() => { if (newName.trim()) onCreateNew(newName.trim(), newColor); }}
              disabled={!newName.trim()}
              style={{
                width: '100%', padding: '10px', borderRadius: '6px',
                background: newName.trim() ? '#7cb342' : '#ccc',
                color: '#fff', border: 'none', fontWeight: 600,
                fontSize: '0.9rem', cursor: newName.trim() ? 'pointer' : 'default',
              }}
            >
              등록하기
            </button>
          </div>
        )}
      </div>

      {/* 수정 팝업 (비밀번호 → 편집) */}
      {editTargetId && (
        <div
          onClick={() => setEditTargetId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '12px', padding: '20px',
            width: '85%', maxWidth: '300px',
          }}>
            {!editUnlocked ? (
              <>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
                  풀 종류 수정
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
                  "{allTypes.find(t => t.id === editTargetId)?.name}" 수정/삭제하려면 비밀번호를 입력하세요.
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={editPassword}
                  onChange={e => { setEditPassword(e.target.value); setEditPasswordError(''); }}
                  placeholder="비밀번호"
                  autoFocus
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: `1px solid ${editPasswordError ? '#e53935' : '#ddd'}`,
                    fontSize: '0.9rem', marginBottom: '4px', boxSizing: 'border-box',
                  }}
                />
                {editPasswordError && (
                  <div style={{ fontSize: '0.75rem', color: '#e53935', marginBottom: '8px' }}>{editPasswordError}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={confirmEditPassword}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                      background: '#7cb342', color: '#fff', fontWeight: 600, cursor: 'pointer',
                    }}
                  >확인</button>
                  <button
                    onClick={() => setEditTargetId(null)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: '1px solid #ddd', background: '#fff',
                      color: '#666', fontWeight: 600, cursor: 'pointer',
                    }}
                  >취소</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
                  풀 종류 수정
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '4px' }}>이름:</div>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{
                      width: '100%', padding: '8px', borderRadius: '6px',
                      border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '4px' }}>색상:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }}
                    />
                    <span style={{
                      width: 24, height: 24, borderRadius: 4, backgroundColor: editColor,
                      border: '1px solid #ddd', display: 'inline-block',
                    }} />
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>{editColor}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleEditSave}
                    disabled={!editName.trim()}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                      background: editName.trim() ? '#7cb342' : '#ccc',
                      color: '#fff', fontWeight: 600, cursor: editName.trim() ? 'pointer' : 'default',
                    }}
                  >저장</button>
                  <button
                    onClick={() => setEditTargetId(null)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: '1px solid #ddd', background: '#fff',
                      color: '#666', fontWeight: 600, cursor: 'pointer',
                    }}
                  >취소</button>
                </div>
                <button
                  onClick={handleEditDelete}
                  style={{
                    width: '100%', padding: '10px', marginTop: '10px',
                    borderRadius: '8px', border: '1px solid #e53935',
                    background: '#fff', color: '#e53935', fontWeight: 600,
                    fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >이 풀 종류 삭제</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 썸네일 이미지 ──
function ThumbImg({ src, onClick }) {
  const [loaded, setLoaded] = React.useState(false);
  return (
    <div onClick={onClick} style={{
      width: '36px', height: '36px', borderRadius: '4px', cursor: 'zoom-in',
      overflow: 'hidden', backgroundColor: '#e0e0e0', flexShrink: 0,
    }}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          width: '36px', height: '36px', objectFit: 'cover',
          filter: loaded ? 'none' : 'blur(4px)',
          opacity: loaded ? 1 : 0.6,
          transition: 'filter 0.3s, opacity 0.3s',
        }}
      />
    </div>
  );
}

// ── 메인 GrassModal ──
export default function GrassModal({ cellId, onClose, onOpenTree, user }) {
  const numericId = cellId.replace('Grass-', '');
  const { types, colorMap, addType, updateTypeColor, updateTypeName, deleteType } = useGrassTypes();
  const { labels: treeLabels } = useLabels();

  const treeLabelId = `Tree-${numericId}`;
  const treeLbl = treeLabels[treeLabelId] || {};
  const treeActive = !treeLbl.disabled;
  const treeName = treeLbl.name || '';

  const [date, setDate] = useState(getKSTToday());
  const [distribution, setDistribution] = useState([]);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [thumbnails, setThumbnails] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [previewImg, setPreviewImg] = useState(null); // { url, photos } or null
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [confirmPopup, setConfirmPopup] = useState(null); // { type: 'overwrite'|'delete', onConfirm }

  // 사진 프리뷰 + 히스토리 디테일 뒤로가기 (단일 핸들러, ref로 상태 추적)
  const previewOpenRef = React.useRef(false);
  const historyOpenRef = React.useRef(false);

  useEffect(() => {
    historyOpenRef.current = showHistoryDetail;
  }, [showHistoryDetail]);

  useEffect(() => {
    if (previewImg && !previewOpenRef.current) {
      previewOpenRef.current = true;
      window.history.pushState({ grassPreview: true }, '');
    } else if (!previewImg) {
      previewOpenRef.current = false;
    }
  }, [previewImg]);

  useEffect(() => {
    const handlePop = () => {
      // 사진 프리뷰가 열려 있으면 그것만 닫기
      if (previewOpenRef.current) {
        previewOpenRef.current = false;
        setPreviewImg(null);
        return;
      }
      // 히스토리 디테일이 열려 있으면 그것만 닫기
      if (historyOpenRef.current) {
        historyOpenRef.current = false;
        setShowHistoryDetail(false);
        return;
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  const [confirmPw, setConfirmPw] = useState('');
  const [confirmPwError, setConfirmPwError] = useState('');

  // 히스토리 로딩
  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('grass_records')
        .select('*')
        .eq('tree_id', numericId)
        .order('date', { ascending: false })
        .order('id', { ascending: false });
      if (!error && data) setHistory(data);
      setLoading(false);
    }
    fetch();
  }, [numericId]);

  // 히스토리에서 해당 날짜 기록 로딩 (최초 + 날짜 변경 시)
  const loadRecordForDate = React.useCallback((targetDate) => {
    const rec = history.find(r => r.date === targetDate);
    if (rec) {
      const dist = typeof rec.distribution === 'string'
        ? JSON.parse(rec.distribution)
        : rec.distribution;
      if (dist && typeof dist === 'object') {
        const entries = Object.entries(dist)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name, value }));
        setDistribution(entries);
      } else {
        setDistribution([]);
      }
      setComment(rec.comment || '');
      setImages(rec.photo_urls || []);
      setThumbnails(rec.thumbnails || []);
    } else {
      setDistribution([]);
      setComment('');
      setImages([]);
      setThumbnails([]);
    }
  }, [history]);

  // 최초 로딩: 오늘 날짜 기록 있으면 불러오고, 없으면 최신 기록
  useEffect(() => {
    if (history.length > 0 && !initialLoaded) {
      const todayRec = history.find(r => r.date === date);
      if (todayRec) {
        loadRecordForDate(date);
      } else {
        // 오늘 기록 없으면 최신 기록에서 분포만 가져옴 (새 입력 도움)
        const latest = history[0];
        const dist = typeof latest.distribution === 'string'
          ? JSON.parse(latest.distribution)
          : latest.distribution;
        if (dist && typeof dist === 'object') {
          const entries = Object.entries(dist)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value }));
          if (entries.length > 0) setDistribution(entries);
        }
      }
      setInitialLoaded(true);
    }
  }, [history, initialLoaded, date, loadRecordForDate]);

  // 날짜 변경 시 해당 날짜 기록 로딩
  useEffect(() => {
    if (initialLoaded && history.length > 0) {
      loadRecordForDate(date);
    }
  }, [date, initialLoaded, history, loadRecordForDate]);

  const totalPct = distribution.reduce((s, d) => s + d.value, 0);
  const remaining = 100 - totalPct;

  // 우세종 (동률 포함)
  const dominants = useMemo(() => {
    if (distribution.length === 0) return [];
    const maxVal = Math.max(...distribution.map(d => d.value));
    if (maxVal === 0) return [];
    return distribution.filter(d => d.value === maxVal);
  }, [distribution]);
  const dominant = dominants.length > 0 ? dominants[0] : null;

  // ── 차트 데이터 ──
  const chartGrasses = useMemo(() => {
    const all = new Set();
    history.forEach(rec => {
      const dist = typeof rec.distribution === 'string' ? JSON.parse(rec.distribution) : rec.distribution;
      if (dist) Object.keys(dist).filter(k => dist[k] > 0).forEach(k => all.add(k));
    });
    return [...all];
  }, [history]);

  const chartData = useMemo(() => {
    if (history.length === 0) return [];
    const sorted = [...history].reverse(); // 날짜 오름차순

    // 각 풀의 첫/마지막 등장 인덱스 계산
    const firstIdx = {};
    const lastIdx = {};
    sorted.forEach((rec, i) => {
      const dist = typeof rec.distribution === 'string' ? JSON.parse(rec.distribution) : rec.distribution;
      if (dist) {
        Object.entries(dist).forEach(([g, v]) => {
          if (v > 0) {
            if (firstIdx[g] === undefined) firstIdx[g] = i;
            lastIdx[g] = i;
          }
        });
      }
    });

    return sorted.map((rec, i) => {
      const dist = typeof rec.distribution === 'string' ? JSON.parse(rec.distribution) : rec.distribution;
      const point = { date: rec.date?.slice(5).replace('-', '/') };
      chartGrasses.forEach(g => {
        const val = dist?.[g];
        if (firstIdx[g] === undefined) return; // 한번도 안 나온 풀
        if (i < firstIdx[g] || i > lastIdx[g]) return; // 등장 전/후: undefined (라인 안 그림)
        if (val && val > 0) {
          point[g] = val; // 실제 값
        } else {
          point[g] = null; // 갭: null (점선으로 연결)
        }
      });
      return point;
    });
  }, [history, chartGrasses]);

  const updateValue = (idx, newVal) => {
    setDistribution(prev => prev.map((d, i) => i === idx ? { ...d, value: newVal } : d));
  };

  const removeGrass = (idx) => {
    setDistribution(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleGrassInList = (grassType) => {
    if (distribution.find(d => d.name === grassType.name)) {
      setDistribution(prev => prev.filter(d => d.name !== grassType.name));
    } else {
      setDistribution(prev => [...prev, { name: grassType.name, value: 0 }]);
    }
  };

  const createAndAddGrass = async (name, color) => {
    const created = await addType(name, color);
    if (created) {
      setDistribution(prev => [...prev, { name: created.name, value: 0 }]);
    }
  };

  // ── 사진 업로드 ──
  async function handleImageUpload(file) {
    if (!file || images.length >= 5) return;
    setUploading(true);
    const fileName = `grass-${numericId}-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage.from('tree-images').upload(fileName, file);
    if (error) {
      console.error('Error uploading image:', error.message);
      setUploading(false);
      return;
    }
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
      setImages(prev => [...prev, urlData.publicUrl]);
      setThumbnails(prev => [...prev, thumbUrl]);
    }
    setUploading(false);
  }

  async function handleImageDelete(url) {
    const filePath = url.split('tree-images/')[1];
    if (filePath) {
      await supabase.storage.from('tree-images').remove([filePath]);
      supabase.storage.from('tree-images').remove([`thumb/${filePath}`]).catch(() => {});
    }
    const idx = images.indexOf(url);
    setImages(prev => prev.filter(img => img !== url));
    setThumbnails(prev => { const n = [...prev]; if (idx >= 0) n.splice(idx, 1); return n; });
  }

  // 해당 날짜에 기존 기록 있는지
  const existingRecord = useMemo(() => {
    return history.find(r => r.date === date) || null;
  }, [history, date]);

  const isEmpty = distribution.length === 0 || totalPct === 0;

  // ── 저장/삭제 실행 ──
  const executeSave = async () => {
    setSaving(true);
    const producer = user?.user_metadata?.nickname || user?.email || '';

    if (isEmpty && existingRecord) {
      // 빈 상태 → 기존 기록 삭제
      await supabase.from('grass_records').delete().eq('id', existingRecord.id);
    } else if (!isEmpty && totalPct === 100) {
      const distObj = {};
      distribution.forEach(d => { if (d.value > 0) distObj[d.name] = d.value; });
      const dominantName = dominants.length > 0 ? dominants.map(d => d.name).join(',') : null;

      if (existingRecord) {
        await supabase.from('grass_records')
          .update({
            distribution: distObj, dominant_grass: dominantName,
            comment, producer, photo_urls: images, thumbnails,
          })
          .eq('id', existingRecord.id);
      } else {
        await supabase.from('grass_records').insert({
          tree_id: numericId, date, distribution: distObj,
          dominant_grass: dominantName, comment, producer,
          photo_urls: images, thumbnails,
        });
      }
    }

    setSaving(false);
    onClose();
  };

  // ── 저장 버튼 핸들러 ──
  const handleSave = () => {
    // 새 기록 (기존 없음): 바로 저장
    if (!existingRecord) {
      if (totalPct !== 100) return;
      executeSave();
      return;
    }
    // 기존 기록 있음 → 비번 확인 팝업
    setConfirmPopup({
      type: isEmpty ? 'delete' : 'overwrite',
      onConfirm: executeSave,
    });
    setConfirmPw('');
    setConfirmPwError('');
  };

  const handleConfirmSubmit = () => {
    const requiredPw = confirmPopup.type === 'delete' ? '6687' : '1234';
    if (confirmPw !== requiredPw) {
      setConfirmPwError('비밀번호가 틀렸습니다');
      return;
    }
    confirmPopup.onConfirm();
    setConfirmPopup(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '10px',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px',
        maxHeight: '90vh', overflowY: 'auto', padding: '20px',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <button onClick={onClose} style={{
            border: 'none', background: 'none', fontSize: '1.3rem',
            cursor: 'pointer', color: '#666', padding: 0,
          }}>&larr;</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>
              {numericId} {dominant ? dominant.name : ''}
            </div>
            {treeActive && (
              <div style={{ fontSize: '0.75rem', color: '#7b6b8a', fontWeight: 500 }}>
                {'\uD83C\uDF47'} {treeName ? `${treeName} (포도나무)` : '포도나무'}
              </div>
            )}
          </div>
          {treeActive && onOpenTree && (
            <img
              src={grapelink}
              alt="포도나무 모달"
              onClick={() => onOpenTree(`Tree-${numericId}`)}
              style={{
                width: 30, height: 30, cursor: 'pointer',
                transform: 'rotate(22deg)', opacity: 0.8,
              }}
            />
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />

        {/* 풀 분포 변화 차트 */}
        {chartData.length > 1 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>풀 분포 변화</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: -10, right: 5, top: 5, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} padding={{ left: 15, right: 15 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} width={40} />
                  <Tooltip content={({ payload, label }) => {
                    if (!payload?.length) return null;
                    const items = payload.filter(p => !String(p.name).endsWith('_dash') && p.value != null);
                    if (!items.length) return null;
                    return (
                      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        {items.map(p => (
                          <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}%</div>
                        ))}
                      </div>
                    );
                  }} />
                  <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
                  {/* 점선 레이어: 갭 구간 연결 (뒤에 깔림) */}
                  {chartGrasses.map(g => (
                    <Line
                      key={`${g}-dash`}
                      type="monotone"
                      dataKey={g}
                      stroke={colorMap[g] || '#999'}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      strokeOpacity={0.5}
                      dot={false}
                      connectNulls
                      name={`${g}_dash`}
                      legendType="none"
                    />
                  ))}
                  {/* 실선 레이어: 실제 데이터 (위에 덮음) */}
                  {chartGrasses.map((g, gi) => (
                    <Line
                      key={g}
                      type="monotone"
                      dataKey={g}
                      stroke={colorMap[g] || '#999'}
                      strokeWidth={2}
                      dot={(props) => {
                        const { cx, cy, payload, value } = props;
                        if (value == null) return null;
                        // 같은 값 가진 풀들만 모아서 [-2, +2] 범위 안에서 분산
                        const sameGroup = chartGrasses
                          .map((og, oi) => ({ name: og, idx: oi }))
                          .filter(o => payload[o.name] === value);
                        let offset = 0;
                        if (sameGroup.length > 1) {
                          const pos = sameGroup.findIndex(o => o.idx === gi);
                          const step = Math.min(3, 4 / (sameGroup.length - 1));
                          offset = (pos - (sameGroup.length - 1) / 2) * step;
                        }
                        const color = colorMap[g] || '#999';
                        return (
                          <circle
                            key={`${g}-${cx}`}
                            cx={cx + offset}
                            cy={cy}
                            r={3}
                            fill="rgba(255,255,255,0.5)"
                            stroke={color}
                            strokeWidth={1.5}
                          />
                        );
                      }}
                      name={g}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
          </div>
        )}

        {/* 날짜 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '4px' }}>날짜:</div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            onClick={e => { e.stopPropagation(); e.target.showPicker?.(); }}
            style={{
              padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd',
              fontSize: '0.95rem', width: '180px',
              WebkitAppearance: 'none', userSelect: 'auto',
            }}
          />
        </div>

        {/* 풀 분포 입력 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>풀 분포 (10% 단위):</span>
            <span style={{
              fontSize: '0.8rem', fontWeight: 600,
              color: totalPct === 100 ? '#4caf50' : '#e53935',
            }}>
              합계 {totalPct}% {totalPct === 100 ? '\u2713' : ''}
            </span>
          </div>

          {distribution.map((d, i) => (
            <DistributionBar
              key={d.name}
              name={d.name}
              color={colorMap[d.name] || '#999'}
              value={d.value}
              maxAvailable={remaining}
              onChange={val => updateValue(i, val)}
              onRemove={() => removeGrass(i)}
            />
          ))}

          <button
            onClick={() => setShowAddPopup(true)}
            style={{
              width: '100%', padding: '10px', marginTop: '4px',
              border: '2px dashed #c5e1a5', borderRadius: '8px',
              background: '#fafff5', color: '#7cb342', fontWeight: 600,
              fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            + 풀 종류 추가
          </button>
        </div>

        {/* 우세종 */}
        {dominants.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: '#f9fbe7', borderRadius: '8px',
            marginBottom: '16px', flexWrap: 'wrap', gap: '4px',
          }}>
            <span style={{ fontSize: '0.8rem', color: '#888' }}>우세종 (자동 계산)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, flexWrap: 'wrap' }}>
              {dominants.map(d => (
                <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    backgroundColor: colorMap[d.name] || '#999',
                    display: 'inline-block',
                  }} />
                  {d.name} {d.value}%
                </span>
              ))}
            </span>
          </div>
        )}

        {/* 사진 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '6px' }}>
            사진 ({images.length}/5):
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              backgroundColor: (images.length >= 5 || uploading) ? '#ccc' : '#7cb342',
              color: 'white', padding: '12px', borderRadius: '8px',
              cursor: (images.length >= 5 || uploading) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem', fontWeight: 600,
            }}>
              {'\uD83D\uDCF7'} 촬영
              <input
                type="file" accept="image/*" capture="environment"
                onChange={e => { if (e.target.files[0]) { handleImageUpload(e.target.files[0]); e.target.value = ''; } }}
                disabled={images.length >= 5 || uploading}
                style={{ display: 'none' }}
              />
            </label>
            <label style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              backgroundColor: (images.length >= 5 || uploading) ? '#ccc' : '#607d8b',
              color: 'white', padding: '12px', borderRadius: '8px',
              cursor: (images.length >= 5 || uploading) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem', fontWeight: 600,
            }}>
              {'\uD83D\uDDBC'} 갤러리
              <input
                type="file" accept="image/*"
                onChange={e => { if (e.target.files[0]) { handleImageUpload(e.target.files[0]); e.target.value = ''; } }}
                disabled={images.length >= 5 || uploading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {uploading && (
            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>업로드 중...</div>
          )}
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {images.map((url, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img
                    src={thumbnails[idx] || url}
                    alt=""
                    onClick={() => setPreviewImg(url)}
                    style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 4, cursor: 'zoom-in' }}
                  />
                  <button
                    onClick={() => handleImageDelete(url)}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#e53935', color: '#fff', border: 'none',
                      fontSize: '0.65rem', cursor: 'pointer', lineHeight: '18px',
                      textAlign: 'center', padding: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 코멘트 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '4px' }}>Comments:</div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px',
              border: '1px solid #ddd', fontSize: '0.85rem', resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 저장 버튼 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(() => {
            const canSave = totalPct === 100 || (isEmpty && existingRecord);
            const isDelete = isEmpty && existingRecord;
            return (
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px', border: 'none',
                  background: canSave ? (isDelete ? '#e53935' : '#7cb342') : '#ccc',
                  color: '#fff', fontWeight: 700, fontSize: '1rem',
                  cursor: canSave ? 'pointer' : 'default',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '처리 중...' : isDelete ? '기록 삭제' : 'Save & Close'}
              </button>
            );
          })()}
          <button
            onClick={onClose}
            style={{
              padding: '14px 20px', borderRadius: '10px',
              border: '1px solid #ddd', background: '#fff',
              color: '#666', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

        {/* 히스토리 — 더보기 버튼 */}
        {!loading && history.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <button
              onTouchStart={(e) => { e.preventDefault(); window.history.pushState({ grassHistory: true }, ''); setShowHistoryDetail(true); }}
              onClick={() => { window.history.pushState({ grassHistory: true }, ''); setShowHistoryDetail(true); }}
              style={{
                width: '100%', padding: '10px', backgroundColor: '#5c6bc0',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
              }}
            >
              히스토리 더보기 ({history.length}건)
            </button>
          </div>
        )}
      </div>

      {/* 히스토리 디테일 풀스크린 */}
      {showHistoryDetail && (
        <div
          onClick={(e) => { e.stopPropagation(); if (window.history.state?.grassHistory) window.history.back(); else setShowHistoryDetail(false); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
            zIndex: 10003, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px',
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto', padding: '16px',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748' }}>
                히스토리 ({history.length}건)
              </span>
              <button onClick={() => { if (window.history.state?.grassHistory) window.history.back(); else setShowHistoryDetail(false); }} style={{
                border: 'none', background: 'none', fontSize: '1.2rem',
                cursor: 'pointer', color: '#888',
              }}>&times;</button>
            </div>
            {history.map(rec => {
              const dist = typeof rec.distribution === 'string'
                ? JSON.parse(rec.distribution) : rec.distribution;
              const distEntries = Object.entries(dist || {})
                .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
              const photos = rec.photo_urls || [];
              const thumbs = rec.thumbnails || [];
              return (
                <div
                  key={rec.id}
                  onClick={() => { setDate(rec.date); historyOpenRef.current = false; setShowHistoryDetail(false); if (window.history.state?.grassHistory) window.history.back(); }}
                  style={{
                    borderBottom: '1px solid #f0f0f0', padding: '12px 0',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{rec.date}</span>
                    <span style={{ fontSize: '0.75rem', color: '#888' }}>{rec.producer || ''}</span>
                  </div>
                  {/* 우세종 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    {(rec.dominant_grass || '').split(',').filter(Boolean).map(n => (
                      <span key={n} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{
                          width: 10, height: 10, borderRadius: 3,
                          backgroundColor: colorMap[n.trim()] || '#999',
                          display: 'inline-block',
                        }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{n.trim()}</span>
                      </span>
                    ))}
                  </div>
                  {/* 분포 */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    {distEntries.map(([n, v]) => (
                      <span key={n} style={{
                        fontSize: '0.75rem', color: '#555',
                        background: `${colorMap[n] || '#ddd'}30`, borderRadius: 4, padding: '2px 6px',
                      }}>
                        {n} {v}%
                      </span>
                    ))}
                  </div>
                  {/* 코멘트 */}
                  {rec.comment && (
                    <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '6px' }}>
                      {rec.comment}
                    </div>
                  )}
                  {/* 사진 전부 표시 */}
                  {photos.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {photos.map((url, i) => (
                        <ThumbImg
                          key={i}
                          src={thumbs[i] || url}
                          onClick={(e) => { e.stopPropagation(); setPreviewImg({ url, photos }); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 이미지 프리뷰 (좌우 넘기기) */}
      {previewImg && (() => {
        const photos = previewImg.photos || [previewImg.url || previewImg];
        const currentUrl = previewImg.url || previewImg;
        const idx = photos.indexOf(currentUrl);
        const hasPrev = idx > 0;
        const hasNext = idx < photos.length - 1;
        const arrowStyle = (side) => ({
          position: 'absolute', [side]: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff',
          fontSize: '2rem', width: 44, height: 44, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 2,
        });
        return (
          <div
            onClick={(e) => { e.stopPropagation(); if (window.history.state?.grassPreview) window.history.back(); else { previewOpenRef.current = false; setPreviewImg(null); } }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {hasPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewImg({ url: photos[idx - 1], photos }); }}
                style={arrowStyle('left')}
              >&#8249;</button>
            )}
            <img
              src={currentUrl}
              alt=""
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '85%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            />
            {hasNext && (
              <button
                onClick={(e) => { e.stopPropagation(); setPreviewImg({ url: photos[idx + 1], photos }); }}
                style={arrowStyle('right')}
              >&#8250;</button>
            )}
            {/* 페이지 인디케이터 */}
            {photos.length > 1 && (
              <div style={{
                position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem',
              }}>
                {idx + 1} / {photos.length}
              </div>
            )}
          </div>
        );
      })()}

      {showAddPopup && (
        <AddGrassPopup
          currentNames={distribution.map(d => d.name)}
          allTypes={types}
          onSelect={toggleGrassInList}
          onCreateNew={createAndAddGrass}
          onChangeColor={updateTypeColor}
          onChangeName={updateTypeName}
          onDelete={deleteType}
          onClose={() => setShowAddPopup(false)}
        />
      )}

      {/* 덮어쓰기/삭제 확인 팝업 */}
      {confirmPopup && (
        <div
          onClick={() => setConfirmPopup(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: '12px', padding: '20px',
            width: '85%', maxWidth: '300px',
          }}>
            <div style={{
              fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px',
              color: confirmPopup.type === 'delete' ? '#e53935' : '#2d3748',
            }}>
              {confirmPopup.type === 'delete' ? '기록 삭제' : '기록 덮어쓰기'}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '12px' }}>
              {confirmPopup.type === 'delete'
                ? `${date} 기록을 삭제합니다. 비밀번호를 입력하세요.`
                : `${date}에 저장된 데이터가 있습니다. 덮어쓰려면 비밀번호를 입력하세요.`
              }
            </div>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setConfirmPwError(''); }}
              placeholder="비밀번호"
              autoFocus
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                border: `1px solid ${confirmPwError ? '#e53935' : '#ddd'}`,
                fontSize: '0.9rem', marginBottom: '4px', boxSizing: 'border-box',
              }}
            />
            {confirmPwError && (
              <div style={{ fontSize: '0.75rem', color: '#e53935', marginBottom: '8px' }}>{confirmPwError}</div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={handleConfirmSubmit}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: confirmPopup.type === 'delete' ? '#e53935' : '#7cb342',
                  color: '#fff', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {confirmPopup.type === 'delete' ? '삭제' : '덮어쓰기'}
              </button>
              <button
                onClick={() => setConfirmPopup(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px',
                  border: '1px solid #ddd', background: '#fff',
                  color: '#666', fontWeight: 600, cursor: 'pointer',
                }}
              >취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
