// src/components/DiagPhotoStrip.jsx
// 진단 사진 — 벌레/발병 사진을 찍어서 season_data.diag_photos 에 태그와 함께 쌓음.
//   · 업로드는 기존과 동일: tree-images 버킷 + thumb/ 썸네일. (TreeModal handleImageUploadDirect 패턴)
//   · 버튼은 "생육 사진"과 같은 언어 — 📷 촬영(초록) / 🖼 갤러리(주황) 통통버튼 (통일감, minari 요청).
//   · 지금 고른 벌레/병 이름이 자동 태그(tag) + 종류(kind) → 데이터 페이지에서 "응애 사진만 모아보기" 됨.
//   · 사진 자체 날짜는 이 나무 기록(trees.date)이 곧 그 날짜라 따로 저장 안 함 (§10 계산으로 뽑음).
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { createThumbnail } from '../utils/imageThumbnail';

const MAX = 6;
const KIND_STYLE = {
  pest: { tx: '#b45309', bd: '#fde68a' },
  disease: { tx: '#0f766e', bd: '#99f6e4' },
};

// "생육 사진" 버튼과 동일한 통통 3D 버튼 스타일 (색만 다름)
function bigBtn(disabled, color, shadowColor) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    backgroundColor: disabled ? '#ccc' : color,
    color: 'white', padding: '1rem 1.5rem', borderRadius: '0.7rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '1.2rem', fontWeight: 600,
    boxShadow: disabled ? 'none' : `0 4px 0 ${shadowColor}`,
  };
}

export default function DiagPhotoStrip({ photos = [], onChange, tag, kind = 'pest', treeId = 'tree' }) {
  const [uploading, setUploading] = useState(false);
  const ks = KIND_STYLE[kind] || KIND_STYLE.pest;
  const label = tag || (kind === 'pest' ? '벌레' : '병');
  const full = photos.length >= MAX;

  async function handleFile(e) {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    if (!file || full) return;
    setUploading(true);
    const fileName = `${treeId}-diag-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage.from('tree-images').upload(fileName, file);
    if (error) { console.error('진단사진 업로드 실패:', error.message); setUploading(false); if (inputEl) inputEl.value = ''; return; }
    const { data: urlData } = supabase.storage.from('tree-images').getPublicUrl(fileName);

    let thumbUrl = '';
    const thumbBlob = await createThumbnail(file, 256);
    if (thumbBlob) {
      const thumbName = `thumb/${fileName}`;
      const { error: te } = await supabase.storage.from('tree-images').upload(thumbName, thumbBlob);
      if (!te) {
        const { data: td } = supabase.storage.from('tree-images').getPublicUrl(thumbName);
        thumbUrl = td?.publicUrl || '';
      }
    }

    if (urlData?.publicUrl) {
      onChange?.([...photos, { url: urlData.publicUrl, thumb: thumbUrl || urlData.publicUrl, tag: label, kind }]);
    }
    setUploading(false);
    if (inputEl) inputEl.value = '';
  }

  function handleDelete(idx) {
    const p = photos[idx];
    if (p?.url) {
      const path = p.url.split('tree-images/')[1];
      if (path) supabase.storage.from('tree-images').remove([path]).catch(() => {});
    }
    if (p?.thumb) {
      const tp = p.thumb.split('tree-images/')[1];
      if (tp) supabase.storage.from('tree-images').remove([tp]).catch(() => {});
    }
    onChange?.(photos.filter((_, i) => i !== idx));
  }

  const disabled = full || uploading;

  return (
    <div style={{ marginLeft: '0.5rem', marginTop: '0.9rem' }}>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.45rem' }}>
        📸 진단 사진{photos.length > 0 && <b style={{ color: '#4b5563', fontWeight: 700, marginLeft: 4 }}>{photos.length}</b>}
        <span style={{ color: '#b9b3a6', marginLeft: 6 }}>(찍으면 <b style={{ color: ks.tx }}>{label}</b> 태그가 붙어요)</span>
      </div>

      {/* 촬영 / 갤러리 — 생육 사진과 같은 버튼 언어 */}
      {!full && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <label style={bigBtn(disabled, '#16a34a', 'rgba(20, 83, 45, 0.5)')}>
            📷 촬영
            <input
              type="file" accept="image/*" capture="environment"
              onChange={handleFile} disabled={disabled} style={{ display: 'none' }}
            />
          </label>
          <label style={bigBtn(disabled, '#f97316', 'rgba(154, 52, 18, 0.5)')}>
            🖼 갤러리
            <input
              type="file" accept="image/*"
              onChange={handleFile} disabled={disabled} style={{ display: 'none' }}
            />
          </label>
          {uploading && (
            <span style={{ fontSize: '0.85rem', color: '#555', alignSelf: 'center' }}>올리는 중...</span>
          )}
        </div>
      )}

      {/* 썸네일 (최신이 앞, 태그 붙음) */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {photos.slice().reverse().map((p, ri) => {
            const idx = photos.length - 1 - ri;
            const pks = KIND_STYLE[p.kind] || KIND_STYLE.pest;
            return (
              <div key={idx} style={{ position: 'relative', width: 80, flex: '0 0 auto' }}>
                <img
                  src={p.thumb || p.url}
                  alt={p.tag || '진단사진'}
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '0.6rem', border: `2px solid ${pks.bd}`, display: 'block' }}
                />
                <span style={{
                  position: 'absolute', left: 3, bottom: 3, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: '1px 5px', borderRadius: 999, background: pks.tx, color: '#fff', fontSize: '0.62rem', fontWeight: 700,
                }}>{p.tag}</span>
                <button
                  onClick={() => handleDelete(idx)}
                  aria-label={`${p.tag || '사진'} 삭제`}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999,
                    border: '2px solid #fff', background: '#ef4444', color: '#fff', fontSize: '0.8rem', lineHeight: 1,
                    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }}
                >✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
