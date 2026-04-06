// src/FarmMap.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSignalLights } from "./SignalLightsContext";
import RenamePopup from "./RenamePopup";
import { useLabels } from "./LabelContext";

import treeSVG from "./assets/icons/tree.svg";
import bugSVG from "./assets/icons/bug.svg";
import clockSVG from "./assets/icons/clock.svg";

const daysSince = (isoDate) =>
  (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);

function computeTriggers(records) {
  if (!records || records.length === 0) {
    return { stale: true, treeOn: false, bugOn: false, clockOn: true };
  }

  const newestDate = records[0].date;
  const stale = daysSince(newestDate) >= 3;

  let treeOn = false;
  let bugOn = false;

  for (const row of records) {
    if (!treeOn && (["1", "2", 1, 2].includes(row.balance) ||
                    ["1", "5", 1, 5].includes(row.power))) {
      treeOn = true;
    }
    if (!bugOn && Number(row.bugs) >= 4) bugOn = true;

    if (treeOn && bugOn) break;
  }

  return { stale, treeOn, bugOn, clockOn: stale };
}

export default function FarmMap({ treeData = {}, onTreeClick }) {
  const rows = 25;
  const cols = 8;
  const cellW = 44;
  const cellH = 26;
  const gapX = 6;
  const gapY = 8;
  const iconSize = 12;
  const iconGap = 2;

  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const lastDistRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const wasDragRef = useRef(false);

  const { signalOn } = useSignalLights();
  const { labels, upsert } = useLabels();
  const [editId, setEditId] = useState(null);

  // transform 적용 (React state 안 씀 → 렉 없음)
  const applyTransform = useCallback(() => {
    if (!gridRef.current) return;
    const s = scaleRef.current;
    const p = posRef.current;
    gridRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
  }, []);

  // 데스크탑 초기 스케일
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1025;
    if (isDesktop) {
      const initScale = Math.min(window.innerWidth / 500, 2.5);
      scaleRef.current = initScale;
      posRef.current = { x: 20, y: 20 };
    }
    applyTransform();
  }, [applyTransform]);

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

  // 터치: 드래그(1손가락) + 핀치줌(2손가락)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        // 핀치 시작
        isDraggingRef.current = false;
        lastDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
      } else if (e.touches.length === 1) {
        // 드래그 시작
        isDraggingRef.current = true;
        wasDragRef.current = false;
        dragStartRef.current = { ...posRef.current };
        pointerStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();

      if (e.touches.length === 2) {
        // 핀치줌
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
        // 1손가락 드래그
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
      posRef.current = {
        x: dragStartRef.current.x + dx,
        y: dragStartRef.current.y + dy,
      };
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

  // 셀 클릭 핸들러 (드래그와 구분)
  const handleCellClick = useCallback((id) => {
    if (wasDragRef.current) return;
    onTreeClick(id);
  }, [onTreeClick]);

  const handleLabelClick = useCallback((id) => {
    if (wasDragRef.current) return;
    setEditId(id);
  }, []);

  // 아이콘 x 위치 계산
  const xCenter = (i) => {
    const stripW = 3 * iconSize + 2 * iconGap;
    return (cellW - stripW) / 2 + i * (iconSize + iconGap);
  };

  const gridW = cols * cellW + (cols - 1) * gapX;

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
          const id = `Tree-${c + 1}-${r + 1}`;
          const numericId = `${c + 1}-${r + 1}`;
          const lbl = labels[id] || {};
          const displayId = lbl.name ? `${numericId} ${lbl.name}` : numericId;
          const isDisabled = lbl.disabled === true;
          const records = treeData[numericId] || [];
          const { treeOn, bugOn, clockOn } = computeTriggers(records);

          if (isDisabled) {
            return (
              <div
                key={id}
                style={{
                  width: cellW,
                  height: cellH,
                  backgroundColor: "#d3d3d3",
                  opacity: 0.5,
                  borderRadius: 2,
                }}
              />
            );
          }

          return (
            <div
              key={id}
              style={{
                width: cellW,
                height: cellH + 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                border: "1px solid #000000",
                boxSizing: "border-box",
              }}
            >
              {/* 아이콘 영역 */}
              <div
                onClick={() => handleCellClick(id)}
                style={{
                  display: "flex",
                  gap: iconGap,
                  justifyContent: "center",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <img
                  src={treeSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{ opacity: signalOn && treeOn ? 1 : 0.25 }}
                  draggable={false}
                  alt=""
                />
                <img
                  src={bugSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{ opacity: signalOn && bugOn ? 1 : 0.25 }}
                  draggable={false}
                  alt=""
                />
                <img
                  src={clockSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{ opacity: signalOn && clockOn ? 1 : 0.25 }}
                  draggable={false}
                  alt=""
                />
              </div>

              {/* 라벨 영역 */}
              <div
                onClick={() => handleLabelClick(id)}
                style={{
                  width: "100%",
                  height: 10,
                  backgroundColor: lbl.color || "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: Math.max(4, Math.min(8, cellW / (displayId.length * 0.65))),
                    fontFamily: "sans-serif",
                    color: "#000000",
                    whiteSpace: "nowrap",
                    lineHeight: "10px",
                  }}
                >
                  {displayId}
                </span>
              </div>
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
