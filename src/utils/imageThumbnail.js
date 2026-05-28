// src/utils/imageThumbnail.js
// 원본 이미지 파일 → 256×256 정사각형 썸네일 Blob 생성
// (DOM canvas만 씀, React 없음 — utils 위치 적합)
//
// TreeModal / GrassModal 안에 같은 함수가 있음. 향후 점진적으로 이 util로 통합 가능.
// (단, CLAUDE.md 규칙대로 minari가 명시적으로 요청해야 그 둘은 리팩토링 가능)

export function createThumbnail(file, size = 256) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // 중앙 crop (정사각형)
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}
