// src/GrassMap.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useGrassLabels } from "./GrassLabelContext";
import { useGrassTypes } from "./GrassTypesContext";
import { useLabels } from "./LabelContext";
import treeBgSVG from "./assets/icons/tree_bg.svg";

/** HEX 색상을 어둡게 (밝은 색 → 글자용으로 대비 확보) */
function darkenColor(hex, factor = 0.55) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `rgb(${dr},${dg},${db})`;
}

/** 개별 셀 (React.memo로 불필요한 리렌더 방지) */
const GrassCell = React.memo(function GrassCell({
  grassId, numericId, cellW, cellH, isDisabled,
  hasActiveTree, dominantNames, isTied, cellBg, displayNames,
  colorMap, onClick,
}) {
  if (isDisabled) {
    return (
      <div
        style={{
          width: cellW, height: cellH,
          backgroundColor: "#d3d3d3", opacity: 0.5,
          borderRadius: 2, cursor: "pointer",
        }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: cellW, height: cellH,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", outline: "1px solid #ccc",
        background: cellBg,
        position: "relative", borderRadius: 2, overflow: "hidden",
      }}
    >
      {hasActiveTree && (
        <img
          src={treeBgSVG} alt="" draggable={false}
          style={{
            position: "absolute", width: "100%", height: "100%",
            top: 0, left: 0, pointerEvents: "none",
          }}
        />
      )}
      {displayNames.map((dn, i) => {
        const maxLen = Math.max(...displayNames.map(n => n.length));
        const baseFontSize = isTied
          ? Math.max(3.5, Math.min(6.5, cellW / (maxLen * 0.7)))
          : Math.max(5, Math.min(8, cellW / (dn.length * 0.65)));
        const singleColor = !isTied && dominantNames.length === 1
          ? darkenColor(colorMap[dominantNames[0]] || '#e8f5e9')
          : "#444";
        return (
          <span key={i} style={{
            fontSize: baseFontSize, fontFamily: "sans-serif",
            color: isTied ? "#444" : singleColor,
            fontWeight: 700, whiteSpace: "nowrap",
            lineHeight: "1.1", zIndex: 1,
          }}>
            {dn}
          </span>
        );
      })}
      <span style={{
        fontSize: 6, fontFamily: "sans-serif",
        color: (!isTied && dominantNames.length === 1)
          ? darkenColor(colorMap[dominantNames[0]] || '#e8f5e9')
          : "#999",
        whiteSpace: "nowrap", lineHeight: "1", zIndex: 1,
        opacity: (!isTied && dominantNames.length === 1) ? 0.7 : 1,
      }}>
        {numericId}
      </span>
    </div>
  );
});

export default function GrassMap({ grassRecords = {}, onCellClick }) {
  const rows = 25;
  const cols = 8;
  const cellW = 44;
  const cellH = 36;
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

  const { labels: grassLabels } = useGrassLabels();
  const { labels: treeLabels } = useLabels();
  const { colorMap } = useGrassTypes();

  const gridW = cols * cellW + (cols - 1) * gapX;
  const gridH = rows * cellH + (rows - 1) * gapY;

  // 각 셀의 우세종 계산 (가장 최근 기록 기준)
  const dominantMap = useMemo(() => {
    const map = {};
    Object.entries(grassRecords).forEach(([numId, records]) => {
      if (records.length > 0) {
        // 최신 기록
        const latest = records[0]; // already sorted desc
        map[numId] = {
          name: latest.dominant_grass || '',
          distribution: typeof latest.distribution === 'string'
            ? JSON.parse(latest.distribution)
            : latest.distribution,
        };
      }
    });
    return map;
  }, [grassRecords]);

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

  const handleCellClick = useCallback((id) => {
    if (wasDragRef.current) return;
    if (onCellClick) onCellClick(id);
  }, [onCellClick]);

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
          gridTemplateRows: `repeat(${rows}, ${cellH}px)`,
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
          const grassId = `Grass-${c + 1}-${r + 1}`;
          const nId = `${c + 1}-${r + 1}`;
          const grassLbl = grassLabels[grassId] || {};
          const isDisabled = grassLbl.disabled === true;

          const treeLabelId = `Tree-${c + 1}-${r + 1}`;
          const treeLbl = treeLabels[treeLabelId] || {};
          const hasActiveTree = !treeLbl.disabled;

          const dom = dominantMap[nId];
          const dominantRaw = dom?.name || '';
          const dominantNames = dominantRaw ? dominantRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
          const isTied = dominantNames.length > 1;

          let cellBg = '#ffffff';
          if (dominantNames.length === 1) {
            const c1 = colorMap[dominantNames[0]] || '#e8f5e9';
            cellBg = `${c1}30`;
          } else if (isTied) {
            const stops = dominantNames.map((n, i) => {
              const col = colorMap[n] || '#e8f5e9';
              const pct1 = (i / dominantNames.length) * 100;
              const pct2 = ((i + 1) / dominantNames.length) * 100;
              return `${col}50 ${pct1}%, ${col}50 ${pct2}%`;
            }).join(', ');
            cellBg = `linear-gradient(135deg, ${stops})`;
          }

          const displayNames = dominantNames.length > 0 ? dominantNames : [grassLbl.name || '풀'];

          return (
            <GrassCell
              key={grassId}
              grassId={grassId}
              numericId={nId}
              cellW={cellW}
              cellH={cellH}
              isDisabled={isDisabled}
              hasActiveTree={hasActiveTree}
              dominantNames={dominantNames}
              isTied={isTied}
              cellBg={cellBg}
              displayNames={displayNames}
              colorMap={colorMap}
              onClick={() => handleCellClick(grassId)}
            />
          );
        })}
      </div>
    </div>
  );
}
