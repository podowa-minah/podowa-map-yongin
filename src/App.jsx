// src/App.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import FarmMap from './FarmMap.jsx';
import GrassMap from './GrassMap.jsx';
import GrassModal from './GrassModal.jsx';
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
import { getKSTToday, offsetDate, computeStatsForDate, evaluateSignals } from './utils/dailyStats';
import './App.css';

import IconLink from './components/IconLink';
import waterlink from './assets/icons/global_water_small.png';
import trtlink from './assets/icons/global_trt_small.png';
import grasslink from './assets/icons/grass.svg';
import grapelink from './assets/icons/grape.svg';
import TreatmentIcons from './components/TreatmentIcons';
import MonthlyManualLine from './components/MonthlyManualLine';
import IrrigationModal from './components/IrrigationModal';
import PestTreatmentModal from './components/PestTreatmentModal';
import JournalInputModal from './components/JournalInputModal';

export default function App() {
  const [treeData, setTreeData] = useState({});
  const [selectedTree, setSelectedTree] = useState(null);
  const [viewMode, setViewMode] = useState('farm'); // 'farm' | 'grass'
  const [grassRecords, setGrassRecords] = useState({});
  const [selectedGrassCell, setSelectedGrassCell] = useState(null);

  // 안드로이드 뒤로가기 버튼으로 모달 닫기
  useEffect(() => {
    const handlePopState = () => {
      // GrassModal 내부 팝업들이 pushState한 상태면 무시 (각 팝업이 자체 처리)
      // modal 상태로 되돌아온 경우도 무시 (내부 팝업 닫기로 돌아온 것)
      const s = window.history.state;
      if (s?.grassPopup || s?.grassHistory || s?.grassPreview || s?.modal) return;
      if (selectedGrassCell) {
        setSelectedGrassCell(null);
      } else if (selectedTree) {
        setSelectedTree(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedTree, selectedGrassCell]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySummaries, setHistorySummaries] = useState(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showIrrigation, setShowIrrigation] = useState(false);
  const [showPestTreatment, setShowPestTreatment] = useState(false);
  // 영농일지 — Podowa 버튼 클릭 시 열림. 오늘 일지 있으면 불 꺼짐
  const [showJournal, setShowJournal] = useState(false);
  const [journalHasToday, setJournalHasToday] = useState(false);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const [treatmentRefreshKey, setTreatmentRefreshKey] = useState(0);
  const [prefetchedAnnouncements, setPrefetchedAnnouncements] = useState(null);
  const [viewportInfo, setViewportInfo] = useState(null);
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
      .is('archived_at', null)  // 보관된 나무 제외 (백지화된 과거 기록)
      .order('date', { ascending: false });

    if (error) { console.error('Error fetching trees:', error); return; }

    const grouped = {};
    data.forEach((row) => { (grouped[row.id] ??= []).push(row); });
    setTreeData(grouped);
    setDataLoading(false);
  };

  const loadGrassRecords = async () => {
    const { data, error } = await supabase
      .from('grass_records')
      .select('*')
      .order('date', { ascending: false })
      .order('id', { ascending: false });

    if (error) { console.error('Error fetching grass_records:', error); return; }

    const grouped = {};
    data.forEach((row) => { (grouped[row.tree_id] ??= []).push(row); });
    setGrassRecords(grouped);
  };

  // 특정 셀만 리프레시 (전체 reload 방지)
  const refreshGrassCell = async (treeId) => {
    const { data, error } = await supabase
      .from('grass_records')
      .select('*')
      .eq('tree_id', treeId)
      .order('date', { ascending: false })
      .order('id', { ascending: false });
    if (error) return;
    setGrassRecords(prev => ({ ...prev, [treeId]: data || [] }));
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
              } else if (row.archived_at) {
                // 보관된 row: UI에서 제외 (백지화 동작)
                if (copy[row.id]) {
                  copy[row.id] = copy[row.id].filter((r) => r.date !== row.date);
                  if (copy[row.id].length === 0) delete copy[row.id];
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
    loadGrassRecords();
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

  // 오늘 영농일지 작성 여부 → "Podowa" 버튼 불 상태 결정
  // 텍스트 또는 사진이 있으면 "작성됨" (관수/방제만 입력된 빈 row는 미작성으로 간주)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const today = getKSTToday();
      const { data } = await supabase
        .from('daily_notes')
        .select('id,content,image_urls')
        .eq('date', today)
        .eq('type', 'journal')
        .limit(1);
      if (!alive) return;
      const row = data?.[0];
      const hasContent = !!(row && row.content && row.content.trim().length > 0);
      const hasImages = !!(row && row.image_urls && row.image_urls.length > 0);
      setJournalHasToday(hasContent || hasImages);
    })();
    return () => { alive = false; };
  }, [user, journalRefreshKey]);

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
  const { completed, total, greenDots, litTreeIds, doneTreeIds, fakeDoneTreeIds, fakeDoneCount, todayWorkers, tomorrowTotal } = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstToday = kst.toISOString().slice(0, 10);

    const ROWS = 25, COLS = 8;
    let doneTrees = 0;
    let litTrees = 0;
    let greenDotCount = 0;
    let fakeDoneTrees = 0;
    const litSet = new Set();
    const doneSet = new Set(); // 불 켜져 있었는데 오늘 입력한 나무
    const fakeDoneSet = new Set(); // 헛돌봄: 입력은 했지만 해당 메트릭 미입력

    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};
        if (lbl.disabled) continue;

        const records = treeData[numericId] || [];
        const todayRecords = records.filter(rec => rec.date === kstToday);
        const hasTodayRecord = todayRecords.length > 0;
        if (hasTodayRecord) greenDotCount++;

        // 오늘 기록 제외하고 신호등 판정
        const recsBefore = records.filter(rec => rec.date < kstToday);
        const signals = evaluateSignals(recsBefore, kstToday);

        if (signals.anyOn) {
          if (hasTodayRecord) {
            doneTrees++;
            doneSet.add(numericId);

            // 헛돌봄 판정: 켜진 아이콘의 메트릭이 오늘 입력에 있는지 체크
            const hasPower = todayRecords.some(r => r.power != null && r.power !== '');
            const hasBal = todayRecords.some(r => r.balance != null && r.balance !== '');
            const hasBugs = todayRecords.some(r => r.bugs != null && r.bugs !== undefined && r.bugs !== '');
            const hasAnyMetric = hasPower || hasBal || hasBugs;

            let isFake = false;
            if (signals.powerLevel !== 'off' && !hasPower) isFake = true;
            if (signals.balLevel !== 'off' && !hasBal) isFake = true;
            if (signals.bugLevel !== 'off' && !hasBugs) isFake = true;
            // 시계: 5일+ 된 메트릭을 입력해야 정돌봄
            if (signals.clockLevel !== 'off') {
              if (signals.clockNeedsPower && !hasPower) isFake = true;
              if (signals.clockNeedsBal && !hasBal) isFake = true;
              if (signals.clockNeedsBugs && !hasBugs) isFake = true;
              // 메트릭 이력 자체가 없는 경우 (아무거나라도 입력 필요)
              if (!signals.clockNeedsPower && !signals.clockNeedsBal && !signals.clockNeedsBugs && !hasAnyMetric) isFake = true;
            }

            if (isFake) { fakeDoneTrees++; fakeDoneSet.add(numericId); }
          } else {
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

        const recsBefore = allRecs.filter(rec => rec.date < tomorrowStr);
        const tSignals = evaluateSignals(recsBefore, tomorrowStr);
        if (tSignals.anyOn) tomorrowTotal++;
      }
    }

    return {
      completed: doneTrees,
      total: doneTrees + litTrees,
      greenDots: greenDotCount,
      litTreeIds: litSet,
      doneTreeIds: doneSet,
      fakeDoneTreeIds: fakeDoneSet,
      fakeDoneCount: fakeDoneTrees,
      todayWorkers,
      tomorrowTotal,
    };
  }, [treeData, labels]);

  // ── 어제치 daily_summary 자동 저장 (앱 로딩 시) ──
  useEffect(() => {
    if (!user || dataLoading || Object.keys(treeData).length === 0) return;

    const DATA_START = '2026-04-09';

    async function saveMissingSummaries() {
      const today = getKSTToday();
      // 시작일부터 어제까지 모든 날짜
      const dates = [];
      let d = DATA_START;
      while (d < today) {
        dates.push(d);
        d = offsetDate(d, 1);
      }
      if (dates.length === 0) return;

      // row 있어도 plan만 있는 (stats=null) 케이스가 있으니 stats 채워줘야 함
      // row 있고 stats도 있으면 skip (덮어쓰지 않음)
      // row 없으면 insert
      // → plan/excuse/boast/authors는 절대 건드리지 않음
      const { data: existing } = await supabase
        .from('daily_summaries')
        .select('date, total')
        .gte('date', DATA_START);

      const existingMap = new Map((existing || []).map(r => [r.date, r]));

      for (const d of dates) {
        const existingRow = existingMap.get(d);
        // 이미 stats 채워진 row는 건드리지 않음
        if (existingRow && existingRow.total != null) continue;

        const stats = computeStatsForDate(treeData, labels, d);
        const payload = {
          completed: stats.completed,
          total: stats.total,
          green_dots: stats.green_dots,
          kind_dots: stats.kind_dots,
          fake_dots: stats.fake_dots,
          workers: stats.workers,
        };

        if (existingRow) {
          // plan만 적힌 row → stats만 update, plan/authors는 보존
          await supabase.from('daily_summaries')
            .update(payload)
            .eq('date', d);
        } else {
          // 신규 row
          await supabase.from('daily_summaries')
            .insert({ date: d, ...payload });
        }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Podowa 타이틀 = 영농일지 버튼 (불 켜져있으면 미작성) */}
                <button
                  className={`journal-btn ${journalHasToday ? '' : 'lit'}`}
                  onClick={() => setShowJournal(true)}
                  aria-label="오늘의 영농일지"
                  title={journalHasToday ? '오늘 한 줄 작성됨 — 탭해서 수정' : '✨ 오늘 한 줄 쓰기'}
                >
                  <h1>Podowa</h1>
                </button>
                <span className="version">v1.1.15</span>
              </div>
              <WeatherDate onClick={() => setShowHistory(true)} />
            </div>
            {/* 우측 아이콘 그룹 — 게임 아이템 슬롯 스타일 (RPG 인벤토리) */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', flexShrink: 0, paddingTop: '2px' }}>
              {/* 잎/포도 슬롯 (지도 전환) */}
              <button
                className="item-slot"
                onClick={() => setViewMode(viewMode === 'farm' ? 'grass' : 'farm')}
                aria-label={viewMode === 'farm' ? '잔디 지도로' : '나무 지도로'}
              >
                <img
                  src={viewMode === 'farm' ? grasslink : grapelink}
                  alt=""
                  draggable={false}
                  style={{
                    width: 26, height: 26,
                    transform: viewMode === 'farm' ? 'none' : 'rotate(22deg)',
                    pointerEvents: 'none',
                  }}
                />
              </button>
              <TreatmentIcons
                refreshKey={treatmentRefreshKey}
                onClickIrrigation={() => setShowIrrigation(true)}
                onClickPest={() => setShowPestTreatment(true)}
              />
              {/* 메뉴 슬롯 */}
              <button
                className="item-slot menu"
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
          {/* MonthlyManualLine 임시 숨김 — 디자인 개편 중 */}
          {/* <MonthlyManualLine refreshKey={treatmentRefreshKey} /> */}
          <ProgressBar completed={completed} total={total} greenDots={greenDots} kindDots={greenDots - completed} fakeDots={fakeDoneCount} treeData={treeData} />
        </header>

        <main className="app-content" style={{ paddingBottom: '70px' }}>
          {viewMode === 'farm' ? (
            <FarmMap treeData={treeData} onTreeClick={(id) => { window.history.pushState({ modal: true }, ''); setSelectedTree(id); }} litTreeIds={litTreeIds} doneTreeIds={doneTreeIds} fakeDoneTreeIds={fakeDoneTreeIds} onViewportChange={setViewportInfo} />
          ) : (
            <GrassMap grassRecords={grassRecords} onCellClick={(id) => { window.history.pushState({ modal: true }, ''); setSelectedGrassCell(id); }} />
          )}
        </main>

        <BottomBar
          onAnnouncementClick={() => setShowAnnouncements(true)}
          litTreeIds={litTreeIds}
          pinnedItems={latestAnnouncement}
          viewportInfo={viewportInfo}
          hasRecent={prefetchedAnnouncements?.some(a => a.created_at > dismissedAt) || false}
        />

        {selectedTree && (
          <TreeModal treeId={selectedTree} initialData={null} user={user} onClose={() => { setSelectedTree(null); if (window.history.state?.modal) window.history.back(); setTimeout(loadAllRows, 500); }} onOpenGrass={(grassId) => { setSelectedTree(null); setTimeout(() => setSelectedGrassCell(grassId), 100); }} />
        )}

        {selectedGrassCell && (
          <GrassModal cellId={selectedGrassCell} user={user} onClose={() => { const cellNumId = selectedGrassCell.replace('Grass-', ''); setSelectedGrassCell(null); refreshGrassCell(cellNumId); }} onOpenTree={(treeId) => { setSelectedGrassCell(null); setTimeout(() => setSelectedTree(treeId), 100); }} />
        )}

        {showChangePassword && (
          <ChangePassword onClose={() => setShowChangePassword(false)} />
        )}

        {showIrrigation && (
          <IrrigationModal
            user={user}
            onClose={() => setShowIrrigation(false)}
            onSaved={() => { setShowIrrigation(false); setTreatmentRefreshKey(k => k + 1); }}
          />
        )}

        {showPestTreatment && (
          <PestTreatmentModal
            user={user}
            onClose={() => setShowPestTreatment(false)}
            onSaved={() => { setShowPestTreatment(false); setTreatmentRefreshKey(k => k + 1); }}
          />
        )}

        {showJournal && (
          <JournalInputModal
            user={user}
            onClose={() => setShowJournal(false)}
            onSaved={() => { setJournalHasToday(true); setJournalRefreshKey(k => k + 1); }}
          />
        )}

        {showAnnouncements && (
          <AnnouncementPopup
            onClose={() => setShowAnnouncements(false)}
            authorName={authorName}
            prefetchedItems={prefetchedAnnouncements}
            dismissedAt={dismissedAt}
            onListChange={() => { fetchAllAnnouncements(); fetchPinned(); }}
            onDismiss={(isDismissing) => {
              if (isDismissing) {
                const now = new Date().toISOString();
                localStorage.setItem(`dismissed_at_${authorName}`, now);
                setDismissedAt(now);
              } else {
                localStorage.removeItem(`dismissed_at_${authorName}`);
                setDismissedAt('1970-01-01T00:00:00.000Z');
              }
            }}
          />
        )}

        {showHistory && (
          <HistoryPopup
            onClose={() => setShowHistory(false)}
            todayStats={{ completed, total, green_dots: greenDots, fake_dots: fakeDoneCount, workers: todayWorkers }}
            tomorrowTotal={tomorrowTotal}
            prefetchedSummaries={historySummaries}
            authorName={authorName}
          />
        )}
      </div>
    </div>
  );
}