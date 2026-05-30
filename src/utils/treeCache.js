// src/utils/treeCache.js
// localStorage 캐시 — 새로고침 시 첫 페인트 속도 개선
// stale-while-revalidate 패턴: 캐시 즉시 표시 → 백그라운드 fresh fetch → 교체
//
// 스키마 바뀌면 CACHE_VERSION 올리기 (옛 캐시 자동 무시)

const CACHE_VERSION = 'v1';
const cacheKey = (userId) => `podowa_treeData_${CACHE_VERSION}_${userId}`;

export function loadTreeCache(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch (err) {
    console.warn('[treeCache] load failed:', err);
    return null;
  }
}

export function saveTreeCache(userId, treeData) {
  if (!userId || !treeData) return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(treeData));
  } catch (err) {
    // QuotaExceeded 등 — 캐시는 옵션이라 조용히 무시
    console.warn('[treeCache] save failed:', err);
  }
}

export function clearTreeCache(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(cacheKey(userId));
  } catch (err) {
    // ignore
  }
}
