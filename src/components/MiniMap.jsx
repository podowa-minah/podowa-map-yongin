// src/components/MiniMap.jsx
import React, { useEffect, useRef } from 'react';
import { useLabels } from '../LabelContext';

const ROWS = 25;
const COLS = 8;
const CELL = 3;
const GAP = 1;

export default function MiniMap({ litTreeIds = new Set(), viewportInfo }) {
  const { labels } = useLabels();
  const canvasRef = useRef(null);

  const mapW = COLS * (CELL + GAP) - GAP;
  const mapH = ROWS * (CELL + GAP) - GAP;

  // 나무 그리드 그리기 (litTreeIds/labels 변경 시)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = mapW * dpr;
    canvas.height = mapH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, mapW, mapH);

    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};

        const x = (c - 1) * (CELL + GAP);
        const y = (r - 1) * (CELL + GAP);

        if (lbl.disabled) continue;

        if (litTreeIds.has(numericId)) {
          ctx.fillStyle = '#fbbf24';
        } else {
          ctx.fillStyle = '#b0b0b0';
        }
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }, [labels, litTreeIds, mapW, mapH]);

  // 뷰포트 박스 오버레이 (별도 캔버스로 실시간 업데이트)
  const overlayRef = useRef(null);
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !viewportInfo) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = mapW * dpr;
    canvas.height = mapH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, mapW, mapH);

    const { scale, posX, posY, containerW, containerH, gridW, gridH } = viewportInfo;

    // FarmMap 그리드 좌표로 변환 (보이는 영역)
    const visLeft = -posX / scale;
    const visTop = -posY / scale;
    const visW = containerW / scale;
    const visH = containerH / scale;

    // 미니맵 좌표로 매핑
    const bx = (visLeft / gridW) * mapW;
    const by = (visTop / gridH) * mapH;
    const bw = (visW / gridW) * mapW;
    const bh = (visH / gridH) * mapH;

    // 클램프
    const x1 = Math.max(0, bx);
    const y1 = Math.max(0, by);
    const x2 = Math.min(mapW, bx + bw);
    const y2 = Math.min(mapH, by + bh);

    if (x2 > x1 && y2 > y1) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
    }
  }, [viewportInfo, mapW, mapH]);

  return (
    <div style={{ position: 'relative', width: mapW, height: mapH }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: mapW,
          height: mapH,
          imageRendering: 'pixelated',
        }}
      />
      <canvas
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: mapW,
          height: mapH,
        }}
      />
    </div>
  );
}
