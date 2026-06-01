// src/components/DayTypeIcon.jsx
// 자연력 일자 타입 — 검정 미니멀 SVG 일러스트
// 열매(포도송이) / 뿌리(잎과 뿌리) / 꽃(5장 꽃잎) / 잎(포도잎 단순화)

export default function DayTypeIcon({ type, size = 18, color = '#1f2937', strokeWidth = 1.1 }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (type === 'fruit') {
    return (
      <svg {...common}>
        {/* 줄기 + 잎 1장 */}
        <path d="M 8 1.2 L 8 3.2" />
        <path d="M 8 2 Q 10 1.5 11 2.8" />
        {/* 포도송이 — 삼각 배치 */}
        <circle cx="6" cy="5.5" r="1.3" fill={color} stroke="none" />
        <circle cx="10" cy="5.5" r="1.3" fill={color} stroke="none" />
        <circle cx="4.7" cy="7.6" r="1.3" fill={color} stroke="none" />
        <circle cx="8" cy="7.6" r="1.3" fill={color} stroke="none" />
        <circle cx="11.3" cy="7.6" r="1.3" fill={color} stroke="none" />
        <circle cx="6" cy="9.7" r="1.3" fill={color} stroke="none" />
        <circle cx="10" cy="9.7" r="1.3" fill={color} stroke="none" />
        <circle cx="8" cy="11.8" r="1.3" fill={color} stroke="none" />
      </svg>
    );
  }
  if (type === 'root') {
    return (
      <svg {...common}>
        {/* 위 잎 두 장 */}
        <path d="M 8 4 Q 6 2.5 4.5 3.5 Q 5 4.5 6.5 4.8 Z" />
        <path d="M 8 4 Q 10 2.5 11.5 3.5 Q 11 4.5 9.5 4.8 Z" />
        {/* 줄기 */}
        <path d="M 8 4 L 8 7" />
        {/* 토양선 */}
        <path d="M 2 8 L 14 8" opacity="0.5" strokeDasharray="0.6 0.8" />
        {/* 뿌리 — 갈라짐 */}
        <path d="M 8 8 L 8 14" />
        <path d="M 8 9.5 Q 5 11 3 13.5" />
        <path d="M 8 9.5 Q 11 11 13 13.5" />
        <path d="M 8 11.5 Q 6.5 13 5.5 14.5" />
        <path d="M 8 11.5 Q 9.5 13 10.5 14.5" />
      </svg>
    );
  }
  if (type === 'flower') {
    return (
      <svg {...common}>
        {/* 5장 꽃잎 — 둘레로 */}
        <ellipse cx="8" cy="3.6" rx="1.8" ry="2.4" />
        <ellipse cx="3.7" cy="6.8" rx="2.4" ry="1.8" transform="rotate(-36 3.7 6.8)" />
        <ellipse cx="12.3" cy="6.8" rx="2.4" ry="1.8" transform="rotate(36 12.3 6.8)" />
        <ellipse cx="5.3" cy="11.6" rx="1.8" ry="2.4" transform="rotate(-72 5.3 11.6)" />
        <ellipse cx="10.7" cy="11.6" rx="1.8" ry="2.4" transform="rotate(72 10.7 11.6)" />
        {/* 중심 */}
        <circle cx="8" cy="8" r="1.4" fill={color} stroke="none" />
      </svg>
    );
  }
  if (type === 'leaf') {
    return (
      <svg {...common}>
        {/* 포도잎 단순화 — 5갈래 형태 */}
        <path d="M 8 14
                 Q 5 13.5 4 11
                 Q 2 10 3 7.5
                 Q 2.5 5 5 4.5
                 Q 6 2 8 2.2
                 Q 10 2 11 4.5
                 Q 13.5 5 13 7.5
                 Q 14 10 12 11
                 Q 11 13.5 8 14 Z" />
        {/* 잎맥 — 5갈래 */}
        <path d="M 8 14 L 8 4" strokeWidth={strokeWidth * 0.7} opacity="0.6" />
        <path d="M 8 8 L 4.5 6.5" strokeWidth={strokeWidth * 0.7} opacity="0.6" />
        <path d="M 8 8 L 11.5 6.5" strokeWidth={strokeWidth * 0.7} opacity="0.6" />
        <path d="M 8 11 L 5.5 11" strokeWidth={strokeWidth * 0.7} opacity="0.6" />
        <path d="M 8 11 L 10.5 11" strokeWidth={strokeWidth * 0.7} opacity="0.6" />
      </svg>
    );
  }
  return null;
}
