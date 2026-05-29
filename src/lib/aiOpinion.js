// src/lib/aiOpinion.js
// 룰 기반 자동 의견 생성 — 데이터 패턴 → 한국어 요약 문장
// CLAUDE.md 섹션 10: 순수 계산 함수 (DB 호출 / React 없음)
//
// 출력 구조:
//   [
//     { type: 'today',       label: '오늘',     text: '...' },
//     { type: 'trend',       label: '7일 추이', text: '...' },
//     { type: 'preceding',   label: '선행지표', text: '...' }, // 신호등/사이클 기반
//     { type: 'attention',   label: '주의',     text: '...' }, // 발견된 이슈
//   ]

import { avgScore, scoreBand } from './scoring';

// 메인 — 자동 의견 묶음 생성
//   report: buildDailyReport 결과
//   trends: { todayScore, avgScore7d, deltaScore }
//   triggers: 신호등 ON 그루 수 등
export function generateOpinions({ report, trends, triggers, dailyNote }) {
  const opinions = [];

  // 1. 오늘 의견
  if (report && report.records.length > 0) {
    const score = report.totalScore;
    const band = scoreBand(score);
    const parts = [];
    parts.push(`${report.records.length}그루 기록 (작업자 ${report.workerCount}명)`);
    if (score != null) parts.push(`전체 평균 ${score.toFixed(1)}점 (${band.label})`);
    if (report.bloomCount > 0) parts.push(`만개 ${report.bloomCount}건`);
    if (report.partialTreatmentCount > 0) parts.push(`부분방제 ${report.partialTreatmentCount}그루`);
    opinions.push({ type: 'today', label: '오늘', text: parts.join(', ') });
  } else {
    opinions.push({ type: 'today', label: '오늘', text: '오늘 기록된 나무가 없어요.' });
  }

  // 2. 7일 추이
  if (trends) {
    const parts = [];
    if (trends.delta != null && Math.abs(trends.delta) >= 0.1) {
      const arrow = trends.delta > 0 ? '↑' : '↓';
      parts.push(`평균 점수 ${arrow} ${Math.abs(trends.delta).toFixed(1)} (7일 대비)`);
    }
    if (trends.powerDelta != null && Math.abs(trends.powerDelta) >= 0.1) {
      const arrow = trends.powerDelta > 0 ? '↑' : '↓';
      parts.push(`세력 ${arrow} ${Math.abs(trends.powerDelta).toFixed(1)}`);
    }
    if (trends.bugsDelta != null && Math.abs(trends.bugsDelta) >= 0.1) {
      const arrow = trends.bugsDelta > 0 ? '↑' : '↓';   // 해충 ↑ = 나쁜 신호
      parts.push(`해충 ${arrow} ${Math.abs(trends.bugsDelta).toFixed(1)}`);
    }
    if (parts.length > 0) {
      opinions.push({ type: 'trend', label: '7일 추이', text: parts.join(', ') });
    }
  }

  // 3. 선행지표 (신호등 / 사이클)
  if (triggers) {
    const parts = [];
    if (triggers.litCount > 0) parts.push(`신호등 ON ${triggers.litCount}그루`);
    if (triggers.overdueIrrigation) parts.push('관수 간격 도래');
    if (triggers.overduePest) parts.push('방제 간격 도래');
    if (parts.length > 0) {
      opinions.push({ type: 'preceding', label: '선행지표', text: parts.join(', ') });
    }
  }

  // 4. 주의 (특이 이슈)
  if (report) {
    const warns = [];
    if (report.bugDetectedCount >= 3) {
      warns.push(`해충 ${report.bugDetectedCount}그루 발견 — 확산 주의`);
    }
    if (report.metrics?.bugs != null && report.metrics.bugs >= 2.5) {
      warns.push('평균 해충 지수 높음');
    }
    if (report.metrics?.power != null && report.metrics.power < 2.5) {
      warns.push('전체 세력 약함 — 관리 강화');
    }
    if (warns.length > 0) {
      opinions.push({ type: 'attention', label: '주의', text: warns.join(' · ') });
    }
  }

  return opinions;
}
