// src/lib/variety-guide.js
// 품종별 재배 가이드 — 순수 계산 함수 (CLAUDE.md §10 Layer 2)
// DB는 month(1~12)만 저장. 생육단계·색은 저장하지 않고 여기서 계산한다.
// 단계 이름은 grape-stages.js(만개 기준 동적 단계)와 일관되게 맞춤.

// 월 → 생육단계 (백암면 기준 일반 달력 — 품종 가이드용 개요)
//   sc = stage color key (CSS .s-<sc>)
export const MONTH_STAGES = [
  { m: 1,  stage: '휴면기',  ab: '휴면', sc: 'dorm'  },
  { m: 2,  stage: '맹아기',  ab: '맹아', sc: 'bud'   },
  { m: 3,  stage: '맹아기',  ab: '맹아', sc: 'bud'   },
  { m: 4,  stage: '신초생장', ab: '신초', sc: 'bud'  },
  { m: 5,  stage: '개화기',  ab: '개화', sc: 'bloom' },
  { m: 6,  stage: '착과기',  ab: '착과', sc: 'set'   },
  { m: 7,  stage: '경핵기',  ab: '경핵', sc: 'hard'  },
  { m: 8,  stage: '성숙기',  ab: '성숙', sc: 'mat'   },
  { m: 9,  stage: '수확기',  ab: '수확', sc: 'harv'  },
  { m: 10, stage: '수확기',  ab: '수확', sc: 'harv'  },
  { m: 11, stage: '낙엽기',  ab: '낙엽', sc: 'leaf'  },
  { m: 12, stage: '전정기',  ab: '전정', sc: 'prune' },
];

// 단계색 (프로토타입 팔레트와 동일 — La Vigne 참고)
export const STAGE_COLORS = {
  dorm:  '#e7e1d2', bud:  '#d7eccf', bloom: '#f6d4df', set:  '#cfe4c2',
  hard:  '#c4e1b4', mat:  '#e9cf95', harv: '#d6bfe9', leaf: '#ecd1ac', prune: '#d8c3ad',
};

// 송이관리 스펙(cluster_spec jsonb)의 칸 정의 — UI가 이 순서로 그린다
export const CLUSTER_FIELDS = {
  b7:  { group: '개화 7일 전', label: '가이드' },
  s:   { group: '개화 2~3일 전', label: '어깨송이' },
  u:   { group: '개화 2~3일 전', label: '윗지경' },
  t:   { group: '개화 2~3일 전', label: '송이끝단' },
  leaf:{ group: '개화 2~3일 전', label: '잎수' },   // lf1/lf2 합쳐서 표시
  sz:  { group: '착과 후', label: '크기' },
  sa:  { group: '착과 후', label: '어깨송이' },
  ta:  { group: '착과 후', label: '송이끝단' },
};

// month(1~12) → 단계 객체
export function stageOfMonth(month) {
  return MONTH_STAGES.find((s) => s.m === Number(month)) || null;
}

// 단계색 키 → CSS hex
export function colorOfStage(sc) {
  return STAGE_COLORS[sc] || '#e7e1d2';
}

// 단계 이름(예: "착과기 (1차비대기)") → 대표 월. "현재 착과기" 배지 → 밴드 점프용.
export function monthOfStageName(stageName) {
  if (!stageName) return null;
  const hit = MONTH_STAGES.find((s) => stageName.includes(s.stage) || stageName.includes(s.ab));
  return hit ? hit.m : null;
}

// O/X/- 정규화 (송이관리 dot)
export function clusterMark(val) {
  if (val === 'O') return 'O';
  if (val === 'X') return 'X';
  return '-';
}

// variety_guides 배열 → { [variety_id]: { [month]: [entry,...] } }
export function indexGuides(guides) {
  const idx = {};
  for (const g of guides || []) {
    (idx[g.variety_id] ??= {});
    (idx[g.variety_id][g.month] ??= []).push(g);
  }
  for (const v of Object.values(idx))
    for (const m of Object.keys(v))
      v[m].sort((a, b) => a.sort_order - b.sort_order);
  return idx;
}

// ISO timestamp(created_at) → "M/D" (KST). 사진 밑 날짜 도장용.
export function mdLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`;
}

// 한 칸(entries)의 대표 썸네일·영상 여부 — 밴드 셀 표시용
export function cellPreview(entries) {
  if (!entries || !entries.length) return { thumb: null, hasVideo: false, count: 0 };
  let thumb = null;
  for (const e of entries) {
    if (!thumb) thumb = e.thumbnails?.[0] || e.image_urls?.[0] || null;
  }
  return { thumb, hasVideo: entries.some((e) => e.video_url), count: entries.length };
}
