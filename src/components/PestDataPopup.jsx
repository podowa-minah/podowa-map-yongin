// src/components/PestDataPopup.jsx
// 포도와 병해충 데이터 — 우리 밭에서 실제로 쌓인 것만으로 만든 "도감 + 현황".
//   벌레/병 하나 고르면: 감염%(막대) · 번짐 추이 · 사진 도감(성충/유충/피해 + 설명) · 있는 나무 목록.
//   모든 값은 trees에서 계산 (§10, 저장 안 함). 사진은 개별차트에서 찍힌 게 자동으로 모임.
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { collectDiagPhotos, countAsOf } from '../lib/pest-distribution';
import { colorOf, pestShade } from '../lib/pest-colors';
import { PART_LABEL } from './DiagPhotoStrip';
import { getKSTToday } from '../utils/dailyStats';

const PART_ORDER = ['adult', 'larva', 'damage'];
const PART_EMOJI = { adult: '🐛', larva: '🐞', damage: '🍂' };

export default function PestDataPopup({ dist, colors = {}, treeData = {}, labels = {}, onClose, onOpenTree }) {
  const list = dist?.list || [];
  const total = dist?.total || 0;
  const [sel, setSel] = useState(dist?.worst?.name || list[0]?.name || null);

  const it = list.find((x) => x.name === sel) || null;
  const c = sel ? colorOf(sel, colors) : '#9ca3af';

  const photoBook = useMemo(() => collectDiagPhotos(treeData, labels), [treeData, labels]);
  const shots = (sel && photoBook[sel]) || { adult: [], larva: [], damage: [] };

  // 번짐 추이 — 7일 전 대비
  const trend = useMemo(() => {
    if (!sel) return null;
    const today = getKSTToday();
    const weekAgo = new Date(new Date(today).getTime() - 7 * 86400000).toISOString().slice(0, 10);
    return {
      now: countAsOf(treeData, labels, sel, today),
      before: countAsOf(treeData, labels, sel, weekAgo),
    };
  }, [treeData, labels, sel]);

  const chip = (active, color) => ({
    flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '0.4rem 0.7rem', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? `2px solid ${color}` : '1.5px solid #e2e8f0',
    background: '#fff', fontSize: '0.85rem', fontWeight: active ? 800 : 600, color: '#374151',
  });

  const diff = trend ? trend.now - trend.before : 0;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '1rem', width: '100%', maxWidth: 420, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 12px 34px rgba(0,0,0,0.3)' }}
      >
        {/* 헤더 */}
        <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '0.9rem 1rem 0.6rem', borderBottom: '1px solid #f1efe9', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>🔬 병해충 데이터</span>
            <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
            0%에 가까울수록 밭이 깨끗합니다
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginTop: '0.6rem', paddingBottom: 2 }}>
            {list.map((x) => {
              const xc = colorOf(x.name, colors);
              return (
                <button key={x.name} onClick={() => setSel(x.name)} style={chip(sel === x.name, xc)}>
                  {x.name}
                  <span style={{ minWidth: 18, height: 18, lineHeight: '18px', textAlign: 'center', borderRadius: 999, background: xc, color: '#fff', fontSize: '0.7rem', fontWeight: 800 }}>{x.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!it ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>
            밭이 깨끗해요 · 기록된 병해충 없음
          </div>
        ) : (
          <div style={{ padding: '0.9rem 1rem 1.2rem' }}>
            {/* 감염 막대 + % */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.35rem' }}>
              <div style={{ flex: 1, height: 12, borderRadius: 999, background: '#efece5', overflow: 'hidden' }}>
                <div style={{ width: `${it.pct}%`, height: '100%', background: c, borderRadius: 999 }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '1.3rem', color: c, minWidth: 56, textAlign: 'right' }}>{it.pct}%</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
              감염 <b style={{ color: '#3a382f' }}>{it.count}</b> / 전체 {total}그루 · 평균 <b style={{ color: '#3a382f' }}>{it.avgScore}</b>점 · 최고 <b style={{ color: '#3a382f' }}>{it.maxScore}</b>점
            </div>

            {/* 번짐 추이 */}
            {trend && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 0.7rem', marginBottom: '0.9rem',
                borderRadius: '0.7rem', border: `1.5px solid ${diff > 0 ? '#fecaca' : '#bbf7d0'}`,
                background: diff > 0 ? '#fef2f2' : '#f0fdf4',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️'}</span>
                <span style={{ fontSize: '0.85rem', color: '#3a382f' }}>
                  지난주 <b>{trend.before}</b>그루 → 오늘 <b>{trend.now}</b>그루
                </span>
                <b style={{ marginLeft: 'auto', color: diff > 0 ? '#c0140f' : diff < 0 ? '#16a34a' : '#9ca3af', fontSize: '0.9rem' }}>
                  {diff > 0 ? `▲${diff} 번지는 중` : diff < 0 ? `▼${-diff} 줄어드는 중` : '그대로'}
                </b>
              </div>
            )}

            {/* 사진 도감 */}
            <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              📸 {sel} 도감 <span style={{ color: '#b9b3a6', fontWeight: 500, fontSize: '0.78rem' }}>(우리 밭에서 찍은 것)</span>
            </div>
            {PART_ORDER.every((p) => (shots[p] || []).length === 0) ? (
              <div style={{ fontSize: '0.82rem', color: '#b9b3a6', marginBottom: '0.9rem' }}>
                아직 사진이 없어요 — 나무 차트에서 <b>＋기록 → 진단 사진</b>으로 찍으면 여기 모여요
              </div>
            ) : (
              PART_ORDER.map((p) => {
                const arr = shots[p] || [];
                if (arr.length === 0) return null;
                return (
                  <div key={p} style={{ marginBottom: '0.8rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4b5563', marginBottom: '0.35rem' }}>
                      {PART_EMOJI[p]} {PART_LABEL[p]} <span style={{ color: '#b9b3a6', fontWeight: 500 }}>{arr.length}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: 2 }}>
                      {arr.map((ph, i) => (
                        <div key={i} style={{ width: 96, flex: '0 0 auto' }}>
                          <img
                            src={ph.thumb || ph.url} alt={ph.note || PART_LABEL[p]} title={ph.note || ''}
                            onClick={() => onOpenTree?.(`Tree-${ph.treeId}`)}
                            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: '0.5rem', border: `2px solid ${pestShade(c, 3)}`, display: 'block', cursor: 'pointer' }}
                          />
                          <div style={{ fontSize: '0.62rem', color: '#3a382f', marginTop: 3, lineHeight: 1.25, minHeight: 15 }}>
                            {ph.note || <span style={{ color: '#cfc9bb' }}>설명 없음</span>}
                          </div>
                          <div style={{ fontSize: '0.58rem', color: '#b9b3a6' }}>{ph.treeId} · {ph.date?.slice(5)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {/* 있는 나무 목록 */}
            <div style={{ fontWeight: 800, fontSize: '0.95rem', margin: '0.9rem 0 0.4rem' }}>
              🌳 {sel} 있는 나무 <span style={{ color: '#b9b3a6', fontWeight: 500, fontSize: '0.78rem' }}>{it.count}그루 · 점수순</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[...it.ids]
                .sort((a, b) => (it.scores[b] || 0) - (it.scores[a] || 0))
                .map((id) => {
                  const s = it.scores[id];
                  const nm = labels[`Tree-${id}`]?.name || '';
                  return (
                    <button
                      key={id}
                      onClick={() => onOpenTree?.(`Tree-${id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.2rem',
                        borderTop: '1px solid #f1efe9', background: 'transparent', border: 'none',
                        borderTopStyle: 'solid', cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: pestShade(c, s), flex: '0 0 auto' }} />
                      <span style={{ fontWeight: 700, color: '#3a382f' }}>{id}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{nm}</span>
                      <b style={{ marginLeft: 'auto', color: c }}>{s}점</b>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
