// src/GrassMap.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import RenamePopup from "./RenamePopup";
import { useGrassLabels } from "./GrassLabelContext";

export default function GrassMap() {
  const rows = 25;
  const cols = 8;
  const cellW = 44;
  const cellH = 26;
  const gapX = 6;
  const gapY = 8;

  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const lastDistRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const wasDragRef = useRef(false);

  const { labels, upsert } = useGrassLabels();
  const [editId, setEditId] = useState(null);

  const gridW = cols * cellW + (cols - 1) * gapX;
  const gridH = rows * (cellH + 10) + (rows - 1) * gapY;

  // transform 적용
  const applyTransform = useCallback(() => {
    if (!gridRef.current || !containerRef.current) return;
    const s = scaleRef.current;
    const p = posRef.current;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scaledW = gridW * s;
    const scaledH = gridH * s;

    const marginX = cw * 0.25;
    const marginY = ch * 0.25;
    p.x = Math.max(-scaledW + cw - marginX, Math.min(marginX, p.x));
    p.y = Math.max(-scaledH + ch - marginY, Math.min(marginY, p.y));
    posRef.current = p;

    gridRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
  }, [gridW, gridH]);

  // 초기 스케일
  useEffect(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const padding = 2;
    const initScale = Math.max(0.8, Math.min((cw - padding * 2) / gridW, 3.5));
    scaleRef.current = initScale;
    const scaledW = gridW * initScale;
    posRef.current = {
      x: Math.max(0, (cw - scaledW) / 2),
      y: 2,
    };
    applyTransform();
  }, [applyTransform, gridW]);

  // 마우스 휠 줌
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const oldScale = scaleRef.current;
      const newScale = Math.max(0.5, Math.min(4, e.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1));
      const oldPos = posRef.current;
      const newPos = {
        x: pointer.x - ((pointer.x - oldPos.x) / oldScale) * newScale,
        y: pointer.y - ((pointer.y - oldPos.y) / oldScale) * newScale,
      };
      scaleRef.current = newScale;
      posRef.current = newPos;
      applyTransform();
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [applyTransform]);

  // 터치: 드래그 + 핀치줌
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        isDraggingRef.current = false;
        lastDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
      } else if (e.touches.length === 1) {
        isDraggingRef.current = true;
        wasDragRef.current = false;
        dragStartRef.current = { ...posRef.current };
        pointerStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        isDraggingRef.current = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (lastDistRef.current === null) { lastDistRef.current = dist; return; }
        const ratio = dist / lastDistRef.current;
        lastDistRef.current = dist;
        const rect = el.getBoundingClientRect();
        const mid = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
        const oldScale = scaleRef.current;
        const newScale = Math.max(0.5, Math.min(4, oldScale * ratio));
        const oldPos = posRef.current;
        const newPos = {
          x: mid.x - ((mid.x - oldPos.x) / oldScale) * newScale,
          y: mid.y - ((mid.y - oldPos.y) / oldScale) * newScale,
        };
        scaleRef.current = newScale;
        posRef.current = newPos;
        applyTransform();
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        const dx = e.touches[0].clientX - pointerStartRef.current.x;
        const dy = e.touches[0].clientY - pointerStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragRef.current = true;
        posRef.current = {
          x: dragStartRef.current.x + dx,
          y: dragStartRef.current.y + dy,
        };
        applyTransform();
      }
    };

    const onTouchEnd = () => {
      lastDistRef.current = null;
      isDraggingRef.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform]);

  // 마우스 드래그 (데스크탑)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      wasDragRef.current = false;
      dragStartRef.current = { ...posRef.current };
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragRef.current = true;
      posRef.current = { x: dragStartRef.current.x + dx, y: dragStartRef.current.y + dy };
      applyTransform();
    };
    const onMouseUp = () => { isDraggingRef.current = false; };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [applyTransform]);

  // 컨테이너 높이
  const [containerHeight, setContainerHeight] = useState(window.innerHeight);
  useEffect(() => {
    function calcHeight() {
      const header = document.querySelector(".app-header-bar");
      const headerH = header ? header.getBoundingClientRect().height : 50;
      setContainerHeight(window.innerHeight - headerH);
    }
    calcHeight();
    window.addEventListener("resize", calcHeight);
    return () => window.removeEventListener("resize", calcHeight);
  }, []);

  const handleLabelClick = useCallback((id) => {
    if (wasDragRef.current) return;
    setEditId(id);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        overflow: "hidden",
        width: "100%",
        height: containerHeight,
        touchAction: "none",
        userSelect: "none",
        cursor: isDraggingRef.current ? "grabbing" : "grab",
        position: "relative",
      }}
    >
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellH + 10}px)`,
          columnGap: gapX,
          rowGap: gapY,
          transformOrigin: "0 0",
          willChange: "transform",
          width: gridW,
        }}
      >
        {Array.from({ length: rows * cols }, (_, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const id = `Grass-${c + 1}-${r + 1}`;
          const numericId = `${c + 1}-${r + 1}`;
          const lbl = labels[id] || {};
          const displayName = lbl.name || `풀 ${numericId}`;
          const isDisabled = lbl.disabled === true;

          if (isDisabled) {
            return (
              <div
                key={id}
                onClick={() => handleLabelClick(id)}
                style={{
                  width: cellW,
                  height: cellH + 10,
                  backgroundColor: "#d3d3d3",
                  opacity: 0.5,
                  borderRadius: 2,
                  cursor: "pointer",
                }}
              />
            );
          }

          return (
            <div
              key={id}
              onClick={() => handleLabelClick(id)}
              style={{
                width: cellW,
                height: cellH + 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                outline: "1.5px solid #7cb342",
                backgroundColor: lbl.color || '#e8f5e9',
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: Math.max(5, Math.min(9, cellW / (displayName.length * 0.6))),
                  fontFamily: "sans-serif",
                  color: "#33691e",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                  lineHeight: "1.2",
                }}
              >
                {displayName}
              </span>
            </div>
          );
        })}
      </div>

      {editId && (
        <RenamePopup
          id={editId}
          current={labels[editId]}
          onSave={(payload) => upsert(editId, payload)}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}
