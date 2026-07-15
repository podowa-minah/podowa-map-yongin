// src/components/PestDiseasePanel.jsx
// "병해충" 접는 껍데기 — 개별차트가 안 길어지게. (minari 요구: 입력창 짧게)
//   · 평소엔 접혀서 한 줄(상태 요약). 누르면 펼쳐짐.
//   · 펼치면 [벌레]↔[병] 토글 — 한 번에 하나만 보여서 세로 길이 = "스코어 하나치".
//   · 맨 밑 진단 사진 한 줄 (지금 고른 벌레/병이 태그로 붙음).
//   · 데이터 쓰기: season_data.pests(+bugs 동기화) / season_data.diseases / season_data.diag_photos
//   · ⚠️ bugs = max(벌레점수) 동기화만 유지 — 신호등 알고리즘 불변. 병은 신호등에 안 물림(Phase 1).
import { useState } from 'react';
import PestManager from './PestManager';
import DiseaseManager from './DiseaseManager';
import DiagPhotoStrip from './DiagPhotoStrip';
import { DEFAULT_PESTS, PEST_COLORS, readPests, worstPest, bugsFromPests } from '../lib/pests';
import { DEFAULT_DISEASES, readDiseases, worstDisease } from '../lib/diseases';

function Pill({ name, score }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#fff', border: `1.5px solid ${PEST_COLORS[score]}`, borderRadius: 999,
      padding: '2px 4px 2px 8px',
    }}>
      <span style={{ color: '#3a382f', fontWeight: 500, fontSize: '0.85rem' }}>{name}</span>
      <span style={{
        minWidth: 17, height: 17, lineHeight: '17px', textAlign: 'center',
        borderRadius: 999, background: PEST_COLORS[score], color: '#fff', fontSize: '0.68rem', fontWeight: 700,
      }}>{score}</span>
    </span>
  );
}

export default function PestDiseasePanel({ treeId = 'tree', treeData = {}, setTreeData }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('pest'); // 'pest' | 'disease'
  const [pressed, setPressed] = useState(false); // 기록 버튼 눌림 피드백 (매일 누르는 버튼 — 촉감)

  const season = treeData.season_data || {};
  const pests = readPests(season, treeData.bugs);
  const diseases = readDiseases(season);
  const photos = season.diag_photos || [];

  const wp = worstPest(pests);
  const wd = worstDisease(diseases);
  const clean = !wp && !wd;

  const [pestSel, setPestSel] = useState(() => (wp ? wp.name : DEFAULT_PESTS[0]));
  const [disSel, setDisSel] = useState(() => (wd ? wd.name : DEFAULT_DISEASES[0]));

  const setSeason = (patch) =>
    setTreeData?.((prev) => ({ ...prev, season_data: { ...prev.season_data, ...patch } }));

  const onPestsChange = (next) =>
    setTreeData?.((prev) => ({
      ...prev,
      season_data: { ...prev.season_data, pests: next },
      bugs: String(bugsFromPests(next)),   // 신호등 동기화 (알고리즘 불변)
    }));
  const onDiseasesChange = (next) => setSeason({ diseases: next });
  const onPhotosChange = (next) => setSeason({ diag_photos: next });

  const tabBtn = (active) => ({
    flex: '1 1 0', padding: '0.6rem 0', borderRadius: '0.7rem', cursor: 'pointer',
    border: active ? '3px solid #16a34a' : '2px solid #e2e8f0',
    background: active ? '#f0fdf4' : '#fff',
    color: active ? '#14532d' : '#6b7280',
    fontSize: '1rem', fontWeight: active ? 700 : 500, transition: 'all 0.1s ease',
  });

  return (
    <div style={{ marginBottom: '0.45rem' }}>
      {!open ? (
        /* ── 접힘: 한 줄 ── */
        <button
          onClick={() => setOpen(true)}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
            minHeight: 60,
            padding: '0.55rem 0.6rem 0.55rem 0.85rem', borderRadius: '1rem', cursor: 'pointer', textAlign: 'left',
            border: '2px solid #e7e0f3', background: '#fbfaff',
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1, flex: '0 0 auto' }}>🐛🦠</span>
          <span style={{ color: '#4b5563', fontWeight: 700, flex: '0 0 auto' }}>병해충</span>
          {clean ? (
            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>깨끗해요 ✓</span>
          ) : (
            <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {wp && <Pill name={wp.name} score={wp.score} />}
              {wd && <Pill name={wd.name} score={wd.score} />}
            </span>
          )}
          {photos.length > 0 && (
            <span style={{ color: '#6b7280', fontSize: '0.8rem', flex: '0 0 auto' }}>📸{photos.length}</span>
          )}
          {/* ＋기록 — 매일 누르는 버튼. 통통한 3D(0~5점 버튼과 같은 언어) + 눌림 피드백 */}
          <span style={{
            marginLeft: 'auto', flex: '0 0 auto',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: '#7c3aed', color: '#fff', fontWeight: 800, fontSize: '1.05rem',
            padding: '0.6rem 1rem', borderRadius: '0.8rem',
            transform: pressed ? 'translateY(2px)' : 'none',
            boxShadow: pressed ? '0 1px 0 #5b21b6' : '0 4px 0 #5b21b6',
            transition: 'transform 0.06s ease, box-shadow 0.06s ease',
          }}>
            <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>＋</span>기록
          </span>
        </button>
      ) : (
        /* ── 펼침 ── */
        <div style={{ border: '1.5px solid #ece7db', background: '#fdfcf9', borderRadius: '0.9rem', padding: '0.6rem 0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.05rem', marginRight: '0.35rem' }}>🐛🦠</span>
            <span style={{ color: '#4b5563', fontWeight: 600 }}>병해충</span>
            <button
              onClick={() => setOpen(false)}
              style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#7c3aed', fontWeight: 700, cursor: 'pointer', padding: '0.2rem 0.3rem' }}
            >접기 ▴</button>
          </div>

          {/* 벌레 / 병 토글 */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <button onClick={() => setTab('pest')} style={tabBtn(tab === 'pest')}>🐛 벌레</button>
            <button onClick={() => setTab('disease')} style={tabBtn(tab === 'disease')}>🦠 병</button>
          </div>

          {tab === 'pest' ? (
            <PestManager pests={pests} onChange={onPestsChange} selected={pestSel} onSelect={setPestSel} />
          ) : (
            <DiseaseManager diseases={diseases} onChange={onDiseasesChange} selected={disSel} onSelect={setDisSel} />
          )}

          <DiagPhotoStrip
            photos={photos}
            onChange={onPhotosChange}
            tag={tab === 'pest' ? pestSel : disSel}
            kind={tab}
            treeId={treeId}
          />
        </div>
      )}
    </div>
  );
}
