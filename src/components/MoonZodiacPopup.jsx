// src/components/MoonZodiacPopup.jsx
// "오늘의 하늘" 상세 팝업 — 달·절기·별자리·자연력 + 포도 농학 의미
// 자연력 = 마리아 툰의 생명역동농업 일자 분류 (불/흙/공기/물 → 열매/뿌리/꽃/잎)
// CLAUDE.md §11: 작은 컴포넌트 = 한 가지 표시

import { DAY_TYPE, FRAMEWORK_NAME } from '../lib/zodiacMoon';
import Constellation from './Constellation';
import DayTypeIcon from './DayTypeIcon';

export default function MoonZodiacPopup({ open, onClose, moon, termInfo, zodiac, dateLabel }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <button onClick={onClose} aria-label="닫기" style={closeBtn}>×</button>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '0.9rem' }}>
          <div style={{ fontSize: '2.6rem', lineHeight: 1 }}>{moon?.emoji || '○'}</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.3rem', letterSpacing: 1 }}>
            오늘의 하늘 {dateLabel ? `· ${dateLabel}` : ''}
          </div>
        </div>

        {/* 4행 깔끔 정보 (무채색) */}
        <div style={infoBox}>
          <Row label="달" value={moon?.name || '–'} />
          <Row label="절기" value={termInfo ? `${termInfo.name} — ${termInfo.meaning}` : '–'} />
          {zodiac && (
            <div style={rowStyle}>
              <div style={rowLabelStyle}>별자리</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, fontSize: '0.92rem', fontWeight: 600, color: '#1f2937' }}>
                <Constellation signName={zodiac.name} size={34} />
                <span>{zodiac.name}</span>
              </div>
            </div>
          )}
          {zodiac && (
            <div style={rowStyle}>
              <div style={rowLabelStyle}>{FRAMEWORK_NAME}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, fontSize: '0.92rem', fontWeight: 600, color: '#1f2937' }}>
                <DayTypeIcon type={zodiac.dayType} size={20} />
                <span>{zodiac.dayLabel}</span>
              </div>
            </div>
          )}
        </div>

        {/* 포도 농학 의미 (무채색 통일) */}
        {zodiac?.grape && (
          <div style={{ ...sectionBox, background: '#f9fafb', borderColor: '#e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.4rem' }}>
              <DayTypeIcon type={zodiac.dayType} size={18} />
              <span>{zodiac.dayLabel} — {zodiac.dayShort}</span>
            </div>
            <div style={{ marginBottom: '0.3rem' }}>
              <span style={tagGood}>👍 좋음</span>
              <span style={{ fontSize: '0.83rem', color: '#374151' }}>
                {zodiac.grape.do.join(' · ')}
              </span>
            </div>
            {zodiac.grape.avoid?.length > 0 && (
              <div>
                <span style={tagAvoid}>🚫 피함</span>
                <span style={{ fontSize: '0.83rem', color: '#374151' }}>
                  {zodiac.grape.avoid.join(' · ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 절기란? — 2~3줄 간단 설명 */}
        {termInfo && (
          <div style={mappingBox}>
            <div style={mappingTitle}>절기란?</div>
            <div style={introText}>
              <b>동아시아 전통 농력</b>. 태양의 위치에 따라 1년을 <b>24개</b>로 나눠
              약 15일마다 계절·기후를 세분화한 거예요. 양력과 거의 일치해서 옛부터 농사 시기의 기준이었어요.
              {termInfo.name && (
                <>
                  <br/>
                  오늘 <b>{termInfo.name}</b>은 "{termInfo.meaning}"는 뜻으로, 이 시기 작물 상태의 표준 기준점이 됩니다.
                </>
              )}
            </div>
          </div>
        )}

        {/* 바이오다이내믹 설명 + 매핑 — 시스템 이해 */}
        <div style={mappingBox}>
          <div style={mappingTitle}>{FRAMEWORK_NAME}란?</div>
          <div style={introText}>
            1924년 <b>루돌프 슈타이너</b>가 정립하고 1960년대 <b>마리아 툰</b>이 달력으로 발전시킨 농법.
            달이 지나가는 <b>별자리의 원소</b>(불·흙·공기·물)에 따라 그날 어울리는 작업이 다르다고 봐요.
            <br/><br/>
            <b>로마네꽁티·샤토네프뒤파프</b> 같은 프리미엄 와이너리도 참고하는 방법.
            과학적 증명은 부족하지만, 농장 전체를 살아있는 생태계로 보고 자연 리듬에 맞춰 일하는 철학이에요.
          </div>

          <div style={{ ...mappingTitle, marginTop: 12 }}>원소 → 일자 (마리아 툰 분류)</div>
          <div style={mappingGrid}>
            <MappingRow label="불"   signs="양·사자·사수"     type="fruit"  resultLabel="열매의 날" />
            <MappingRow label="흙"   signs="황소·처녀·염소"   type="root"   resultLabel="뿌리의 날" />
            <MappingRow label="공기" signs="쌍둥이·천칭·물병" type="flower" resultLabel="꽃의 날" />
            <MappingRow label="물"   signs="게·전갈·물고기"   type="leaf"   resultLabel="잎의 날" />
          </div>
          <div style={{ ...introText, marginTop: 8, color: '#6b7280' }}>
            그 별자리에 달이 들어온 날, <b>해당 식물 부위가 활발해진다</b>고 봐요.
            예) 사수자리(불) = 열매가 강해진다 → 수확·시음에 좋은 날.
          </div>
        </div>

        {/* 솔직 출처 표기 */}
        <div style={discBox}>
          <b>참고용입니다.</b> 별자리 계산은 천문 표준(Tropical Zodiac). 마리아 툰 정통 달력은 Sidereal 기준이라 별자리가 한 단계 다를 수 있어요. 포도 작업 추천은 일반적인 생명역동 농가 관행 기반.
        </div>
      </div>
    </div>
  );
}

// ── 부품 ──
const rowStyle = {
  display: 'flex', alignItems: 'center',
  padding: '0.5rem 0.7rem', borderBottom: '1px dashed #e7d9b8', gap: '0.6rem',
};
const rowLabelStyle = {
  width: '5.6rem', fontSize: '0.75rem', color: '#92845c', fontWeight: 700, flexShrink: 0,
  whiteSpace: 'nowrap',
};

function Row({ label, value }) {
  return (
    <div style={rowStyle}>
      <div style={rowLabelStyle}>{label}</div>
      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1f2937', flex: 1 }}>{value}</div>
    </div>
  );
}

function MappingRow({ label, signs, type, resultLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.78rem', padding: '0.28rem 0', gap: '0.35rem' }}>
      <b style={{ width: '2.4rem', color: '#1f2937' }}>{label}</b>
      <span style={{ color: '#6b7280', flex: 1 }}>({signs})</span>
      <span style={{ color: '#9ca3af' }}>→</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', width: '5.4rem', justifyContent: 'flex-end' }}>
        <DayTypeIcon type={type} size={14} />
        <b style={{ color: '#1f2937' }}>{resultLabel}</b>
      </div>
    </div>
  );
}

// ── 스타일 ──
const backdrop = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200, padding: '1rem',
};
const modal = {
  background: '#fffefb',
  borderRadius: '0.8rem',
  padding: '1.5rem 1.1rem 1.1rem',
  maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  position: 'relative',
};
const closeBtn = {
  position: 'absolute', top: 10, right: 12,
  width: 30, height: 30, borderRadius: '50%',
  border: 'none', background: '#f3f4f6', color: '#4b5563',
  fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1,
};
const infoBox = {
  background: '#fffaed',
  border: '1.5px solid #e7d9b8',
  borderRadius: '0.55rem',
  marginBottom: '0.9rem',
};
const sectionBox = {
  padding: '0.7rem 0.85rem',
  border: '1.5px solid',
  borderRadius: '0.55rem',
  marginBottom: '0.9rem',
};
const tagGood = {
  display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
  color: '#fff', background: '#15803d', padding: '1px 7px',
  borderRadius: '999px', marginRight: 6,
};
const tagAvoid = {
  display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
  color: '#fff', background: '#b45309', padding: '1px 7px',
  borderRadius: '999px', marginRight: 6,
};
const mappingBox = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '0.55rem',
  padding: '0.6rem 0.85rem',
  marginBottom: '0.7rem',
};
const mappingTitle = {
  fontSize: '0.72rem', fontWeight: 700, color: '#6b7280',
  marginBottom: '0.4rem', textTransform: 'none',
};
const introText = {
  fontSize: '0.78rem', color: '#4b5563', lineHeight: 1.6,
  marginBottom: '0.4rem',
};
const mappingGrid = {
  display: 'flex', flexDirection: 'column', gap: '0.1rem',
};
const discBox = {
  fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.5,
  background: '#f9fafb', padding: '0.55rem 0.7rem', borderRadius: '0.4rem',
};
