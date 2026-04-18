// src/App.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import FarmMap from './FarmMap.jsx';
import TreeModal from './TreeModal.jsx';
import Login from './components/Login.jsx';
import ExportButton from './components/ExportButton.jsx';
import ChangePassword from './components/ChangePassword.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import WeatherDate from './components/WeatherDate.jsx';
import HistoryPopup from './components/HistoryPopup.jsx';
import AnnouncementPopup from './components/AnnouncementPopup.jsx';
import BottomBar from './components/BottomBar.jsx';
import { useLabels } from './LabelContext';
import { supabase } from './supabaseClient';
import { getKSTToday, offsetDate, computeStatsForDate } from './utils/dailyStats';
import './App.css';

import IconLink from './components/IconLink';
import waterlink from './assets/icons/global_water_small.png';
import trtlink from './assets/icons/global_trt_small.png';
import grasslink from './assets/icons/grass.svg';

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
  const [showHistory, setShowHistory] = useState(false);
  const [historySummaries, setHistorySummaries] = useState(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [prefetchedAnnouncements, setPrefetchedAnnouncements] = useState(null);
  const [viewportInfo, setViewportInfo] = useState(null);
  const [lastSeenAt, setLastSeenAt] = useState(() => new Date().toISOString());
  const [dismissedAt, setDismissedAt] = useState('1970-01-01T00:00:00.000Z');
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

  // ── 공지사항 프리페치 + 핀 fetch + 실시간 구독 ──
  const fetchPinned = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('pinned', true)
      .eq('deleted', false)
      .order('created_at', { ascending: false });
    setLatestAnnouncement(data || []);
  };

  const fetchAllAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setPrefetchedAnnouncements(data);
  };

  useEffect(() => {
    if (!user) return;

    fetchPinned();
    fetchAllAnnouncements();

    const channel = supabase
      .channel('announcements-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' },
        () => { fetchPinned(); fetchAllAnnouncements(); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const authorName = user?.user_metadata?.nickname || user?.email || '';

  // authorName 확정 후 localStorage에서 dismissed_at 로드
  useEffect(() => {
    if (authorName) {
      const stored = localStorage.getItem(`dismissed_at_${authorName}`);
      if (stored) setDismissedAt(stored);
    }
  }, [authorName]);

  // 오늘 진행률 계산
  // 분모: 불이 켜진 나무 전체 (오늘 기록 제외 후 판단, 기록없는 나무도 시계불 포함)
  // 분자: 그 중 오늘 입력해서 불 끈 나무
  // greenDots: 불 상관없이 오늘 입력한 나무 수 (별도 표시)
  const { completed, total, greenDots, litTreeIds, doneTreeIds, todayWorkers, tomorrowTotal } = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstToday = kst.toISOString().slice(0, 10);
    const yesterday = new Date(kst.getTime() - 86400000);
    const yStr = yesterday.toISOString().slice(0, 10);

    // 한국 달력 날짜 기준 경과일 계산 (시간 무시, FarmMap과 통일)
    const [ty, tm, td] = kstToday.split('-').map(Number);
    const todayDateObj = new Date(ty, tm - 1, td);
    const daysSinceKST = (isoDate) => {
      const [y, m, d] = isoDate.split('-').map(Number);
      return (todayDateObj - new Date(y, m - 1, d)) / 86400000;
    };

    const ROWS = 25, COLS = 8;
    let doneTrees = 0;
    let litTrees = 0;
    let greenDotCount = 0;
    const litSet = new Set();
    const doneSet = new Set(); // 불 켜져 있었는데 오늘 입력한 나무 (보라점용)

    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};
        if (lbl.disabled) continue;

        const records = treeData[numericId] || [];
        const hasTodayRecord = records.some(rec => rec.date === kstToday);
        if (hasTodayRecord) greenDotCount++;

        // 오늘 기록 제외, 최신순 정렬 (find()가 최신 기록 먼저 찾도록)
        const recsWithoutToday = records
          .filter(rec => rec.date !== kstToday)
          .sort((a, b) => b.date.localeCompare(a.date));
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
              const days = daysSinceKST(bugRec.date);
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
              if (daysSinceKST(scoreRec.date) >= 5) anyLightOn = true;
            } else {
              anyLightOn = true;
            }
          }
        }

        if (anyLightOn) {
          if (hasTodayRecord) { doneTrees++; doneSet.add(numericId); }
          else {
            litSet.add(numericId);
            litTrees++;
          }
        }
      }
    }

    // 오늘 작업자 통계
    const workerCounts = {};
    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const numericId = `${c}-${r}`;
        const records = treeData[numericId] || [];
        records.forEach(rec => {
          if (rec.date === kstToday && rec.producer) {
            workerCounts[rec.producer] = (workerCounts[rec.producer] || 0) + 1;
          }
        });
      }
    }
    const todayWorkers = Object.entries(workerCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // 내일 예상 (오늘 불 켜진 나무 전부 입력했다고 가정)
    const tomorrowStr = offsetDate(kstToday, 1);
    const [tty, ttm, ttd] = tomorrowStr.split('-').map(Number);
    const tomorrowDateObj = new Date(tty, ttm - 1, ttd);
    const daysSinceTomorrow = (isoDate) => {
      const [y2, m2, d2] = isoDate.split('-').map(Number);
      return (tomorrowDateObj - new Date(y2, m2 - 1, d2)) / 86400000;
    };
    const tomorrowYStr = kstToday; // 내일 기준 어제 = 오늘

    let tomorrowTotal = 0;
    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};
        if (lbl.disabled) continue;

        // 내일 기준 이전 기록 = 오늘까지의 기록 (불 켜진 나무는 오늘 입력 가정)
        const records = treeData[numericId] || [];
        const hasToday = records.some(rec => rec.date === kstToday);
        const assumeToday = !hasToday && litSet.has(numericId);
        const allRecs = assumeToday
          ? [...records, { date: kstToday, power: '', balance: '', bugs: '' }]
          : records;

        const recsBefore = allRecs
          .filter(rec => rec.date < tomorrowStr)
          .sort((a, b) => b.date.localeCompare(a.date));

        let anyLight = false;
        if (recsBefore.length === 0) {
          anyLight = true;
        } else {
          const yRec = recsBefore.find(rec => rec.date === tomorrowYStr);
          if (yRec) {
            const p = String(yRec.power);
            const b = String(yRec.balance);
            if (['1', '5'].includes(p) || ['1', '2'].includes(b)) anyLight = true;
          }
          if (!anyLight) {
            const bugRec = recsBefore.find(rec => rec.bugs != null && rec.bugs !== '');
            if (bugRec) {
              const score = Number(bugRec.bugs);
              const days = daysSinceTomorrow(bugRec.date);
              if ((score >= 4 && days >= 1) || (score >= 2 && score <= 3 && days >= 3) || (score <= 1 && days >= 4)) {
                anyLight = true;
              }
            }
          }
          if (!anyLight) {
            const scoreRec = recsBefore.find(rec =>
              (rec.power != null && rec.power !== '') ||
              (rec.balance != null && rec.balance !== '')
            );
            if (scoreRec) {
              if (daysSinceTomorrow(scoreRec.date) >= 5) anyLight = true;
            } else {
              anyLight = true;
            }
          }
        }
        if (anyLight) tomorrowTotal++;
      }
    }

    return {
      completed: doneTrees,
      total: doneTrees + litTrees,
      greenDots: greenDotCount,
      litTreeIds: litSet,
      doneTreeIds: doneSet,
      todayWorkers,
      tomorrowTotal,
    };
  }, [treeData, labels]);

  // ── 어제치 daily_summary 자동 저장 (앱 로딩 시) ──
  useEffect(() => {
    if (!user || dataLoading || Object.keys(treeData).length === 0) return;

    async function saveMissingSummaries() {
      const today = getKSTToday();
      const DATA_START = '2026-04-09';
      // 시작일부터 어제까지 모든 날짜
      const dates = [];
      let d = DATA_START;
      while (d < today) {
        dates.push(d);
        d = offsetDate(d, 1);
      }
      if (dates.length === 0) return;

      const { data: existing } = await supabase
        .from('daily_summaries')
        .select('date')
        .gte('date', DATA_START);

      const existingDates = new Set((existing || []).map(r => r.date));
      const missing = dates.filter(d => !existingDates.has(d));

      for (const d of missing) {
        const stats = computeStatsForDate(treeData, labels, d);
        await supabase.from('daily_summaries').upsert({
          date: d,
          completed: stats.completed,
          total: stats.total,
          green_dots: stats.green_dots,
          kind_dots: stats.kind_dots,
          workers: stats.workers,
        });
      }
    }

    saveMissingSummaries().then(() => {
      // 자동저장 완료 후 히스토리 데이터 미리 fetch
      supabase
        .from('daily_summaries')
        .select('*')
        .gte('date', DATA_START)
        .order('date', { ascending: false })
        .limit(30)
        .then(({ data }) => {
          if (data) setHistorySummaries(data);
        });
    });
  }, [user, dataLoading, treeData, labels]);

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
                <h1>Podowa</h1>
                <span className="version">v1.0.4</span>
              </div>
              <WeatherDate onClick={() => setShowHistory(true)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <IconLink href="#" src={grasslink} alt="grass map" size={38} onClick={(e) => { e.preventDefault(); alert('풀 지도 준비 중!'); }} />
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
          <ProgressBar completed={completed} total={total} greenDots={greenDots} kindDots={greenDots - completed} treeData={treeData} />
        </header>

        <main className="app-content" style={{ paddingBottom: '70px' }}>
          <FarmMap treeData={treeData} onTreeClick={(id) => { window.history.pushState({ modal: true }, ''); setSelectedTree(id); }} litTreeIds={litTreeIds} doneTreeIds={doneTreeIds} onViewportChange={setViewportInfo} />
        </main>

        <BottomBar
          onAnnouncementClick={() => { setLastSeenAt(new Date().toISOString()); setShowAnnouncements(true); }}
          litTreeIds={litTreeIds}
          pinnedItems={latestAnnouncement}
          viewportInfo={viewportInfo}
          hasUnseen={prefetchedAnnouncements?.some(a => a.created_at > lastSeenAt) || false}
          hasRecent={prefetchedAnnouncements?.some(a => a.created_at > dismissedAt) || false}
        />

        {selectedTree && (
          <TreeModal treeId={selectedTree} initialData={null} user={user} onClose={() => { if (window.history.state?.modal) window.history.back(); else setSelectedTree(null); setTimeout(loadAllRows, 500); }} />
        )}

        {showChangePassword && (
          <ChangePassword onClose={() => setShowChangePassword(false)} />
        )}

        {showAnnouncements && (
          <AnnouncementPopup
            onClose={() => setShowAnnouncements(false)}
            authorName={authorName}
            prefetchedItems={prefetchedAnnouncements}
            dismissedAt={dismissedAt}
            onListChange={() => { fetchAllAnnouncements(); fetchPinned(); }}
            onDismiss={() => {
              const now = new Date().toISOString();
              localStorage.setItem(`dismissed_at_${authorName}`, now);
              setDismissedAt(now);
            }}
          />
        )}

        {showHistory && (
          <HistoryPopup
            onClose={() => setShowHistory(false)}
            todayStats={{ completed, total, green_dots: greenDots, workers: todayWorkers }}
            tomorrowTotal={tomorrowTotal}
            prefetchedSummaries={historySummaries}
          />
        )}
      </div>
    </div>
  );
}