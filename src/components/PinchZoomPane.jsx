// src/components/PinchZoomPane.jsx
// 손가락 핀치줌 + 끌어서 이동 캔버스 — FarmMap의 줌 방식을 그대로 따른 재사용 부품.
// 앱 전역이 user-scalable=no 라서 핀치줌이 필요한 곳은 각자 구현해야 한다(맵과 동일).
// - children 을 transform(translate+scale) 으로 키우고, viewport(overflow:hidden) 안에서 이동.
// - 두 손가락: 확대/축소(가운데 기준) · 한 손가락/마우스: 끌어서 이동 · 휠: 확대/축소.
// - 끌고 난 직후의 클릭은 삼켜서(드래그=클릭 오작동 방지) 칸 탭과 충돌하지 않게 한다.

import { useRef, useEffect, useCallback } from 'react';

export default function PinchZoomPane({
  children,
  height = '62vh',
  minScale = 1,
  maxScale = 5,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);   // viewport (고정 높이 · overflow hidden)
  const contentRef = useRef(null);     // 실제로 커지는 안쪽 (transform 대상)
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const lastDistRef = useRef(null);
  const draggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const pointerStart = useRef({ x: 0, y: 0 });
  const wasDragRef = useRef(false);

  const apply = useCallback(() => {
    const c = containerRef.current, g = contentRef.current;
    if (!c || !g) return;
    const s = scaleRef.current;
    const p = posRef.current;
    const cw = c.clientWidth, ch = c.clientHeight;
    const sw = g.offsetWidth * s, sh = g.offsetHeight * s;
    // 콘텐츠가 화면 밖으로 완전히 사라지지 않게 약간의 여백만 허용
    const mX = cw * 0.2, mY = ch * 0.2;
    p.x = Math.max(Math.min(mX, p.x), -sw + cw - mX);
    p.y = Math.max(Math.min(mY, p.y), -sh + ch - mY);
    posRef.current = p;
    g.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
  }, []);

  // 초기 정렬 (좌상단 · 배율 1) + 리사이즈 대응
  useEffect(() => {
    scaleRef.current = Math.max(minScale, 1);
    posRef.current = { x: 0, y: 0 };
    apply();
    const onResize = () => apply();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [apply, minScale]);

  // 휠 줌 (데스크탑) — 포인터 기준
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const old = scaleRef.current;
      const next = Math.max(minScale, Math.min(maxScale, e.deltaY > 0 ? old * 0.9 : old * 1.1));
      const p = posRef.current;
      posRef.current = {
        x: px - ((px - p.x) / old) * next,
        y: py - ((py - p.y) / old) * next,
      };
      scaleRef.current = next;
      apply();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [apply, minScale, maxScale]);

  // 터치 — 핀치(2) · 드래그(1)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e) => {
      if (e.touches.length === 2) {
        draggingRef.current = false;
        lastDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        );
      } else if (e.touches.length === 1) {
        draggingRef.current = true;
        wasDragRef.current = false;
        dragStartPos.current = { ...posRef.current };
        pointerStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        draggingRef.current = false;
        const t1 = e.touches[0], t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (lastDistRef.current === null) { lastDistRef.current = dist; return; }
        const ratio = dist / lastDistRef.current;
        lastDistRef.current = dist;
        const rect = el.getBoundingClientRect();
        const mid = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
        const old = scaleRef.current;
        const next = Math.max(minScale, Math.min(maxScale, old * ratio));
        const p = posRef.current;
        posRef.current = {
          x: mid.x - ((mid.x - p.x) / old) * next,
          y: mid.y - ((mid.y - p.y) / old) * next,
        };
        scaleRef.current = next;
        apply();
      } else if (e.touches.length === 1 && draggingRef.current) {
        const dx = e.touches[0].clientX - pointerStart.current.x;
        const dy = e.touches[0].clientY - pointerStart.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { wasDragRef.current = true; e.preventDefault(); }
        posRef.current = { x: dragStartPos.current.x + dx, y: dragStartPos.current.y + dy };
        apply();
      }
    };

    const onEnd = () => { lastDistRef.current = null; draggingRef.current = false; };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [apply, minScale, maxScale]);

  // 마우스 드래그 (데스크탑 테스트용)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (e) => {
      draggingRef.current = true;
      wasDragRef.current = false;
      dragStartPos.current = { ...posRef.current };
      pointerStart.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - pointerStart.current.x;
      const dy = e.clientY - pointerStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragRef.current = true;
      posRef.current = { x: dragStartPos.current.x + dx, y: dragStartPos.current.y + dy };
      apply();
    };
    const onUp = () => { draggingRef.current = false; };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [apply]);

  // 드래그 직후의 클릭은 삼킨다 (칸이 잘못 열리지 않게)
  const onClickCapture = (e) => {
    if (wasDragRef.current) { e.stopPropagation(); wasDragRef.current = false; }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      onClickCapture={onClickCapture}
      style={{
        position: 'relative',
        height,
        overflow: 'hidden',
        touchAction: 'none',
        cursor: 'grab',
        ...style,
      }}
    >
      <div
        ref={contentRef}
        style={{ width: '100%', transformOrigin: '0 0', willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}
