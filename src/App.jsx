// src/App.jsx
import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import FarmMap from './FarmMap.jsx';
// 첫 화면 로딩 속도 — 무거운 모달/페이지는 열릴 때만 받기 (코드 스플리팅)
const GrassMap = lazy(() => import('./GrassMap.jsx'));
const GrassModal = lazy(() => import('./GrassModal.jsx'));
const TreeModal = lazy(() => import('./TreeModal.jsx'));
import Login from './components/Login.jsx';
const ExportButton = lazy(() => import('./components/ExportButton.jsx'));
const ChangePassword = lazy(() => import('./components/ChangePassword.jsx'));
import ProgressBar from './components/ProgressBar.jsx';
import HeaderHero from './components/HeaderHero.jsx';
const WorkerStatsPopup = lazy(() => import('./components/WorkerStatsPopup.jsx'));
import WeatherDate from './components/WeatherDate.jsx';
const HistoryPopup = lazy(() => import('./components/HistoryPopup.jsx'));
const AnnouncementPopup = lazy(() => import('./components/AnnouncementPopup.jsx'));
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
import farmerSVG from './assets/icons/farmer.svg';
import TreatmentIcons from './components/TreatmentIcons';
import MonthlyManualLine from './components/MonthlyManualLine';
import ManualMissionCard from './components/ManualMissionCard';
const ManualMissionModal = lazy(() => import('./components/ManualMissionModal'));
import usePrevMissionGap from './hooks/usePrevMissionGap';
const IrrigationModal = lazy(() => import('./components/IrrigationModal'));
const PestTreatmentModal = lazy(() => import('./components/PestTreatmentModal'));
import { hasJournalData, isBriefingChecked } from './lib/journal';
import { getFarmDiagnosis, watchReasonText } from './lib/diagnosis';
import { getActiveStreak } from './lib/streak';
import FarmVisitor from './components/FarmVisitor';
import { playCelebration } from './utils/sounds';
import { getMissedDaysNeedingReasons } from './lib/historyStats';
import { loadTreeCache, saveTreeCache, clearTreeCache } from './utils/treeCache';
const IncompleteReasonPopup = lazy(() => import('./components/IncompleteReasonPopup'));
const WorkerDrilldownPopup = lazy(() => import('./components/WorkerDrilldownPopup'));
import { getDominantSeason } from './lib/dailyReport';
import { evaluateCycle } from './lib/treatment-cycles';
import TabNav from './components/TabNav';
const AnalysisPage = lazy(() => import('./AnalysisPage'));
const BriefingPopup = lazy(() => import('./components/BriefingPopup'));
const ScoreReferencePage = lazy(() => import('./ScoreReferencePage'));
const VarietyGuideModal = lazy(() => import('./components/VarietyGuideModal'));
import { monthOfStageName } from './lib/variety-guide';
import { clusterThinningStatus } from './lib/cluster-thinning';

export default function App() {
  const [treeData, setTreeData] = useState({});
  const [freshTreeLoaded, setFreshTreeLoaded] = useState(false);   // 서버 fresh fetch 완료 여부 — lit 깜빡임 방지용
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
  // 로딩 화면을 "맵 데이터가 다 들어올 때까지" 유지 — 안전망 4초(네트워크 느릴 때 무한 스피너 방지)
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    if (!user) return;
    setLoadTimedOut(false);
    const t = setTimeout(() => setLoadTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [user]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showVarietyGuide, setShowVarietyGuide] = useState(false);
  const [varietyGuideMonth, setVarietyGuideMonth] = useState(null);
  const [historySummaries, setHistorySummaries] = useState(null);
  const [latestAnnouncement, setLatestAnnouncement] = useState([]);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [showIrrigation, setShowIrrigation] = useState(false);
  const [showPestTreatment, setShowPestTreatment] = useState(false);
  const [activeTab, setActiveTab] = useState('map');   // 'map' | 'analysis' | 'scores'
  const [previousTab, setPreviousTab] = useState('map');  // X 닫기 시 돌아갈 탭
  const [showLogPopup, setShowLogPopup] = useState(false);
  const [heroCollapsed, setHeroCollapsed] = useState(false);  // 그린 hero 접기/펼치기
  const [irrEval, setIrrEval] = useState(null);
  const [pestEval, setPestEval] = useState(null);
  const [missedDaysNeedingReasons, setMissedDaysNeedingReasons] = useState([]);
  const [showIncompletePopup, setShowIncompletePopup] = useState(false);
  const { gap: missionGap, refresh: refreshMissionGap } = usePrevMissionGap();  // 지난달 미션 미완료 푸쉬
  const [missionModalMonth, setMissionModalMonth] = useState(null);  // 푸쉬 탭으로 열린 미션 모달(그 달) | null
  const [incompleteRefresh, setIncompleteRefresh] = useState(0);
  const [workerDrilldown, setWorkerDrilldown] = useState(null);   // {name, date} | null
  // 영농일지 — Podowa 버튼 클릭 시 열림. 오늘 일지 있으면 불 꺼짐
  // (영농일지 모달 제거됨 — 현황분석 페이지로 통합)
  const [journalHasToday, setJournalHasToday] = useState(false);
  const [briefingCheckedToday, setBriefingCheckedToday] = useState(false);  // 오늘 아침 브리핑 확인 여부
  const [aiTasksToday, setAiTasksToday] = useState([]);   // 오늘 AI 우선순위 할 일(나무) — 맵 보라 강조용
  const [aiFieldUndone, setAiFieldUndone] = useState(false);   // 오늘 밭 AI 할일(좌표X) 미체크 있음 — 보고 불용
  const [briefingLoaded, setBriefingLoaded] = useState(false);       // 오늘 브리핑 확인여부 fetch 완료
  const [showBriefing, setShowBriefing] = useState(false);            // 아침 브리핑 팝업 (지도 앞)
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
    // Supabase는 기본 1000행만 돌려준다 → 나무가 많으면 날짜 내림차순이라 오래된 달(4월 등)이
    // 통째로 잘려서 사진이 안 보였다. 페이지로 끝까지 받아 전부 모은다. (minari: 4월 사진 누락 버그)
    const PAGE = 1000;
    const all = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('trees')
        .select('*')
        .is('archived_at', null)  // 보관된 나무 제외 (백지화된 과거 기록)
        .order('date', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { console.error('Error fetching trees:', error); if (!all.length) return; break; }
      all.push(...(data || []));
      if (!data || data.length < PAGE) break;   // 마지막 페이지
    }

    const grouped = {};
    all.forEach((row) => { (grouped[row.id] ??= []).push(row); });
    setFreshTreeLoaded(true);
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

  // 첫 페인트 후 idle 타임에 자주 쓰는 lazy 모달 미리 받아두기 — 첫 클릭 버벅임 방지
  useEffect(() => {
    if (!user) return;
    const preload = () => {
      import('./components/PestTreatmentModal');
      import('./components/IrrigationModal');
      import('./components/HistoryPopup.jsx');
      import('./components/AnnouncementPopup.jsx');
      import('./AnalysisPage');
      import('./TreeModal.jsx');
    };
    const ric = window.requestIdleCallback;
    const id = ric ? ric(preload, { timeout: 3000 }) : setTimeout(preload, 1500);
    return () => {
      if (ric) cancelIdleCallback?.(id);
      else clearTimeout(id);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // ── stale-while-revalidate ──
    // 1. 캐시 즉시 표시 → 첫 페인트 빠르게 (새로고침/재로그인 시 큰 효과)
    // 2. 백그라운드 fresh fetch가 끝나면 자연스럽게 교체
    const cached = loadTreeCache(user.id);
    if (cached && Object.keys(cached).length > 0) {
      setTreeData(cached);
      setDataLoading(false);  // 화면 렌더 해금
    }

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

  // treeData 변경 시 캐시 저장 (1초 debounce — 연속 realtime 업데이트 묶음)
  useEffect(() => {
    if (!user?.id || dataLoading) return;
    if (Object.keys(treeData).length === 0) return;
    const timer = setTimeout(() => {
      saveTreeCache(user.id, treeData);
    }, 1000);
    return () => clearTimeout(timer);
  }, [treeData, user, dataLoading]);

  const handleLogout = async () => {
    if (user?.id) clearTreeCache(user.id);
    await supabase.auth.signOut();
    setUser(null);
    setTreeData({});
    setFreshTreeLoaded(false);
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

  // 관수/방제 사이클 평가 — BottomBar 알람 컬러용
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [irrRes, pestRes, settingsRes] = await Promise.all([
        supabase.from('daily_notes').select('date').not('irrigation', 'is', null)
          .order('date', { ascending: false }).limit(1),
        supabase.from('daily_notes').select('date').not('pest_treatment', 'is', null)
          .order('date', { ascending: false }).limit(1),
        supabase.from('app_settings').select('key,value')
          .in('key', ['irrigation_cycle_days', 'pest_cycle_days']),
      ]);
      if (!alive) return;
      const settings = Object.fromEntries((settingsRes.data || []).map(r => [r.key, r.value]));
      const irrCycle = parseInt(settings.irrigation_cycle_days) || 3;
      const pestCycle = parseInt(settings.pest_cycle_days) || 7;
      setIrrEval(evaluateCycle(irrRes.data?.[0]?.date || null, irrCycle));
      setPestEval(evaluateCycle(pestRes.data?.[0]?.date || null, pestCycle));
    })();
    return () => { alive = false; };
  }, [user, treatmentRefreshKey]);

  // 미달일 사유 미제출 fetch (최근 30일)
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const today = new Date();
      const kstToday = new Date(today.getTime() + 9 * 3600 * 1000);
      const cutoff = new Date(kstToday.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      const [summariesRes, notesRes] = await Promise.all([
        supabase.from('daily_summaries').select('*').gte('date', cutoff),
        supabase.from('daily_notes').select('date,type,content')
          .eq('type', 'incomplete_reason').gte('date', cutoff),
      ]);
      if (!alive) return;
      const missed = getMissedDaysNeedingReasons(
        summariesRes.data || [],
        notesRes.data || [],
        30,
      );
      setMissedDaysNeedingReasons(missed);
    })();
    return () => { alive = false; };
  }, [user, incompleteRefresh]);

  // 오늘 영농일지 작성 여부 → "Podowa" 버튼 불 상태 결정
  // 한줄평/사진/카테고리(생육/환경/해충) 중 하나라도 있으면 작성됨
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const today = getKSTToday();
      const { data } = await supabase
        .from('daily_notes')
        .select('id,content,image_urls,journal_notes')
        .eq('date', today)
        .eq('type', 'journal')
        .limit(1);
      if (!alive) return;
      setJournalHasToday(hasJournalData(data?.[0]));
      setBriefingCheckedToday(isBriefingChecked(data?.[0]));
      const snap = data?.[0]?.journal_notes?.briefing?.snapshot;
      const tasks = snap?.tasks || [];
      // 저장된 tasks는 {kind:'tree'|'field', treeId, name, label}. 나무 것만 좌표+이유로.
      setAiTasksToday(tasks.filter((t) => t.kind === 'tree' && t.treeId).map((t) => ({ coord: String(t.treeId), action: t.label || '오늘 할 일' })));
      // 밭 AI 할일(좌표 없음) 중 아직 체크 안 한 게 있으면 보고 불 유지(영농일지와 OR)
      const doneKeys = new Set((snap?.doneTasks || []).map((t) => t.key));
      setAiFieldUndone(tasks.some((t) => t.kind === 'field' && !doneKeys.has(t.key)));
      setBriefingLoaded(true);
    })();
    return () => { alive = false; };
  }, [user, journalRefreshKey]);

  // 맵 보라 강조 — AI 1순위 나무 중 "아직 오늘 기록 없는(=안 한)" 것만. 하면 자동으로 빠짐.
  const aiTreesMap = useMemo(() => {
    const today = getKSTToday();
    const out = {};
    for (const t of aiTasksToday) {
      const recs = treeData[t.coord] || [];
      if (!recs.some((r) => r.date === today)) out[t.coord] = t.action || '오늘 할 일';
    }
    return out;
  }, [aiTasksToday, treeData]);

  // 아침 브리핑 팝업 — 나무지도 화면 + 오늘 "아침 업무 시작" 아직 안 함이면 자동으로 뜸.
  //   X로 닫아도 시작(briefingCheckedToday=true) 전엔 지도로 돌아올 때마다 다시 뜬다(필수 보고 강제).
  useEffect(() => {
    if (!user || !briefingLoaded || briefingCheckedToday) return;
    if (activeTab !== 'map' || viewMode !== 'farm') return;
    if (!freshTreeLoaded || Object.keys(treeData || {}).length === 0) return;
    setShowBriefing(true);
  }, [user, briefingLoaded, briefingCheckedToday, activeTab, viewMode, freshTreeLoaded, treeData]);

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
  const { completed, total, greenDots, litTreeIds, doneTreeIds, fakeDoneTreeIds, fakeDoneReasons, fakeDoneCount, todayWorkers, tomorrowTotal, statsReady } = useMemo(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstToday = kst.toISOString().slice(0, 10);

    // 라벨 + treeData(서버 신선 fetch까지) 둘 다 들어왔을 때만 stats 계산
    // 캐시만 있을 땐 label race로 0/0 떴다가 진짜 값으로 점프하는 깜빡임 발생 → 보류
    const activeLabelCount = Object.values(labels || {})
      .filter(l => l && !l.disabled && l.name).length;
    const hasTreeData = Object.keys(treeData || {}).length > 0;
    if (activeLabelCount < 5 || !hasTreeData || !freshTreeLoaded) {
      return {
        completed: null, total: null, greenDots: null,
        litTreeIds: new Set(), doneTreeIds: new Set(), fakeDoneTreeIds: new Set(), fakeDoneReasons: {},
        fakeDoneCount: null, todayWorkers: [], tomorrowTotal: null,
        statsReady: false,
      };
    }

    const ROWS = 25, COLS = 8;
    let doneTrees = 0;
    let litTrees = 0;
    let greenDotCount = 0;
    let fakeDoneTrees = 0;
    const litSet = new Set();
    const doneSet = new Set(); // 불 켜져 있었는데 오늘 입력한 나무
    const fakeDoneSet = new Set(); // 헛돌봄: 입력은 했지만 해당 메트릭 미입력
    const fakeReasons = {};        // 헛돌봄 왜인지 (호버 툴팁용)

    for (let c = 1; c <= COLS; c++) {
      for (let r = 1; r <= ROWS; r++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};
        if (lbl.disabled) continue;
        // 이름 없는 빈 셀은 "나무 자리 아님" — 옛 기록 잔여물에도 헤더 184/47 깜빡임 방지
        if (!lbl.name) continue;

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

            const missed = [];
            if ((signals.powerLevel !== 'off' && !hasPower) ||
                (signals.clockLevel !== 'off' && signals.clockNeedsPower && !hasPower)) missed.push('세력');
            if ((signals.balLevel !== 'off' && !hasBal) ||
                (signals.clockLevel !== 'off' && signals.clockNeedsBal && !hasBal)) missed.push('균형');
            if ((signals.bugLevel !== 'off' && !hasBugs) ||
                (signals.clockLevel !== 'off' && signals.clockNeedsBugs && !hasBugs)) missed.push('방제(해충)');
            let isFake = missed.length > 0;
            // 시계만 켜졌는데 메트릭 이력 자체가 없는 경우 (아무거나라도 입력 필요)
            if (signals.clockLevel !== 'off' &&
                !signals.clockNeedsPower && !signals.clockNeedsBal && !signals.clockNeedsBugs && !hasAnyMetric) {
              isFake = true;
              if (missed.length === 0) missed.push('오늘 상태');
            }

            if (isFake) {
              fakeDoneTrees++;
              fakeDoneSet.add(numericId);
              fakeReasons[numericId] = `헛돌봄 — ${missed.join('·')} 기록을 빠뜨렸어요`;
            }
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
        // 이름 없는 빈 셀은 카운트 안 함 — 옛 기록 잔여로 내일 예상 부풀어 오르는 버그 방지
        // (오늘 통계도 같은 가드 적용됨 - commit cf03c54)
        if (!lbl.name) continue;

        // 내일 기준 이전 기록 = 오늘까지의 기록 (불 켜진 나무는 오늘 입력 가정)
        const records = treeData[numericId] || [];
        const hasToday = records.some(rec => rec.date === kstToday);
        const assumeToday = !hasToday && litSet.has(numericId);
        // ⚠️ 가짜 "오늘 완료" 기록에 실제 값 채워야 evaluateSignals가 사이클 리셋함
        // (빈 문자열이면 evaluateSignals가 이전 값만 보고 신호 안 꺼짐 → 시뮬 부풀어 오름)
        // 각 메트릭 마지막 유효 값을 그대로 사용 (사용자가 같은 패턴으로 입력한다고 가정)
        const sortedRecs = [...records].sort((a, b) => b.date.localeCompare(a.date));
        const lastPower = sortedRecs.find(r => r.power != null && r.power !== '')?.power ?? '3';
        const lastBalance = sortedRecs.find(r => r.balance != null && r.balance !== '')?.balance ?? '3';
        const lastBugs = sortedRecs.find(r => r.bugs != null && r.bugs !== '')?.bugs ?? '0';
        const allRecs = assumeToday
          ? [...records, { date: kstToday, power: lastPower, balance: lastBalance, bugs: lastBugs }]
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
      fakeDoneReasons: fakeReasons,
      fakeDoneCount: fakeDoneTrees,
      todayWorkers,
      tomorrowTotal,
      statsReady: true,
    };
  }, [treeData, labels, freshTreeLoaded]);

  // ── 어제치 daily_summary 자동 저장 (앱 로딩 시) ──
  //   ⚠️ freshTreeLoaded(서버 신선 데이터)까지 기다림 — 캐시/부분 동기화 상태로 저장하면 완료율이 낮게 굳음(버그)
  useEffect(() => {
    if (!user || dataLoading || !freshTreeLoaded || Object.keys(treeData).length === 0) return;

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

      // 라벨 덜 로드된 상태에서 자동저장 돌면 비활성 셀까지 카운트해서 total이 부풀려짐
      // → 활성 라벨 충분히 들어왔는지 가드 (재발 방지)
      const activeLabelCount = Object.values(labels || {})
        .filter(l => l && !l.disabled && l.name).length;
      if (activeLabelCount < 5) return;

      // row 있어도 plan만 있는 (stats=null) 케이스가 있으니 stats 채워줘야 함
      // row 있고 stats도 있으면 skip (덮어쓰지 않음)
      // 단, total이 활성 나무 수의 1.5배보다 크면 (라벨 덜 로드 시점 stale) 자동 덮어씀
      // → plan/excuse/boast/authors는 절대 건드리지 않음
      const { data: existing } = await supabase
        .from('daily_summaries')
        .select('date, total')
        .gte('date', DATA_START);

      const existingMap = new Map((existing || []).map(r => [r.date, r]));
      const STALE_RATIO = 1.5;

      const recentCut = offsetDate(today, -14);   // 최근 14일은 부분 동기화로 굳은 값이 있을 수 있어 항상 재계산(자가 교정)
      for (const d of dates) {
        const existingRow = existingMap.get(d);
        const isRecent = d >= recentCut;
        // 오래된 날: 신뢰 row면 skip(캐시 유지). 단 최근 14일은 항상 재계산해 부분 동기화로 낮게 굳은 값을 교정.
        if (existingRow && existingRow.total != null && !isRecent) {
          const isStale = existingRow.total > activeLabelCount * STALE_RATIO;
          if (!isStale) continue;
        }

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
  }, [user, dataLoading, freshTreeLoaded, treeData, labels]);

  // 현재 포도밭의 생육시기 — 오늘 기록 우선, 없으면 어제 기록
  const currentDominantSeason = useMemo(() => {
    const today = new Date();
    const kstToday = new Date(today.getTime() + 9 * 3600 * 1000);
    const tIso = kstToday.toISOString().slice(0, 10);
    const kstYesterday = new Date(today.getTime() + 9 * 3600 * 1000 - 86400000);
    const yIso = kstYesterday.toISOString().slice(0, 10);
    const todayRecs = [];
    const yRecs = [];
    for (const treeId of Object.keys(treeData || {})) {
      const days = treeData[treeId] || [];
      for (const r of days) {
        if (r.date === tIso) todayRecs.push({ id: treeId, ...r });
        else if (r.date === yIso) yRecs.push({ id: treeId, ...r });
      }
    }
    return getDominantSeason(todayRecs) || getDominantSeason(yRecs) || '';
  }, [treeData]);

  // '현재 착과기' 배지 → 품종별 재배 가이드 열기 (현재 생육단계 → 대표 월로 점프, 없으면 이번 달)
  const openVarietyGuide = () => {
    const calMonth = new Date(Date.now() + 9 * 3600 * 1000).getUTCMonth() + 1;
    setVarietyGuideMonth(monthOfStageName(currentDominantSeason) || calMonth);
    setShowVarietyGuide(true);
  };

  // 유심히 볼 나무(이상치) — id Set + 왜인지 이유(호버 툴팁용). 브리핑과 같은 진단 함수.
  const watchInfo = useMemo(() => {
    const tIso = getKSTToday();
    const diag = getFarmDiagnosis(treeData, labels, tIso);
    const ids = new Set();
    const reasons = {};
    for (const w of (diag.watchTrees || [])) {
      ids.add(w.id);
      reasons[w.id] = (w.reasons || []).join('·');   // 맵 칩용 짧은 이유 (평균↓·급락·세력약)
    }
    return { ids, reasons };
  }, [treeData, labels]);

  // 송이크기정리/알솎이 "최종완료" 집계 — 헤더 진행률(%) + 맵 테두리(노랑/파랑).
  //   올해 기록만(연도 바뀌면 자동 리셋). 전밭 알솎이 100% 되면 테두리 전부 사라짐.
  const clusterThinning = useMemo(() => {
    const year = parseInt(getKSTToday().slice(0, 4), 10);
    return clusterThinningStatus(treeData, labels, year);
  }, [treeData, labels]);

  // 🔥 연속 출근 streak — 헤더 배지
  const streak = useMemo(
    () => getActiveStreak(treeData, getKSTToday(), historySummaries || []),
    [treeData, historySummaries],
  );

  // 🦆 오리 말풍선 — 최신 공지 > 진행률별 기본 멘트
  const _pctNow = total > 0 ? Math.round((completed / total) * 100) : 0;
  // 오늘 진짜 100% = 신호등(나무 다 기록) + 영농일지 저장 + AI 긴급할일 다 함 — 3개 통합
  const signalsComplete = total != null && total > 0 && completed === total;
  const todayFullyDone = signalsComplete && journalHasToday && !aiFieldUndone;
  const duckMessage = useMemo(() => {
    const latest = (prefetchedAnnouncements || []).find(a => !a.deleted);
    if (latest?.message) {
      const text = latest.message.trim().split('\n')[0];
      return text.length > 26 ? text.slice(0, 24) + '…' : text;
    }
    if (todayFullyDone) return '오늘 다 완료! 🎉';
    if (signalsComplete) return '나무 끝! 영농일지·할일만 마무리하면 끝';
    if (_pctNow >= 80)   return '거의 다 왔어요!';
    if (_pctNow >= 50)   return '잘하고 있어요!';
    if (_pctNow >= 20)   return '오늘도 화이팅!';
    if (_pctNow > 0)     return '시작이 반!';
    return '오늘도 화이팅!';
  }, [prefetchedAnnouncements, _pctNow, todayFullyDone, signalsComplete]);

  // 🦆 오리 메시지 빠른 입력
  // - 오리 메시지는 author 앞에 '🦆 ' 마커로 구분
  // - 새 거 올리면 **이전 오리 메시지만** archive (일반 공지는 그대로 둠)
  const DUCK_AUTHOR_PREFIX = '🦆 ';
  const authorNameForDuck = user?.user_metadata?.nickname || (user?.email ? user.email.split('@')[0] : '농부');
  async function handleSubmitDuckMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return false;
    try {
      // 1) 이전 오리 메시지(author '🦆 '로 시작)만 archive
      await supabase
        .from('announcements')
        .update({ deleted: true, pinned: false })
        .eq('deleted', false)
        .like('author', `${DUCK_AUTHOR_PREFIX}%`);
      // 2) 새 오리 메시지 insert (author에 🦆 마커)
      const { error } = await supabase
        .from('announcements')
        .insert({ message: trimmed, author: `${DUCK_AUTHOR_PREFIX}${authorNameForDuck}` });
      if (error) { console.error('duck msg insert:', error); return false; }
      // 3) 재조회
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: false });
      setPrefetchedAnnouncements(data || []);
      return true;
    } catch (e) {
      console.error('duck msg failed:', e);
      return false;
    }
  }

  // 🎊 오늘 진짜 100%(신호등+영농일지+AI) 처음 도달 시 빵빠레
  const prevDoneRef = useRef(todayFullyDone);
  useEffect(() => {
    if (!prevDoneRef.current && todayFullyDone) {
      playCelebration();
    }
    prevDoneRef.current = todayFullyDone;
  }, [todayFullyDone]);

  // 로그인 + 데이터(서버 fresh fetch) 다 들어올 때까지 로딩 스피너 → 그다음 맵.
  //   freshTreeLoaded(서버 신선 데이터) 또는 안전망 타임아웃 전까지 스피너 유지.
  if (loading || (user && (dataLoading || !(freshTreeLoaded || loadTimedOut)))) {
    return (
      <div className="loading-container">
        <img src={farmerSVG} alt="농부" style={{ width: 96, height: 96, marginBottom: 14 }} />
        <div className="loading-spinner"></div>
        <p style={{ marginTop: 22, marginBottom: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.1em', color: '#2f6b3c' }}>PODOWA YONG-IN</p>
        <p style={{ margin: '3px 0 0', fontSize: '0.95rem', fontWeight: 600, color: '#4b5563' }}>포도와 용인</p>
        <p style={{ marginTop: 10 }}>포도밭을 불러오는 중…</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  // statsReady 아니면 pct=null → 헤더가 "0/0" 대신 placeholder 표시
  const pct = !statsReady ? null : (total > 0 ? Math.round((completed / total) * 100) : 0);
  const userName = user?.user_metadata?.nickname || (user?.email ? user.email.split('@')[0] : '');
  const hasRecentAnnouncement = prefetchedAnnouncements?.some(a => !dismissedAt || a.created_at > dismissedAt) || false;

  return (
    <div className="app-wrapper">
      <Suspense fallback={null}>
      <div className="app-container">

        {/* ── 그린 hero (접기 가능 — 맵 더 넓게 보기) ── */}
        <header className={`app-header-bar ${heroCollapsed ? 'collapsed' : ''}`}>
          <HeaderHero
            pct={pct}
            completed={completed}
            total={total}
            userName={userName}
            hasRecentAnnouncement={hasRecentAnnouncement}
            greenDots={greenDots}
            kindDots={greenDots - completed}
            fakeDots={fakeDoneCount}
            missedCount={missedDaysNeedingReasons.length}
            missionGap={missionGap}
            onOpenMission={() => missionGap && setMissionModalMonth(missionGap.month)}
            clusterPct={clusterThinning.clusterPct}
            thinningPct={clusterThinning.thinningPct}
            clusterDone={clusterThinning.clusterDone}
            thinningDone={clusterThinning.thinningDone}
            fieldTotal={clusterThinning.total}
            streak={streak}
            duckMessage={duckMessage}
            onSubmitDuckMessage={handleSubmitDuckMessage}
            onGoAnalysis={() => { setPreviousTab(activeTab); setActiveTab('analysis'); }}
            onFarmerClick={() => setShowLogPopup(true)}
            onAnnouncements={() => setShowAnnouncements(true)}
            onIncompleteReasons={() => setShowIncompletePopup(true)}
          />

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
        </header>

        {/* ── 흰 카드 (헤더 토글 핸들 포함) ── */}
        <div className="info-card-sticky">
          <WeatherDate
            onClick={() => setShowHistory(true)}
            currentSeason={currentDominantSeason}
            onOpenGuide={openVarietyGuide}
          />
          <button
            className="hero-toggle"
            onClick={() => setHeroCollapsed(!heroCollapsed)}
            aria-label={heroCollapsed ? '헤더 펼치기' : '헤더 접기 (맵 더 넓게)'}
          >
            {heroCollapsed ? '▼' : '▲'}
          </button>
        </div>

        {/* ── 이달의 포도 미션 진입 (맵 화면 우하단 플로팅 — 레이아웃 높이 0) ── */}
        {activeTab === 'map' && <ManualMissionCard user={user} />}

        <main className="app-content" style={{ paddingBottom: '92px' }}>
          {activeTab === 'map' && (
            viewMode === 'farm' ? (
              <FarmMap treeData={treeData} onTreeClick={(id) => { window.history.pushState({ modal: true }, ''); setSelectedTree(id); }} litTreeIds={litTreeIds} doneTreeIds={doneTreeIds} fakeDoneTreeIds={fakeDoneTreeIds} fakeDoneReasons={fakeDoneReasons} watchTreeIds={watchInfo.ids} watchReasons={watchInfo.reasons} aiTrees={aiTreesMap} clusterTrimTreeIds={clusterThinning.clusterTrimIds} thinningTreeIds={clusterThinning.thinningIds} onViewportChange={setViewportInfo} freshDataLoaded={freshTreeLoaded} />
            ) : (
              <GrassMap grassRecords={grassRecords} onCellClick={(id) => { window.history.pushState({ modal: true }, ''); setSelectedGrassCell(id); }} />
            )
          )}
          {activeTab === 'analysis' && (
            <AnalysisPage
              treeData={treeData} labels={labels} user={user}
              onOpenIrrigation={() => setShowIrrigation(true)}
              onOpenPest={() => setShowPestTreatment(true)}
              onSaved={() => { setJournalRefreshKey(k => k + 1); setTreatmentRefreshKey(k => k + 1); }}
              onOpenScores={() => setActiveTab('scores')}
              onOpenTree={(id) => { window.history.pushState({ modal: true }, ''); setSelectedTree(id); }}
              onOpenBriefing={() => setShowBriefing(true)}
              onClose={() => setActiveTab(previousTab || 'map')}
            />
          )}
          {activeTab === 'scores' && (
            <ScoreReferencePage />
          )}
        </main>

        <BottomBar
          activeTab={activeTab}
          viewMode={viewMode}
          onToggleMap={() => {
            setActiveTab('map');
            setViewMode(viewMode === 'farm' ? 'grass' : 'farm');
          }}
          onOpenIrrigation={() => setShowIrrigation(true)}
          onOpenPest={() => setShowPestTreatment(true)}
          onOpenAnalysis={() => { setPreviousTab(activeTab); setActiveTab('analysis'); }}
          onOpenMenu={() => setHeaderOpen((v) => !v)}
          hasJournalToday={journalHasToday}
          aiFieldUndone={aiFieldUndone}
          signalsComplete={signalsComplete}
          irrEval={irrEval}
          pestEval={pestEval}
        />

        {/* 아침 브리핑 팝업 — 지도 보기 전 하루 한 번 (확인하면 그날 브리핑이 현황분석에 쌓임) */}
        {showBriefing && (
          <BriefingPopup
            treeData={treeData}
            labels={labels}
            user={user}
            irrEval={irrEval}
            pestEval={pestEval}
            onChecked={() => setJournalRefreshKey((k) => k + 1)}
            onClose={() => setShowBriefing(false)}
            onOpenTree={(id) => {
              setShowBriefing(false);
              window.history.pushState({ modal: true }, '');
              setSelectedTree(id);
            }}
          />
        )}

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

        {showLogPopup && (
          <WorkerStatsPopup
            treeData={treeData}
            onClose={() => setShowLogPopup(false)}
          />
        )}

        {showIncompletePopup && (
          <IncompleteReasonPopup
            missedDays={missedDaysNeedingReasons}
            authorName={authorName}
            onClose={() => setShowIncompletePopup(false)}
            onSubmitted={() => setIncompleteRefresh(k => k + 1)}
          />
        )}

        {/* 지난달 미션 미완료 푸쉬 배너 → 그 달 미션 모달 (닫으면 다시 계산 → 다 채웠으면 배너 사라짐) */}
        {missionModalMonth != null && (
          <ManualMissionModal
            user={user}
            initialMonth={missionModalMonth}
            onClose={() => { setMissionModalMonth(null); refreshMissionGap(); }}
            onSaved={refreshMissionGap}
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

        {showVarietyGuide && (
          <VarietyGuideModal
            user={user}
            initialMonth={varietyGuideMonth}
            treeData={treeData}
            onClose={() => setShowVarietyGuide(false)}
            onOpenTree={(id) => { setShowVarietyGuide(false); window.history.pushState({ modal: true }, ''); setSelectedTree(id); }}
          />
        )}

        {showHistory && (
          <HistoryPopup
            onClose={() => setShowHistory(false)}
            todayStats={{ completed, total, green_dots: greenDots, fake_dots: fakeDoneCount, workers: todayWorkers }}
            tomorrowTotal={tomorrowTotal}
            prefetchedSummaries={historySummaries}
            authorName={authorName}
            onWorkerClick={(name, date) => setWorkerDrilldown({ name, date })}
          />
        )}

        {workerDrilldown && (
          <WorkerDrilldownPopup
            workerName={workerDrilldown.name}
            date={workerDrilldown.date}
            treeData={treeData}
            labels={labels}
            onClose={() => setWorkerDrilldown(null)}
            onTreeClick={(treeId) => {
              setShowHistory(false);
              setWorkerDrilldown(null);
              window.history.pushState({ modal: true }, '');
              setSelectedTree(treeId);
            }}
          />
        )}
      </div>
      </Suspense>

      {/* 🦋🐝 농장 방문자 — 하루 한 번 무작위 시점에 화면 가로지름 */}
      <FarmVisitor />
    </div>
  );
}