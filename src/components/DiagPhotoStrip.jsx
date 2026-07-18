// src/components/DiagPhotoStrip.jsx
// 진단 사진 — 벌레/발병 사진을 season_data.diag_photos 에 태그와 함께 쌓음. (= 우리 밭 병해충 도감의 원재료)
//   사진 1장 = { url, thumb, tag(응애/흰가루병), kind(pest/disease), part(성충·유충·피해), note(설명) }
//     · 벌레: 성충 / 유충 / 피해 3종 — 유충·성충 구분해야 도감·AI가 쓸모있음 (minari 요청)
//     · 병  : 피해(병징)만
//     · note: 사진 설명 — "잎 뒷면에 다수" 같은 것. 도감/AI 학습에 제일 중요 (minari 요청)
//   업로드는 기존과 동일: tree-images 버킷 + thumb/ 썸네일. 버튼은 "생육 사진"과 같은 언어.
//   사진 날짜는 이 나무 기록(trees.date)이 곧 그 날짜라 따로 저장 안 함 (§10 계산으로 뽑음).
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { createThumbnail } from '../utils/imageThumbnail';

const MAX = 6;
export const PART_LABEL = { adult: '성충', larva: '유충', damage: '피해' };
const KIND_STYLE = {
  pest: { tx: '#b45309', bd: '#fde68a' },
  disease: { tx: '#0f766e', bd: '#99f6e4' },
};

// "생육 사진" 버튼과 동일한 통통 3D 버튼
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

// 성충/유충/피해 토글 (해충관리 버튼과 같은 톤)
function partBtn(active) {
  return {
    flex: '1 1 0', minWidth: 0, padding: '0.55rem 0', borderRadius: '0.7rem', cursor: 'pointer',
    border: active ? '3px solid #16a34a' : '2px solid #e2e8f0',
    background: active ? '#f0fdf4' : '#fff',
    color: active ? '#14532d' : '#6b7280',
    fontSize: '0.9rem', fontWeight: active ? 700 : 500, transition: 'all 0.1s ease',
  };
}

export default function DiagPhotoStrip({ photos = [], onChange, tag, kind = 'pest', treeId = 'tree' }) {
  const [uploading, setUploading] = useState(false);
  const [pestPart, setPestPart] = useState('adult');   // 벌레일 때만 고름
  const [note, setNote] = useState('');                // 다음에 찍는 사진에 붙을 설명
  const ks = KIND_STYLE[kind] || KIND_STYLE.pest;
  const label = tag || (kind === 'pest' ? '벌레' : '병');
  const part = kind === 'disease' ? 'damage' : pestPart;   // 병은 항상 피해(병징)
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
      onChange?.([...photos, {
        url: urlData.publicUrl,
        thumb: thumbUrl || urlData.publicUrl,
        tag: label, kind, part,
        note: note.trim(),
      }]);
      setNote('');   // 설명은 사진마다 새로
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
        <span style={{ color: '#b9b3a6', marginLeft: 6 }}>
          (찍으면 <b style={{ color: ks.tx }}>{label} · {PART_LABEL[part]}</b> 로 저장)
        </span>
      </div>

      {!full && (
        <>
          {/* 벌레 = 성충/유충/피해 · 병 = 피해(병징) */}
          {kind === 'pest' ? (
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <button onClick={() => setPestPart('adult')} style={partBtn(part === 'adult')}>🐛 성충</button>
              <button onClick={() => setPestPart('larva')} style={partBtn(part === 'larva')}>🐞 유충</button>
              <button onClick={() => setPestPart('damage')} style={partBtn(part === 'damage')}>🍂 피해</button>
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#0f766e', marginBottom: '0.5rem' }}>
              🍂 병은 <b>피해(병징) 사진</b>으로 저장돼요
            </div>
          )}

          {/* 사진 설명 — 도감/AI에 제일 중요 */}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="사진 설명 (예: 잎 뒷면에 다수)"
            maxLength={40}
            style={{
              width: '100%', marginBottom: '0.5rem', padding: '0.5rem 0.6rem',
              border: '1px solid #e2e8f0', borderRadius: '0.5rem',
              fontFamily: 'inherit', fontSize: '1rem', boxSizing: 'border-box',
              backgroundColor: '#fafaf7',
            }}
          />

          {/* 촬영 / 갤러리 — 생육 사진과 같은 버튼 언어 */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <label style={bigBtn(disabled, '#16a34a', 'rgba(20, 83, 45, 0.5)')}>
              📷 촬영
              <input type="file" accept="image/*" capture="environment"
                onChange={handleFile} disabled={disabled} style={{ display: 'none' }} />
            </label>
            <label style={bigBtn(disabled, '#f97316', 'rgba(154, 52, 18, 0.5)')}>
              🖼 갤러리
              <input type="file" accept="image/*"
                onChange={handleFile} disabled={disabled} style={{ display: 'none' }} />
            </label>
            {uploading && <span style={{ fontSize: '0.85rem', color: '#555', alignSelf: 'center' }}>올리는 중...</span>}
          </div>
        </>
      )}

      {/* 썸네일 (최신이 앞) — 태그·부위 배지 + 설명 */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {photos.slice().reverse().map((p, ri) => {
            const idx = photos.length - 1 - ri;
            const pks = KIND_STYLE[p.kind] || KIND_STYLE.pest;
            const badge = p.part ? `${p.tag}·${PART_LABEL[p.part] || ''}` : p.tag;
            const full2 = p.note ? `${badge} — ${p.note}` : badge;
            return (
              <div key={idx} style={{ position: 'relative', width: 84, flex: '0 0 auto' }}>
                <img
                  src={p.thumb || p.url}
                  alt={full2}
                  title={full2}
                  style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: '0.6rem', border: `2px solid ${pks.bd}`, display: 'block' }}
                />
                <span title={full2} style={{
                  position: 'absolute', left: 3, bottom: 3, maxWidth: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  padding: '1px 5px', borderRadius: 999, background: pks.tx, color: '#fff', fontSize: '0.6rem', fontWeight: 700,
                }}>{badge}</span>
                <button
                  onClick={() => handleDelete(idx)}
                  aria-label={`${badge || '사진'} 삭제`}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999,
                    border: '2px solid #fff', background: '#ef4444', color: '#fff', fontSize: '0.8rem', lineHeight: 1,
                    cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                  }}
                >✕</button>
                {p.note && (
                  <div title={p.note} style={{
                    fontSize: '0.62rem', color: '#6b7280', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.note}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
