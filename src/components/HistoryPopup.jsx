import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getKSTToday, offsetDate, computeStatsForDate, computeTomorrowPrediction } from '../utils/dailyStats';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DATA_START_DATE = '2026-04-09'; // 데이터 시작일

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = WEEKDAYS[dt.getDay()];
  return `${m}/${d} (${wd})`;
}

function GreenDot() {
  return (
    <span style={{
      display: 'inline-block', width: '6px', height: '6px',
      borderRadius: '50%', backgroundColor: '#10b981',
      verticalAlign: 'middle', marginRight: '2px',
    }} />
  );
}

function MiniBar({ pct, incomplete }) {
  return (
    <div style={{
      width: '60px', height: '8px', borderRadius: '4px',
      backgroundColor: '#e2e8f0', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: '4px',
        backgroundColor: pct >= 100 ? '#10b981' : incomplete ? '#f5b942' : pct > 0 ? '#f59e0b' : '#cbd5e1',
        transition: 'width 0.3s',
      }} />
    </div>
  );
}

function DayRow({ label, completed, total, greenDots, workers, isTomorrow, isToday }) {
  const pct = total > 0 ? Math.round(completed / total * 100) : null;
  const isEmpty = total === 0;
  const isIncomplete = !isTomorrow && !isToday && !isEmpty && pct < 100;

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #f0f0f0',
      backgroundColor: isIncomplete ? '#fef9ef' : undefined,
      marginLeft: '-12px', marginRight: '-12px',
      paddingLeft: '12px', paddingRight: '12px',
      borderRadius: isIncomplete ? '8px' : 0,
    }}>
      {/* 첫째 줄: 날짜 + 바 + 퍼센트 + 분자/분모 + 초록점 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: (workers && workers.length > 0) ? '4px' : 0,
      }}>
        <span style={{
          fontSize: '0.85rem', fontWeight: 700,
          color: isTomorrow ? '#7c3aed' : isIncomplete ? '#e09600' : '#2d3748',
          minWidth: '80px', flexShrink: 0,
        }}>
          {isTomorrow && '🔮 '}{isToday && '📍 '}{label}
        </span>

        {isEmpty ? (
          <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>돌볼 나무 없음 🌿</span>
        ) : (
          <>
            <MiniBar pct={isTomorrow ? 0 : (pct || 0)} incomplete={isIncomplete} />
            <span style={{
              fontSize: '0.8rem', fontWeight: 600,
              color: pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : isIncomplete ? '#e09600' : '#a0aec0',
              minWidth: '32px',
            }}>
              {isTomorrow ? '--' : `${pct}%`}
            </span>
            <span style={{ fontSize: '0.75rem', color: isIncomplete ? '#e09600' : '#718096' }}>
              {isTomorrow ? `0/${total}` : `${completed}/${total}`}
            </span>
            {isTomorrow && (
              <span style={{ fontSize: '0.65rem', color: '#7c3aed', fontStyle: 'italic' }}>오늘 완료 가정</span>
            )}
            {greenDots != null && greenDots > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#718096', display: 'flex', alignItems: 'center', gap: '1px' }}>
                <GreenDot />{greenDots}
              </span>
            )}
          </>
        )}
      </div>

      {/* 둘째 줄: 작업자 — 프로그레스바와 같은 위치에서 시작 (날짜 minWidth + gap = 88px) */}
      {workers && workers.length > 0 && (
        <div style={{
          fontSize: '0.72rem', color: '#a0aec0', paddingLeft: '88px',
        }}>
          {workers.map((w, i) => (
            <span key={w.name}>
              {i > 0 && ' · '}👨‍🌾 {w.name} {w.count}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}

const PAGE_SIZE = 30;

export default function HistoryPopup({ onClose, treeData, labels, litTreeIds }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const today = getKSTToday();

  // Supabase에서 과거 summary 불러오기 (최근 30일)
  useEffect(() => {
    async function fetchSummaries() {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .gte('date', DATA_START_DATE)
        .order('date', { ascending: false })
        .limit(PAGE_SIZE);
      if (!error && data) {
        setSummaries(data);
        setHasMore(data.length >= PAGE_SIZE);
      }
      setLoading(false);
    }
    fetchSummaries();
  }, []);

  const loadMore = async () => {
    if (loadingMore || summaries.length === 0) return;
    setLoadingMore(true);
    const oldest = summaries[summaries.length - 1].date;
    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .gte('date', DATA_START_DATE)
      .lt('date', oldest)
      .order('date', { ascending: false })
      .limit(PAGE_SIZE);
    if (!error && data) {
      setSummaries(prev => [...prev, ...data]);
      setHasMore(data.length >= PAGE_SIZE);
    }
    setLoadingMore(false);
  };

  // 내일 예상
  const tomorrow = useMemo(() => {
    if (!treeData || !labels) return null;
    const result = computeTomorrowPrediction(treeData, labels, litTreeIds);
    return { date: offsetDate(today, 1), ...result };
  }, [treeData, labels, litTreeIds, today]);

  // 오늘 통계 (실시간)
  const todayStats = useMemo(() => {
    if (!treeData || !labels) return null;
    return computeStatsForDate(treeData, labels, today);
  }, [treeData, labels, today]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '20px',
          width: '100%',
          maxWidth: '380px',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 타이틀 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '12px',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748' }}>
            📋 작업 히스토리
          </span>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'none', fontSize: '1.2rem',
              cursor: 'pointer', color: '#a0aec0', padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#a0aec0' }}>
            불러오는 중...
          </div>
        ) : (
          <>
            {/* 내일 예상 */}
            {tomorrow && tomorrow.total > 0 && (
              <DayRow
                label={formatDate(tomorrow.date)}
                completed={0}
                total={tomorrow.total}
                isTomorrow
              />
            )}

            {/* 오늘 (실시간) */}
            {todayStats && (
              <DayRow
                label={formatDate(today)}
                completed={todayStats.completed}
                total={todayStats.total}
                greenDots={todayStats.green_dots}
                workers={todayStats.workers}
                isToday
              />
            )}

            {/* 과거 (Supabase) */}
            {summaries
              .filter(s => s.date < today)
              .map(s => (
                <DayRow
                  key={s.date}
                  label={formatDate(s.date)}
                  completed={s.completed}
                  total={s.total}
                  greenDots={s.green_dots}
                  workers={typeof s.workers === 'string' ? JSON.parse(s.workers) : s.workers}
                />
              ))
            }

            {summaries.filter(s => s.date < today).length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#a0aec0', fontSize: '0.8rem' }}>
                과거 기록이 없습니다
              </div>
            )}

            {hasMore && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontSize: '0.8rem',
                    color: '#718096',
                    cursor: loadingMore ? 'wait' : 'pointer',
                  }}
                >
                  {loadingMore ? '불러오는 중...' : '이전 기록 더보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
