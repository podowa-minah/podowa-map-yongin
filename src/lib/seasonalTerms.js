// src/lib/seasonalTerms.js
// 24절기 — ISO 날짜 → 그 시점에 해당하는 절기 이름
// 절기 날짜는 매년 1~2일 변동이 있지만, 표준 평균값 사용 (실무용 충분)

// 절기 + 농업 의미
const TERMS = [
  ['01-06', '소한', '한 해 중 가장 추운 무렵 시작'],
  ['01-20', '대한', '한 해 중 가장 큰 추위'],
  ['02-04', '입춘', '봄의 시작'],
  ['02-19', '우수', '봄비 내려 얼음 풀림'],
  ['03-06', '경칩', '겨울잠 깬 동물이 움직임'],
  ['03-21', '춘분', '낮과 밤이 같아짐'],
  ['04-05', '청명', '하늘 맑고 봄 농사 본격 시작'],
  ['04-20', '곡우', '봄비로 곡식 자람'],
  ['05-05', '입하', '여름의 시작, 모내기 준비'],
  ['05-21', '소만', '만물이 가득 차오름'],
  ['06-06', '망종', '보리 베고 모 심는 절기'],
  ['06-21', '하지', '낮이 가장 긴 날'],
  ['07-07', '소서', '본격 더위 시작'],
  ['07-23', '대서', '한 해 가장 더운 무렵'],
  ['08-07', '입추', '가을의 시작'],
  ['08-23', '처서', '더위 한풀 꺾임'],
  ['09-08', '백로', '이슬 맺히기 시작'],
  ['09-23', '추분', '낮과 밤이 같아짐'],
  ['10-08', '한로', '찬 이슬 내림'],
  ['10-23', '상강', '서리 내림'],
  ['11-07', '입동', '겨울의 시작'],
  ['11-22', '소설', '첫눈 내릴 무렵'],
  ['12-07', '대설', '눈이 많이 옴'],
  ['12-22', '동지', '밤이 가장 긴 날'],
];

// ISO 날짜 → 절기 이름만
export function getSeasonalTerm(isoDate) {
  const info = getSeasonalTermInfo(isoDate);
  return info?.name || '';
}

// ISO 날짜 → { name, meaning } 풀 정보
export function getSeasonalTermInfo(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const md = isoDate.slice(5);
  let result = { name: '동지', meaning: '밤이 가장 긴 날' };   // wrap-around
  for (const [date, name, meaning] of TERMS) {
    if (md >= date) result = { name, meaning };
    else break;
  }
  return result;
}
