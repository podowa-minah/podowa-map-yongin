// src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import FarmMap from './FarmMap.jsx';
import TreeModal from './TreeModal.jsx';
import Login from './components/Login.jsx';
import ExportButton from './components/ExportButton.jsx';
import ChangePassword from './components/ChangePassword.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import WeatherDate from './components/WeatherDate.jsx';
import { useLabels } from './LabelContext';
import { supabase } from './supabaseClient';
import './App.css';

import IconLink from './components/IconLink';
import waterlink from './assets/icons/global_water.svg';
import trtlink from './assets/icons/global_trt.svg';

export default function App() {
  const [treeData, setTreeData] = useState({});
  const [selectedTree, setSelectedTree] = useState(null);

  // 안드로이드 뒤로가기 버튼으로 모달 닫기
  useEffect(() => {
    const handlePopState = () => {
      if (selectedTree) {
        setSelectedTree(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedTree]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const { labels } = useLabels();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadAllRows = async () => {
    const { data, error } = await supabase
      .from('trees')
      .select('*')
      .order('date', { ascending: false });

    if (error) { console.error('Error fetching trees:', error); return; }

    const grouped = {};
    data.forEach((row) => { (grouped[row.id] ??= []).push(row); });
    setTreeData(grouped);
    setDataLoading(false);
  };

  useEffect(() => {
    if (!user) return;

    function subscribeRows() {
      return supabase
        .channel('farm-tracker-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trees' },
          ({ eventType, new: row, old }) => {
            setTreeData((prev) => {
              const copy = { ...prev };
              if (eventType === 'DELETE') {
                if (copy[old.id]) {
                  copy[old.id] = copy[old.id].filter((r) => r.date !== old.date);
                  if (copy[old.id].length === 0) delete copy[old.id];
                }
              } else {
                // 같은 id+date 기존 데이터 제거 후 새 데이터 추가
                const existing = copy[row.id] || [];
                copy[row.id] = [row, ...existing.filter((r) => r.date !== row.date)];
              }
              return copy;
            });
          }
        )
        .subscribe();
    }

    loadAllRows();
    const channel = subscribeRows();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTreeData({});
  };

  // 오늘 진행률 계산
  // 분모: 불이 켜진 나무 전체 (오늘 기록 제외 후 판단, 기록없는 나무도 시계불 포함)
  // 분자: 그 중 오늘 입력해서 불 끈 나무
  // greenDots: 불 상관없이 오늘 입력한 나무 수 (별도 표시)
  const { completed, total, greenDots, litTreeIds } = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstToday = kst.toISOString().slice(0, 10);
    const yesterday = new Date(kst.getTime() - 86400000);
    const yStr = yesterday.toISOString().slice(0, 10);

    const ROWS = 25, COLS = 8;
    let doneTrees = 0;
    let litTrees = 0;
    let greenDotCount = 0;
    const litSet = new Set();

    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};
        if (lbl.disabled) continue;

        const records = treeData[numericId] || [];
        const hasTodayRecord = records.some(rec => rec.date === kstToday);
        if (hasTodayRecord) greenDotCount++;

        // 오늘 기록 제외하고 불 켜지는지 판단
        const recsWithoutToday = records.filter(rec => rec.date !== kstToday);
        let anyLightOn = false;

        if (recsWithoutToday.length === 0) {
          // 기록 없음 → 시계불 ON
          anyLightOn = true;
        } else {
          // 나무 아이콘: 어제 세력 1,5 또는 균형 1,2
          const yRec = recsWithoutToday.find(rec => rec.date === yStr);
          if (yRec) {
            const p = String(yRec.power);
            const b = String(yRec.balance);
            if (['1', '5'].includes(p) || ['1', '2'].includes(b)) anyLightOn = true;
          }

          // 벌레 아이콘
          if (!anyLightOn) {
            const bugRec = recsWithoutToday.find(rec => rec.bugs != null && rec.bugs !== '');
            if (bugRec) {
              const bugScore = Number(bugRec.bugs);
              const diffMs = kst.getTime() - new Date(bugRec.date + 'T00:00:00+09:00').getTime();
              const days = Math.floor(diffMs / 86400000);
              if ((bugScore >= 4 && days >= 1) || (bugScore >= 2 && bugScore <= 3 && days >= 3) || (bugScore <= 1 && days >= 4)) {
                anyLightOn = true;
              }
            }
          }

          // 시계 아이콘: 5일간 세력/균형 없으면 (판단불가도 입력으로 인정)
          if (!anyLightOn) {
            const scoreRec = recsWithoutToday.find(rec =>
              (rec.power != null && rec.power !== '') ||
              (rec.balance != null && rec.balance !== '')
            );
            if (scoreRec) {
              const diffMs = kst.getTime() - new Date(scoreRec.date + 'T00:00:00+09:00').getTime();
              if (Math.floor(diffMs / 86400000) >= 5) anyLightOn = true;
            } else {
              anyLightOn = true;
            }
          }
        }

        if (anyLightOn) {
          if (hasTodayRecord) doneTrees++;
          else {
            litSet.add(numericId);
            litTrees++;
          }
        }
      }
    }

    return { completed: doneTrees, total: doneTrees + litTrees, greenDots: greenDotCount, litTreeIds: litSet };
  }, [treeData, labels]);

  if (loading || (user && dataLoading)) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-wrapper">
      <div className="app-container">

        {/* ── 상단 바 + 접히는 메뉴 (sticky 안에 같이) ── */}
        <header className="app-header-bar">
          <div className="header-bar-inner">
            <div className="header-title">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <h1>Podowa App</h1>
                <span className="version">v1.0.1</span>
              </div>
              <WeatherDate />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconLink href="https://example.com/water" src={waterlink} alt="global water" size={38} style={{ marginTop: '1px' }} />
              <IconLink href="https://example.com/trt" src={trtlink} alt="global treatment" size={37} />
              <button
                className="header-toggle-btn"
                onClick={() => setHeaderOpen((v) => !v)}
                aria-label="메뉴 열기/닫기"
              >
                {headerOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {/* ── 접히는 메뉴 ── */}
          {headerOpen && (
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}>
              <ExportButton />
              <span style={{ fontSize: '0.85rem', color: '#666' }}>{user.email}</span>
              <button
                onClick={() => { setShowChangePassword(true); setHeaderOpen(false); }}
                className="change-password-button"
              >
                계정 설정
              </button>
              <button onClick={handleLogout} className="logout-button">
                Logout
              </button>
            </div>
          )}
          <ProgressBar completed={completed} total={total} greenDots={greenDots} treeData={treeData} />
        </header>

        <main className="app-content">
          <FarmMap treeData={treeData} onTreeClick={(id) => { window.history.pushState({ modal: true }, ''); setSelectedTree(id); }} litTreeIds={litTreeIds} />
        </main>

        {selectedTree && (
          <TreeModal treeId={selectedTree} initialData={null} user={user} onClose={() => { if (window.history.state?.modal) window.history.back(); else setSelectedTree(null); setTimeout(loadAllRows, 500); }} />
        )}

        {showChangePassword && (
          <ChangePassword onClose={() => setShowChangePassword(false)} />
        )}
      </div>
    </div>
  );
}