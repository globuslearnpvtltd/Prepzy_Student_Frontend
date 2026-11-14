/**
 * Handwriting model and renderer (no React). One `InkDoc` holds the strokes of one answer.
 *
 * Design choices that matter for how writing feels:
 *  - Coordinates are CSS pixels on the sheet; the canvas backing store is scaled by devicePixelRatio,
 *    so ink is sharp on phones and tablets.
 *  - While a stroke is being written only its newest segment is painted (O(1) per pointer event).
 *    The whole sheet is repainted only on undo, redo, erase, clear and resize.
 *  - Segments are quadratic curves through the midpoints of the samples, so fast strokes stay round
 *    instead of turning into polygons. A stylus varies the width with pressure; finger and mouse do not.
 *  - The eraser removes whole strokes (what students expect from a notes app), and every change is an
 *    undoable operation; nothing is deep-copied per stroke.
 *  - The exported image is cropped to the writing, always dark ink on white, whatever the theme.
 */
import { colorValue } from '@prepzy/design-system/runtime';

export interface InkPoint {
  x: number;
  y: number;
  /** Pressure 0..1 (0.5 when the device does not report it). */
  p: number;
}

export interface InkStroke {
  id: number;
  pts: InkPoint[];
  /** Written with a stylus that reports pressure. */
  pen: boolean;
  /** Bounding box, kept up to date as points are added. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Op = { kind: 'add'; stroke: InkStroke } | { kind: 'remove'; items: { stroke: InkStroke; index: number }[] };

export const INK_BASE_WIDTH = 2.6;
const MIN_SAMPLE_DISTANCE = 0.6;
const EXPORT_PADDING = 20;
const EXPORT_MAX_SIDE = 2048;
/** Dark ink and white paper for the exported image (design tokens, not the theme). */
export const EXPORT_INK = colorValue('neutral.950');
const EXPORT_PAPER = colorValue('neutral.0');
const UNDO_LIMIT = 200;

const widthAt = (stroke: InkStroke, p: number) =>
  stroke.pen ? INK_BASE_WIDTH * (0.5 + Math.min(1, Math.max(0.05, p)) * 1.0) : INK_BASE_WIDTH;

const mid = (a: InkPoint, b: InkPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Paint the segment that ends at point `i` (the curve from the previous midpoint to this midpoint). */
function paintSegment(ctx: CanvasRenderingContext2D, stroke: InkStroke, i: number): void {
  const pts = stroke.pts;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const from = i >= 2 ? mid(pts[i - 2]!, a) : a;
  const to = mid(a, b);
  ctx.lineWidth = (widthAt(stroke, a.p) + widthAt(stroke, b.p)) / 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(a.x, a.y, to.x, to.y);
  ctx.stroke();
}

/** Paint the short tail from the last midpoint to the last point (when the pen lifts). */
function paintTail(ctx: CanvasRenderingContext2D, stroke: InkStroke): void {
  const pts = stroke.pts;
  const last = pts[pts.length - 1]!;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(last.x, last.y, widthAt(stroke, last.p) * 0.6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const from = mid(pts[pts.length - 2]!, last);
  ctx.lineWidth = widthAt(stroke, last.p);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke): void {
  for (let i = 1; i < stroke.pts.length; i += 1) paintSegment(ctx, stroke, i);
  paintTail(ctx, stroke);
}

function prepare(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
}

function distanceToSegment(px: number, py: number, a: InkPoint, b: InkPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export class InkDoc {
  strokes: InkStroke[] = [];
  private undoStack: Op[] = [];
  private redoStack: Op[] = [];
  private nextId = 1;
  private listeners = new Set<() => void>();
  /** Bumped on every change; lets React re-read `isEmpty`, `canUndo`, `canRedo`. */
  version = 0;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private changed(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  get isEmpty(): boolean {
    return this.strokes.length === 0;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Lowest point of the writing (CSS px), used to grow the sheet as the student writes down the page. */
  get bottom(): number {
    let y = 0;
    for (const stroke of this.strokes) y = Math.max(y, stroke.y1);
    return y;
  }

  /** Rightmost point of the writing (CSS px): keeps ink reachable after the screen gets narrower (rotation). */
  get right(): number {
    let x = 0;
    for (const stroke of this.strokes) x = Math.max(x, stroke.x1);
    return x;
  }

  // ------------------------------------------------------------------ writing

  begin(point: InkPoint, pen: boolean): InkStroke {
    return { id: this.nextId++, pts: [point], pen, x0: point.x, y0: point.y, x1: point.x, y1: point.y };
  }

  /** Add a sample to a stroke in progress. Returns false when it is too close to the last one to matter. */
  extend(stroke: InkStroke, point: InkPoint): boolean {
    const last = stroke.pts[stroke.pts.length - 1]!;
    if (Math.hypot(point.x - last.x, point.y - last.y) < MIN_SAMPLE_DISTANCE) return false;
    stroke.pts.push(point);
    stroke.x0 = Math.min(stroke.x0, point.x);
    stroke.y0 = Math.min(stroke.y0, point.y);
    stroke.x1 = Math.max(stroke.x1, point.x);
    stroke.y1 = Math.max(stroke.y1, point.y);
    return true;
  }

  commit(stroke: InkStroke): void {
    this.strokes.push(stroke);
    this.push({ kind: 'add', stroke });
  }

  // ------------------------------------------------------------------ erasing

  /** Remove every stroke that passes within `radius` of the point. Returns true when something was removed. */
  eraseAt(x: number, y: number, radius: number, into: { stroke: InkStroke; index: number }[]): boolean {
    let hit = false;
    for (let index = this.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = this.strokes[index]!;
      if (x < stroke.x0 - radius || x > stroke.x1 + radius || y < stroke.y0 - radius || y > stroke.y1 + radius) continue;
      const pts = stroke.pts;
      let near = pts.length === 1 && Math.hypot(x - pts[0]!.x, y - pts[0]!.y) <= radius;
      for (let i = 1; i < pts.length && !near; i += 1) near = distanceToSegment(x, y, pts[i - 1]!, pts[i]!) <= radius;
      if (near) {
        into.push({ stroke, index });
        this.strokes.splice(index, 1);
        hit = true;
      }
    }
    return hit;
  }

  /** Record one erasing gesture (possibly many strokes) as a single undo step. */
  commitErase(items: { stroke: InkStroke; index: number }[]): void {
    if (items.length) this.push({ kind: 'remove', items });
    else this.changed();
  }

  clear(): void {
    if (!this.strokes.length) return;
    const items = this.strokes.map((stroke, index) => ({ stroke, index })).reverse();
    this.strokes = [];
    this.push({ kind: 'remove', items });
  }

  /** Forget everything, including undo history (after sending). */
  reset(): void {
    this.strokes = [];
    this.undoStack = [];
    this.redoStack = [];
    this.changed();
  }

  // ------------------------------------------------------------------ undo / redo

  private push(op: Op): void {
    this.undoStack.push(op);
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.changed();
  }

  private apply(op: Op, forward: boolean): void {
    const adding = (op.kind === 'add') === forward;
    if (op.kind === 'add') {
      if (adding) this.strokes.push(op.stroke);
      else this.strokes = this.strokes.filter((stroke) => stroke !== op.stroke);
    } else if (adding) {
      // put erased strokes back where they were (items are stored from the highest index down)
      for (const item of [...op.items].reverse()) this.strokes.splice(Math.min(item.index, this.strokes.length), 0, item.stroke);
    } else {
      const gone = new Set(op.items.map((item) => item.stroke));
      this.strokes = this.strokes.filter((stroke) => !gone.has(stroke));
    }
  }

  undo(): void {
    const op = this.undoStack.pop();
    if (!op) return;
    this.apply(op, false);
    this.redoStack.push(op);
    this.changed();
  }

  redo(): void {
    const op = this.redoStack.pop();
    if (!op) return;
    this.apply(op, true);
    this.undoStack.push(op);
    this.changed();
  }

  // ------------------------------------------------------------------ painting

  /** Repaint the whole sheet. `ctx` must already be scaled to CSS pixels. */
  paint(ctx: CanvasRenderingContext2D, width: number, height: number, color: string): void {
    ctx.clearRect(0, 0, width, height);
    prepare(ctx, color);
    for (const stroke of this.strokes) paintStroke(ctx, stroke);
  }

  /** Paint only the newest segment of a stroke in progress. */
  paintLatest(ctx: CanvasRenderingContext2D, stroke: InkStroke, color: string): void {
    prepare(ctx, color);
    if (stroke.pts.length >= 2) paintSegment(ctx, stroke, stroke.pts.length - 1);
  }

  paintEnd(ctx: CanvasRenderingContext2D, stroke: InkStroke, color: string): void {
    prepare(ctx, color);
    paintTail(ctx, stroke);
  }

  // ------------------------------------------------------------------ export

  /** The writing as a PNG file: cropped to the ink, dark on white, at most 2048 px on its long side. */
  async toFile(name = `handwriting-${Date.now()}.png`): Promise<File | null> {
    if (this.isEmpty) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const stroke of this.strokes) {
      x0 = Math.min(x0, stroke.x0);
      y0 = Math.min(y0, stroke.y0);
      x1 = Math.max(x1, stroke.x1);
      y1 = Math.max(y1, stroke.y1);
    }
    const w = x1 - x0 + EXPORT_PADDING * 2;
    const h = y1 - y0 + EXPORT_PADDING * 2;
    const scale = Math.min(2, EXPORT_MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare the handwriting.');
    ctx.fillStyle = EXPORT_PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, (EXPORT_PADDING - x0) * scale, (EXPORT_PADDING - y0) * scale);
    prepare(ctx, EXPORT_INK);
    for (const stroke of this.strokes) paintStroke(ctx, stroke);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('Your browser could not prepare the handwriting.');
    return new File([blob], name, { type: 'image/png', lastModified: Date.now() });
  }

  // ------------------------------------------------------------------ drafts

  /** Compact JSON for a draft (coordinates rounded to 0.1 px). */
  serialize(): string {
    const r = (n: number) => Math.round(n * 10) / 10;
    return JSON.stringify(
      this.strokes.map((stroke) => [stroke.pen ? 1 : 0, stroke.pts.flatMap((pt) => [r(pt.x), r(pt.y), Math.round(pt.p * 100) / 100])]),
    );
  }

  /** Load a draft written by `serialize`. Anything malformed is ignored. */
  restore(json: string): void {
    try {
      const raw: unknown = JSON.parse(json);
      if (!Array.isArray(raw)) return;
      const strokes: InkStroke[] = [];
      for (const entry of raw) {
        if (!Array.isArray(entry) || !Array.isArray(entry[1]) || entry[1].length < 3) continue;
        const flat = entry[1] as unknown[];
        let stroke: InkStroke | null = null;
        for (let i = 0; i + 2 < flat.length; i += 3) {
          const x = Number(flat[i]);
          const y = Number(flat[i + 1]);
          const p = Number(flat[i + 2]);
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) continue;
          if (!stroke) stroke = this.begin({ x, y, p }, entry[0] === 1);
          else {
            stroke.pts.push({ x, y, p });
            stroke.x0 = Math.min(stroke.x0, x);
            stroke.y0 = Math.min(stroke.y0, y);
            stroke.x1 = Math.max(stroke.x1, x);
            stroke.y1 = Math.max(stroke.y1, y);
          }
        }
        if (stroke) strokes.push(stroke);
      }
      this.strokes = strokes;
      this.undoStack = [];
      this.redoStack = [];
      this.changed();
    } catch {
      /* a broken draft is simply not restored */
    }
  }
}
