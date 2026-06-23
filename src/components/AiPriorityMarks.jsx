// src/components/AiPriorityMarks.jsx
// 맵 위 "AI 오늘 1순위 나무" 강조 — 타일 전체 보라 + 🤖 AI 배지 + AI 문장 그대로 말풍선.
//   계산 안 함, 받은 것만 그린다(§10 LAYER3 얇은 컴포넌트).
//   aiTrees = { '7-17': '응애 방제', ... } : 좌표 → AI가 쓴 한 줄 작업(그대로 노출, 범주 틀 없음).
//   초록 할일 불은 밑에 깔린 채(보라가 위에서 압도), AI 나무의 주황 "유심히" 칩은
//   FarmMap에서 숨김(겹침 방지) → 이 보라 말풍선 하나만 뜬다.
//   하면 자동으로 빠짐(App이 오늘 기록 들어온 나무를 aiTrees에서 제외).
const PURPLE = '#7c3aed';

export default function AiPriorityMarks({ aiTrees = {}, cellW, cellH, gapX, gapY }) {
  return (
    <>
      {Object.entries(aiTrees).map(([nid, action]) => {
        const [c, r] = String(nid).split('-').map(Number);
        if (!c || !r) return null;
        const x = (c - 1) * (cellW + gapX);
        const y = (r - 1) * (cellH + 10 + gapY);
        const bubbleBelow = r <= 1; // 맨 윗줄이면 말풍선을 아래로(잘림 방지)
        return (
          <div key={`ai-${nid}`} style={{ position: 'absolute', left: x, top: y, width: cellW, height: cellH + 10, pointerEvents: 'none', zIndex: 6 }}>
            {/* 타일 전체 보라 — 거슬리는 테두리·글로우 없이 깔끔한 채움만. AI 신호는 🤖+말풍선이 담당 */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 6,
              background: 'rgba(124,58,237,0.20)',
            }} />
            {/* 🤖 + AI 배지 (좌상단, 흰 알약 + 보라 링 — 어떤 타일 색 위에서도 눈에 띄게) */}
            <span style={{
              position: 'absolute', top: -7, left: -6,
              display: 'inline-flex', alignItems: 'center', gap: 1,
              padding: '1px 3px 1px 2px', lineHeight: 1,
              background: '#fff', borderRadius: 7, border: `1.5px solid ${PURPLE}`,
              boxShadow: '0 1px 3px rgba(124,58,237,0.45)',
            }}>
              <span style={{ fontSize: 10, lineHeight: 1 }}>🤖</span>
              <span style={{ fontSize: 7, fontWeight: 800, color: PURPLE, letterSpacing: '-0.3px' }}>AI</span>
            </span>
            {/* 이유 말풍선 — AI 문장 그대로 (윗줄이면 아래로) */}
            <div style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              [bubbleBelow ? 'top' : 'bottom']: '104%',
              display: 'flex', justifyContent: 'center',
            }}>
              <span style={{
                maxWidth: cellW * 2.3, whiteSpace: 'normal', wordBreak: 'keep-all', textAlign: 'center',
                fontSize: 6.5, lineHeight: '8px', fontWeight: 700,
                background: '#f3eefc', color: '#3c2a6e',
                border: `1px solid ${PURPLE}`, borderRadius: 5, padding: '2px 5px',
                boxShadow: '0 1px 5px rgba(124,58,237,0.28)',
              }}>{action}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}
