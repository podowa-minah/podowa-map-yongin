// src/lib/pest-guide.js
// 벌레/병 간략 지식 — 도감에서 "이게 뭔 벌레인지" 기본만. 밭에서 보는 거라 딱 3~4줄.
//   · 순수 데이터(§10). 우리 밭 사진/점수와 합쳐져서 "배우는 도감"이 됨.
//   · 모르는 이름(직접 추가한 벌레)은 null → UI에서 "설명 준비중"으로.
//   ⚠️ 방제 문구는 "일반적 관리 방향"만 — 구체 약제/농도는 넣지 않음(밭·시기마다 달라서 오해 소지).

export const PEST_GUIDE = {
  깍지: {
    kind: 'pest',
    what: '깍지벌레 — 가지·잎에 붙어 즙을 빨아먹는 벌레. 하얀/갈색 껍질(깍지)을 덮어써서 약이 잘 안 들어감.',
    sign: '가지에 좁쌀 같은 혹, 끈적한 분비물(그을음병 유발), 잎 누렇게.',
    watch: '월동 알 → 부화기(유충)일 때가 방제 급소. 성충되면 껍질 때문에 어려움.',
    care: '유충 시기 집중 관찰 · 가지치기로 밀도 낮추기 · 천적(무당벌레) 보호.',
  },
  응애: {
    kind: 'pest',
    what: '응애 — 아주 작은(0.5mm) 거미붙이. 잎 뒷면에서 즙을 빨아 잎이 하얗게·누렇게 마름. 덥고 건조하면 폭발적으로 번짐.',
    sign: '잎 뒷면 작은 반점, 심하면 거미줄, 잎 전체가 까슬하게 변색.',
    watch: '고온·건조기(한여름) 급증 → 초기에 잡아야. 며칠 새 밭 전체로 번짐.',
    care: '잎 뒷면 자주 확인 · 먼지·건조 피하기 · 발생 시 빠르게 대응.',
  },
  총채: {
    kind: 'pest',
    what: '총채벌레 — 가늘고 작은 벌레. 꽃·어린잎·과실 표면을 긁어 즙을 빨아 상처를 냄. 바이러스도 옮김.',
    sign: '잎·과실에 은백색 긁힌 자국, 검은 배설물 점, 기형과.',
    watch: '개화기~착과기 피해 큼. 꽃 안에 숨어 있어 놓치기 쉬움.',
    care: '꽃·신초 예찰 · 끈끈이(파랑/노랑)로 밀도 확인 · 주변 잡초 관리.',
  },
  개각충: {
    kind: 'pest',
    what: '개각충 — 깍지벌레류의 하나. 단단한 껍질을 쓰고 가지에 고착해 즙을 빨아먹음.',
    sign: '가지·잎에 볼록한 껍질, 끈적임과 그을음병.',
    watch: '유충(이동기)일 때가 방제 급소 · 껍질 생기면 어려움.',
    care: '깍지벌레에 준함 — 유충기 관찰 · 가지 밀도 관리.',
  },
  흰가루병: {
    kind: 'disease',
    what: '흰가루병 — 잎·과실 표면에 밀가루 뿌린 듯 하얀 곰팡이. 통풍 나쁘고 습하면 잘 생김.',
    sign: '잎·과실에 흰 가루, 심하면 잎 오그라들고 과실 갈라짐.',
    watch: '신초·과실 표면 관찰 · 밀식·과번무하면 심해짐.',
    care: '통풍 좋게(가지·잎 정리) · 초기 발견 시 빠르게 · 이병 부위 제거.',
  },
  노균병: {
    kind: 'disease',
    what: '노균병 — 잎 앞면 누런 반점, 뒷면에 하얀 곰팡이. 비 많고 습할 때 급속히 번짐.',
    sign: '잎 앞면 기름진 듯한 황색 반점, 뒷면 흰~회색 곰팡이, 낙엽.',
    watch: '장마·다습기 폭발 · 잎 뒷면 확인.',
    care: '배수·통풍 관리 · 이병엽 제거 · 예방 위주 관리.',
  },
  잿빛곰팡이병: {
    kind: 'disease',
    what: '잿빛곰팡이병 — 꽃·과실에 회색 곰팡이가 피며 무르고 썩음. 저온다습에 잘 생김.',
    sign: '꽃·송이에 회갈색 곰팡이, 과실 물러 썩음.',
    watch: '개화기·수확기 다습할 때 · 상처난 과실로 침입.',
    care: '통풍·습도 관리 · 상처·병든 송이 빨리 제거.',
  },
};

// app_settings.pest_guide 값(문자열/객체) → 수정본 객체. 깨져도 안전하게 {}.
export function readGuideOverrides(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}

// 기본 지식 + 관리자 수정본 병합. 수정본이 있으면 그 칸만 덮어씀.
//   overrides = { 응애: { what, sign, watch, care }, ... }  (빈 칸은 기본값 유지)
export function guideFor(name, overrides = {}) {
  const base = PEST_GUIDE[name] || null;
  const ov = overrides?.[name];
  if (!base && !ov) return null;
  const kind = base?.kind || ov?.kind || 'pest';
  const pick = (k) => (ov && ov[k] != null && ov[k] !== '' ? ov[k] : base?.[k] || '');
  return { kind, what: pick('what'), sign: pick('sign'), watch: pick('watch'), care: pick('care') };
}

// 편집 폼 초기값 — 지금 보이는 값(기본+수정본 병합) 그대로
export function guideFields() {
  return [
    ['what', '어떤 벌레/병인지'],
    ['sign', '🔎 증상'],
    ['watch', '⏰ 급소 (언제 봐야)'],
    ['care', '🌿 관리 방향'],
  ];
}
