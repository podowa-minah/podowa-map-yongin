// src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import FarmMap from './FarmMap.jsx';
import TreeModal from './TreeModal.jsx';
import Login from './components/Login.jsx';
import ExportButton from './components/ExportButton.jsx';
import ChangePassword from './components/ChangePassword.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import { useLabels } from './LabelContext';
import { supabase } from './supabaseClient';
import './App.css';

import IconLink from './components/IconLink';
import waterlink from './assets/icons/global_water.svg';
import trtlink from './assets/icons/global_trt.svg';

export default function App() {
  const [treeData, setTreeData] = useState({});
  const [selectedTree, setSelectedTree] = useState(null);
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

  // 오늘 진행률 계산 (Hook은 조건문 전에 위치해야 함)
  const ROWS = 25, COLS = 8;
  const { completed, total } = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 - now.getTimezoneOffset()) * 60000);
    const kstToday = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(kst.getTime() - 86400000);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    let litTrees = 0;
    let doneTrees = 0;

    // 모든 그리드 셀 순회 (disabled 제외)
    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};
        if (lbl.disabled) continue;

        const records = treeData[numericId] || [];

        // 기록 없는 나무 = 시계 켜짐 = 불 들어옴
        if (!records || records.length === 0) {
          litTrees++;
          continue;
        }

        const hasTodayRecord = records.some(rec => rec.date === kstToday);
        if (hasTodayRecord) {
          doneTrees++;
          litTrees++;
          continue;
        }

        // 불이 켜져있는지 체크
        let anyLightOn = false;

        // 나무 아이콘: 어제 세력 1,5 또는 균형 1,2
        const yRec = records.find(rec => rec.date === yStr);
        if (yRec) {
          const p = String(yRec.power);
          const b = String(yRec.balance);
          if (['1', '5'].includes(p) || ['1', '2'].includes(b)) anyLightOn = true;
        }

        // 벌레 아이콘
        const bugRec = records.find(rec => rec.bugs != null && rec.bugs !== '');
        if (bugRec) {
          const bugScore = Number(bugRec.bugs);
          const diffMs = kst.getTime() - new Date(bugRec.date + 'T00:00:00+09:00').getTime();
          const days = Math.floor(diffMs / 86400000);
          if ((bugScore >= 4 && days >= 1) || (bugScore >= 2 && bugScore <= 3 && days >= 3) || (bugScore <= 1 && days >= 4)) {
            anyLightOn = true;
          }
        }

        // 시계 아이콘: 5일간 세력/균형 없으면
        const scoreRec = records.find(rec =>
          (rec.power != null && rec.power !== '' && rec.power !== '판단불가/지켜봐야함') ||
          (rec.balance != null && rec.balance !== '' && rec.balance !== '판단불가/지켜봐야함')
        );
        if (scoreRec) {
          const diffMs = kst.getTime() - new Date(scoreRec.date + 'T00:00:00+09:00').getTime();
          if (Math.floor(diffMs / 86400000) >= 5) anyLightOn = true;
        } else {
          anyLightOn = true;
        }

        if (anyLightOn) litTrees++;
      }
    }

    return { completed: doneTrees, total: litTrees };
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
              <h1>Podowa App</h1>
              <span className="version">v1.0.1</span>
            </div>
            <button
              className="header-toggle-btn"
              onClick={() => setHeaderOpen((v) => !v)}
              aria-label="메뉴 열기/닫기"
            >
              {headerOpen ? '✕' : '☰'}
            </button>
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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <IconLink href="https://example.com/water" src={waterlink} alt="global water" />
                <IconLink href="https://example.com/trt" src={trtlink} alt="global treatment" />
              </div>
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
        </header>

        <ProgressBar completed={completed} total={total} />

        <main className="app-content">
          <FarmMap treeData={treeData} onTreeClick={setSelectedTree} />
        </main>

        {selectedTree && (
          <TreeModal treeId={selectedTree} initialData={null} user={user} onClose={() => { setSelectedTree(null); loadAllRows(); }} />
        )}

        {showChangePassword && (
          <ChangePassword onClose={() => setShowChangePassword(false)} />
        )}
      </div>
    </div>
  );
}