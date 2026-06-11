// src/utils/supabaseImage.js
// Supabase Storage 공개 URL → 리사이즈(CDN 이미지 변환) URL.
// (Supabase Pro 플랜의 이미지 변환 기능 사용 — render/image 경로)
//
// 왜: 카드처럼 작은 자리에 원본(수 MB)을 그대로 띄우면 무겁다.
//     중간 크기(예: 500px)만 받아오면 가볍고(수십 KB) 또렷하다. 옛 사진에도 바로 적용됨.
//     확대(라이트박스)는 그대로 원본을 쓰면 된다.
//
// 안전: supabase 공개 URL('/object/public/')이 아니면(외부 URL 등) 원본 그대로 반환.

export function resizedImageUrl(url, { width = 500, quality = 60 } = {}) {
  if (!url || typeof url !== 'string') return url;
  const MARKER = '/storage/v1/object/public/';
  const i = url.indexOf(MARKER);
  if (i === -1) return url;  // supabase 공개 URL 아님 → 변환 안 함
  const base = url.slice(0, i);
  const path = url.slice(i + MARKER.length);
  return `${base}/storage/v1/render/image/public/${path}?width=${width}&quality=${quality}`;
}
