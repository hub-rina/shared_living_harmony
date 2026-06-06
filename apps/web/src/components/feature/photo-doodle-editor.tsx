'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';

const MAX_DIMENSION = 720;
const COLORS = ['#e0683f', '#7fa888', '#2f2a26', '#f2f0ea'] as const;
const STAMPS = ['heart', 'star', 'spark'] as const;

type Color = (typeof COLORS)[number];
type Stamp = (typeof STAMPS)[number];
type Tool = 'draw' | Stamp;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  color: Color;
  width: number;
  points: Point[];
}

interface StampMark {
  stamp: Stamp;
  color: Color;
  x: number;
  y: number;
  size: number;
}

type Mark = { kind: 'stroke'; value: Stroke } | { kind: 'stamp'; value: StampMark };

interface PhotoDoodleEditorProps {
  imageDataUrl: string;
  onCancel: () => void;
  onDone: (editedDataUrl: string) => void;
}

function drawStamp(ctx: CanvasRenderingContext2D, mark: StampMark): void {
  const { x, y, size, color, stamp } = mark;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.12;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (stamp === 'heart') {
    const s = size;
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s, y - s * 0.2, x - s, y - s * 0.55);
    ctx.bezierCurveTo(x - s, y - s, x, y - s, x, y - s * 0.45);
    ctx.bezierCurveTo(x, y - s, x + s, y - s, x + s, y - s * 0.55);
    ctx.bezierCurveTo(x + s, y - s * 0.2, x, y, x, y + s * 0.3);
    ctx.fill();
  } else if (stamp === 'star') {
    for (let i = 0; i < 5; i++) {
      const outer = i * ((Math.PI * 2) / 5) - Math.PI / 2;
      const inner = outer + Math.PI / 5;
      ctx.lineTo(x + Math.cos(outer) * size, y + Math.sin(outer) * size);
      ctx.lineTo(x + Math.cos(inner) * size * 0.45, y + Math.sin(inner) * size * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    for (let i = 0; i < 4; i++) {
      const angle = i * (Math.PI / 2) - Math.PI / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of rest) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}

export function PhotoDoodleEditor({ imageDataUrl, onCancel, onDone }: PhotoDoodleEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const marksRef = useRef<Mark[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>('draw');
  const [color, setColor] = useState<Color>(COLORS[0]);
  const [marksCount, setMarksCount] = useState(0);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      imageRef.current = image;
      setReady(true);
    };
    image.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    if (ready) redraw();
    // redraw reads refs; ready/marksCount drive the repaint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, marksCount]);

  function toCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function redraw(): void {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const mark of marksRef.current) {
      if (mark.kind === 'stroke') drawStroke(ctx, mark.value);
      else drawStamp(ctx, mark.value);
    }
    if (drawingRef.current) drawStroke(ctx, drawingRef.current);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = toCanvasPoint(e);
    if (tool === 'draw') {
      drawingRef.current = { color, width: Math.max(4, canvasRef.current!.width * 0.012), points: [point] };
      redraw();
      return;
    }
    const size = Math.max(18, canvasRef.current!.width * 0.06);
    marksRef.current.push({ kind: 'stamp', value: { stamp: tool, color, x: point.x, y: point.y, size } });
    setMarksCount((count) => count + 1);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current.points.push(toCanvasPoint(e));
    redraw();
  }

  function handlePointerUp() {
    if (drawingRef.current) {
      marksRef.current.push({ kind: 'stroke', value: drawingRef.current });
      drawingRef.current = null;
      setMarksCount((count) => count + 1);
    }
  }

  function handleUndo() {
    marksRef.current.pop();
    setMarksCount((count) => count + 1);
  }

  function handleClear() {
    marksRef.current = [];
    setMarksCount((count) => count + 1);
  }

  function handleDone() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onDone(canvas.toDataURL('image/jpeg', 0.85));
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full touch-none rounded-2xl border border-[var(--border)]"
        aria-label="Draw on the photo"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-full bg-[var(--surface-raised)] p-1" role="group" aria-label="Tools">
          {(['draw', ...STAMPS] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              aria-pressed={tool === t}
              className={`min-h-8 rounded-full px-3 text-xs font-semibold capitalize tracking-tight transition-colors ${
                tool === t ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-sm' : 'text-[var(--text-mute)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="inline-flex gap-1.5" role="group" aria-label="Colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Use color ${c}`}
              aria-pressed={color === c}
              style={{ background: c }}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                color === c ? 'scale-110 border-[var(--foreground)]' : 'border-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={handleUndo} disabled={marksCount === 0}>
            Undo
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={handleClear} disabled={marksCount === 0}>
            Clear
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleDone}>
            Use this photo
          </Button>
        </div>
      </div>
    </div>
  );
}
