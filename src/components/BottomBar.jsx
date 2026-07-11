// src/components/BottomBar.jsx
// 하단 액션 바 — 잎/관수/방제/보고서/메뉴 (모바일 탭바 스타일)
// 보고서 = 현황분석 페이지로 이동, 미작성 시 빨간 dot 알람

import grasslink from '../assets/icons/grass.svg';
import grapelink from '../assets/icons/grape.svg';

export default function BottomBar({
  activeTab,
  viewMode,
  onToggleMap,
  onOpenIrrigation,
  onOpenPest,
  onOpenAnalysis,
  onOpenMenu,
  hasJournalToday,
  aiFieldUndone,
  signalsComplete,
  irrEval,
  pestEval,
}) {
  return (
    <nav className="action-bar">
      {/* 1: 지도 전환 (잎/포도) */}
      <ActionItem
        icon={
          <img
            src={viewMode === 'farm' ? grasslink : grapelink}
            alt=""
            style={{
              width: 26, height: 26,
              transform: viewMode === 'farm' ? 'none' : 'rotate(22deg)',
            }}
          />
        }
        label={viewMode === 'farm' ? '들풀' : '나무'}
        active={activeTab === 'map'}
        onClick={onToggleMap}
      />

      {/* 2: 관수 */}
      <ActionItem
        icon={<WaterIcon lit={irrEval?.isDue} />}
        label="관수"
        badge={irrEval?.isDue}
        litColor="blue"
        onClick={onOpenIrrigation}
      />

      {/* 3: 방제 */}
      <ActionItem
        icon={<MedicineIcon lit={pestEval?.isDue} />}
        label="방제"
        badge={pestEval?.isDue}
        litColor="amber"
        onClick={onOpenPest}
      />

      {/* 4: 밭상태 진단 보고 (핵심 daily task) */}
      {/* 불: 보고 = 영농일지 저장 + AI 긴급할일 체크. 둘 다 하면 꺼짐.
             신호등(나무 다 기록) 100%는 헤더 '남은' 카운트다운이 따로 보여줌 — 보고 불엔 안 묶음 */}
      {/*   아침 브리핑은 지도 앞 팝업으로 분리됨 — 더 이상 이 불과 안 묶임 */}
      <ActionItem
        icon={<ReportIcon active={activeTab === 'analysis' || !hasJournalToday || aiFieldUndone} />}
        label="보고"
        badge={!hasJournalToday || aiFieldUndone}
        litColor="red"
        active={activeTab === 'analysis'}
        onClick={onOpenAnalysis}
        highlight
      />

      {/* 5: 메뉴 */}
      <ActionItem
        icon={<MenuIcon />}
        label="메뉴"
        onClick={onOpenMenu}
      />
    </nav>
  );
}

function ActionItem({ icon, label, active, badge, onClick, highlight, litColor, blink }) {
  // litColor: 'blue' (관수) | 'amber' (방제) | 'red' (보고서) — badge=true일 때 카드 lit 효과
  const litClass = badge && litColor ? `lit-${litColor}` : '';
  const blinkClass = blink ? 'lit-blink' : '';
  return (
    <button
      className={`action-item ${active ? 'active' : ''} ${highlight ? 'highlight' : ''} ${litClass} ${blinkClass}`}
      onClick={onClick}
    >
      <div className="action-icon-wrap">
        {icon}
      </div>
      <span className="action-label">{label}</span>
    </button>
  );
}

// 작은 SVG 아이콘들 (미니멀, 일관된 스타일)
function WaterIcon({ lit }) {
  const fill = lit ? '#0ea5e9' : '#94a3b8';
  const stroke = lit ? '#0369a1' : '#64748b';
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
      <path d="M20 4 Q9 16 9 26 Q9 33 20 33 Q31 33 31 26 Q31 16 20 4 Z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
      <ellipse cx="15" cy="22" rx="2.5" ry="4" fill="#fff" opacity="0.4" />
    </svg>
  );
}
function MedicineIcon({ lit }) {
  const fill = lit ? '#fbbf24' : '#94a3b8';
  const cap = lit ? '#b45309' : '#475569';
  const stroke = lit ? '#92400e' : '#64748b';
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
      <rect x="13" y="4" width="14" height="6" rx="2" fill={cap}/>
      <rect x="15" y="9" width="10" height="3" fill={cap} opacity="0.8"/>
      <path d="M10 16 Q10 13 14 13 L26 13 Q30 13 30 16 L30 32 Q30 35 27 35 L13 35 Q10 35 10 32 Z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="12" y="18" width="16" height="14" rx="1.5" fill="#fff" opacity="0.85"/>
      <rect x="18.5" y="20" width="3" height="9" rx="0.5" fill={lit ? '#dc2626' : '#94a3b8'}/>
      <rect x="15.5" y="23" width="9" height="3" rx="0.5" fill={lit ? '#dc2626' : '#94a3b8'}/>
    </svg>
  );
}
function ReportIcon({ active }) {
  const main = active ? '#1f2937' : '#475569';
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
      <rect x="8" y="6" width="24" height="28" rx="3" fill="#fff" stroke={main} strokeWidth="1.8"/>
      <line x1="13" y1="14" x2="27" y2="14" stroke={main} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="13" y1="20" x2="27" y2="20" stroke={main} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="13" y1="26" x2="22" y2="26" stroke={main} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
      <line x1="10" y1="14" x2="30" y2="14" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="10" y1="20" x2="30" y2="20" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="10" y1="26" x2="30" y2="26" stroke="#475569" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}
