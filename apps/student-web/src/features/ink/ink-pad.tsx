'use client';

import { cx } from '@prepzy/design-system';
import { ChevronDown, ChevronUp, Eraser, Hand, Maximize2, Minimize2, PenLine, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { EXPORT_INK, InkDoc, type InkStroke } from './ink-doc';

const MIN_SHEET = 120; // CSS px: the smallest sheet, on a very short screen
const MAX_SHEET = 1400; // one message's worth: longer pages become too small for the tutor to read
const GROW_MARGIN = 72; // start adding room when writing gets this close to the bottom
const GROW_STEP = 168;
const ERASER_RADIUS = 11;
const PALM_GUARD_MS = 450; // ignore touches for this long after the stylus was last on the sheet
const DRAFT_LIMIT = 1_500_000; // characters; larger drafts are simply not saved

const draftStorageKey = (draftKey: string) => `prepzy-ink:${draftKey}`;

/** Forget a saved draft (its writing was used after the pad went away, e.g. uploaded into an answer). */
export function clearInkDraft(draftKey: string | undefined): void {
  if (!draftKey) return;
  try {
    window.sessionStorage.removeItem(draftStorageKey(draftKey));
  } catch {
    /* storage disabled */
  }
}

/**
 * One handwriting document per composer. With `draftKey`, unfinished writing survives a reload of the
 * tab (sessionStorage; it is removed when the pad is emptied or the message is sent).
 */
export function useInkDoc(draftKey?: string): InkDoc {
  const [doc] = useState(() => new InkDoc());
  const storageKey = draftKey ? draftStorageKey(draftKey) : null;

  // Load the draft of this key. When the key changes (another chat), the pad shows that chat's draft instead.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    if (loadedKey.current && loadedKey.current !== storageKey) doc.reset();
    loadedKey.current = storageKey;
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved && doc.isEmpty) doc.restore(saved);
    } catch {
      /* private mode or storage disabled: writing still works, it is just not kept */
    }
  }, [doc, storageKey]);

  // Save shortly after each change, and immediately when the composer goes away (chat closed, page hidden),
  // so the last strokes are never lost to the delay.
  useEffect(() => {
    if (!storageKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = () => {
      clearTimeout(timer);
      try {
        if (doc.isEmpty) return window.sessionStorage.removeItem(storageKey);
        const json = doc.serialize();
        if (json.length <= DRAFT_LIMIT) window.sessionStorage.setItem(storageKey, json);
      } catch {
        /* quota or disabled storage */
      }
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(write, 400);
    };
    const unsubscribe = doc.subscribe(later);
    window.addEventListener('pagehide', write);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', write);
      write();
    };
  }, [doc, storageKey]);

  return doc;
}

/** Re-render when the document changes; returns its change counter. */
export function useInkVersion(doc: InkDoc): number {
  return useSyncExternalStore(doc.subscribe, doc.getVersion, doc.getVersion);
}

export interface InkPadProps {
  doc: InkDoc;
  /** Fill the available height (full-screen writing) instead of the compact pad. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  disabled?: boolean;
  /** Extra controls at the right of the toolbar (e.g. "Convert to text"). */
  toolbarSlot?: React.ReactNode;
  className?: string;
}

/**
 * The writing surface: finger, stylus, mouse and trackpad.
 *
 *  - Stylus: pressure-sensitive; its eraser end or barrel eraser button erases. Once a stylus has been
 *    used, fingers scroll the sheet instead of drawing (palm rejection) until "Finger" is switched on.
 *  - Finger: one finger writes, two fingers scroll.
 *  - Mouse / trackpad: press and drag writes; the wheel or a two-finger swipe scrolls.
 *  - The sheet grows as the student writes down the page; nothing has to be "added".
 */
export function InkPad({ doc, expanded = false, onExpandedChange, disabled, toolbarSlot, className }: InkPadProps) {
  const version = useInkVersion(doc);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState(MIN_SHEET);
  const [sheet, setSheet] = useState(0);
  const [penSeen, setPenSeen] = useState(false);
  const [fingerDraws, setFingerDraws] = useState(true);
  const [writing, setWriting] = useState(false);
  // Where the pad is scrolled to, for the up / down buttons (two-finger scrolling is not obvious on a phone).
  const [reach, setReach] = useState({ up: false, down: false });
  const wantBottom = useRef(false);

  // Mutable gesture state: none of this should re-render the component while the pen is moving.
  const g = useRef({
    stroke: null as InkStroke | null,
    pointer: -1,
    erasing: false,
    erased: [] as { stroke: InkStroke; index: number }[],
    rect: null as DOMRect | null,
    touches: new Map<number, { x: number; y: number }>(), // last position of each touch, for scrolling
    panning: false,
    penUntil: 0,
    skipPaint: false,
    advance: undefined as ReturnType<typeof setTimeout> | undefined,
  }).current;

  const context = useCallback(() => canvas.current?.getContext('2d', { desynchronized: true }) ?? null, []);
  const inkColor = useCallback(() => (canvas.current ? getComputedStyle(canvas.current).color : EXPORT_INK), []);

  // ------------------------------------------------------------------ size

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setViewport(el.clientHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The pad itself never changes height while writing (no layout jump under the hand); only the sheet inside it grows.
  const minSheet = Math.max(MIN_SHEET, viewport);
  const height = Math.min(MAX_SHEET, Math.max(minSheet, sheet));
  // Normally the sheet is as wide as the pad. If the pad got narrower after writing (phone rotated, panel
  // resized), the sheet stays wide enough to reach everything and scrolls sideways.
  const sheetWidth = Math.max(width, doc.isEmpty ? 0 : Math.ceil(doc.right) + 24);
  const full = height >= MAX_SHEET && doc.bottom > MAX_SHEET - GROW_MARGIN;

  // The sheet only grows while writing; when ink is removed (undo, erase, clear, send) it shrinks back.
  useEffect(() => {
    if (doc.isEmpty) return setSheet(0);
    const needed = doc.bottom + GROW_MARGIN;
    // grow in steps (a resize repaints the sheet, so not on every stroke); shrink only when a lot was removed
    setSheet((current) => (needed > Math.max(current, minSheet) || needed < current - 4 * GROW_STEP ? needed + GROW_STEP : current));
  }, [doc, version, minSheet]);

  // Size the backing store for the screen's pixel density and repaint.
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el || !sheetWidth) return;
    let dpr = Math.min(3, window.devicePixelRatio || 1);
    while (dpr > 1 && sheetWidth * dpr * height * dpr > 12_000_000) dpr -= 0.5; // stay inside mobile canvas limits
    el.width = Math.round(sheetWidth * dpr);
    el.height = Math.round(height * dpr);
    const ctx = context();
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    doc.paint(ctx, sheetWidth, height, inkColor());
  }, [doc, sheetWidth, height, context, inkColor]);

  const updateReach = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const up = el.scrollTop > 2;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setReach((now) => (now.up === up && now.down === down ? now : { up, down }));
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && wantBottom.current) {
      wantBottom.current = false;
      el.scrollTop = el.scrollHeight; // the student asked for more room: show it
    }
    updateReach();
  }, [height, viewport, updateReach]);

  const canAddRoom = !reach.down && !doc.isEmpty && height < MAX_SHEET;

  const move = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    if (direction === 1 && !reach.down) {
      wantBottom.current = true;
      return setSheet(Math.min(MAX_SHEET, height + Math.round(el.clientHeight * 0.75)));
    }
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ top: direction * Math.round(el.clientHeight * 0.7), behavior: calm ? 'auto' : 'smooth' });
  };

  // Repaint after undo, redo, erase, clear or a restored draft (a finished stroke is already on the canvas).
  useEffect(() => {
    if (g.skipPaint) {
      g.skipPaint = false;
      return;
    }
    const ctx = context();
    if (ctx && sheetWidth && !g.stroke) doc.paint(ctx, sheetWidth, height, inkColor());
    // `height` is not a dependency: the layout effect above repaints when the size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, version]);

  useEffect(() => () => clearTimeout(g.advance), [g]);

  // ------------------------------------------------------------------ pointers

  const pointAt = (event: PointerEvent) => {
    const rect = g.rect!;
    // a captured pointer can travel outside the sheet: keep the ink on it
    return {
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
      p: event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5,
    };
  };

  const eraseAt = (event: PointerEvent) => {
    const { x, y } = pointAt(event);
    if (doc.eraseAt(x, y, ERASER_RADIUS, g.erased)) {
      const ctx = context();
      if (ctx) doc.paint(ctx, sheetWidth, height, inkColor());
    }
  };

  const abandonStroke = () => {
    if (g.pointer !== -1) {
      try {
        canvas.current?.releasePointerCapture(g.pointer);
      } catch {
        /* already released */
      }
    }
    if (g.erasing) doc.commitErase(g.erased);
    g.stroke = null;
    g.erasing = false;
    g.erased = [];
    g.pointer = -1;
    setWriting(false);
    const ctx = context();
    if (ctx) doc.paint(ctx, sheetWidth, height, inkColor());
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const native = event.nativeEvent;
    const now = performance.now();
    const type = native.pointerType;

    if (type === 'touch') {
      g.touches.set(native.pointerId, { x: native.clientX, y: native.clientY });
      const palm = now < g.penUntil || (g.pointer !== -1 && g.stroke?.pen);
      if (palm) return; // a hand resting on the screen while the stylus writes
      if (penSeen && !fingerDraws) {
        g.panning = true; // with a stylus in use, a finger scrolls
        return;
      }
      if (g.touches.size >= 2) {
        // second finger: this is a scroll, not writing; drop the mark the first finger started
        if (g.pointer !== -1) abandonStroke();
        g.panning = true;
        return;
      }
      if (g.panning) return;
    }
    if (type === 'mouse' && native.button !== 0) return;
    if (g.pointer !== -1) return;
    if (type === 'pen') {
      g.penUntil = now + PALM_GUARD_MS;
      if (!penSeen) {
        setPenSeen(true);
        setFingerDraws(false);
      }
    }

    event.preventDefault();
    clearTimeout(g.advance);
    g.rect = event.currentTarget.getBoundingClientRect();
    g.pointer = native.pointerId;
    try {
      event.currentTarget.setPointerCapture(native.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    // The eraser end of a stylus reports button 5 / buttons 32; its side (barrel) button reports buttons 2.
    g.erasing =
      tool === 'eraser' || native.button === 5 || (native.buttons & 32) === 32 || (type === 'pen' && (native.buttons & 2) === 2);
    if (g.erasing) {
      g.erased = [];
      eraseAt(native);
    } else {
      g.stroke = doc.begin(pointAt(native), type === 'pen');
    }
    setWriting(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const native = event.nativeEvent;
    if (native.pointerType === 'touch' && g.panning) {
      const last = g.touches.get(native.pointerId);
      // with two fingers down each one reports the same movement: follow the first so the sheet does not move twice
      const leads = g.touches.keys().next().value === native.pointerId;
      if (last && leads && scroller.current && performance.now() >= g.penUntil) {
        scroller.current.scrollTop -= native.clientY - last.y;
        scroller.current.scrollLeft -= native.clientX - last.x;
      }
      g.touches.set(native.pointerId, { x: native.clientX, y: native.clientY });
      return;
    }
    if (native.pointerId !== g.pointer) return;
    event.preventDefault();
    if (native.pointerType === 'pen') g.penUntil = performance.now() + PALM_GUARD_MS;

    // Browsers batch fast movement into one event; the coalesced samples keep quick writing smooth.
    const samples = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const events = samples.length ? samples : [native];

    if (g.erasing) {
      for (const sample of events) eraseAt(sample);
      return;
    }
    const stroke = g.stroke;
    const ctx = context();
    if (!stroke || !ctx) return;
    const color = inkColor();
    for (const sample of events) {
      if (doc.extend(stroke, pointAt(sample))) doc.paintLatest(ctx, stroke, color);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const native = event.nativeEvent;
    if (native.pointerType === 'touch') {
      g.touches.delete(native.pointerId);
      if (g.touches.size === 0) g.panning = false;
    }
    if (native.pointerId !== g.pointer) return;
    if (native.pointerType === 'pen') g.penUntil = performance.now() + PALM_GUARD_MS;
    const stroke = g.stroke;
    g.pointer = -1;
    g.stroke = null;
    setWriting(false);

    if (g.erasing) {
      g.erasing = false;
      doc.commitErase(g.erased);
      g.erased = [];
      return;
    }
    if (!stroke) return;
    if (native.type === 'pointercancel') {
      // the system took the gesture (e.g. a notification swipe): do not leave half a mark behind
      const ctx = context();
      if (ctx) doc.paint(ctx, sheetWidth, height, inkColor());
      return;
    }
    const ctx = context();
    if (ctx) doc.paintEnd(ctx, stroke, inkColor());
    g.skipPaint = true;
    doc.commit(stroke);

    // When the student reaches the bottom of what is visible, move the page up for them after a pause.
    const view = scroller.current;
    if (view && stroke.y1 > view.scrollTop + view.clientHeight - 44) {
      clearTimeout(g.advance);
      g.advance = setTimeout(() => {
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (g.pointer === -1) view.scrollBy({ top: Math.round(view.clientHeight * 0.5), behavior: calm ? 'auto' : 'smooth' });
      }, 650);
    }
  };

  // The browser can take the pointer away mid-stroke (window loses focus, a system gesture). Keep what was
  // written so far instead of dropping it.
  const onLostCapture = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== g.pointer) return;
    const stroke = g.stroke;
    g.pointer = -1;
    g.stroke = null;
    setWriting(false);
    if (g.erasing) {
      g.erasing = false;
      doc.commitErase(g.erased);
      g.erased = [];
    } else if (stroke) {
      const ctx = context();
      if (ctx) doc.paintEnd(ctx, stroke, inkColor());
      g.skipPaint = true;
      doc.commit(stroke);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
    event.preventDefault();
    if (event.shiftKey) doc.redo();
    else doc.undo();
  };

  const tools =
    'text-brand hover:bg-socrates-chip-hover flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40';
  const scrollButton =
    'border-socrates-line bg-surface text-brand pointer-events-auto flex size-8 items-center justify-center rounded-full border opacity-90 shadow-sm';
  const empty = doc.isEmpty && !writing;

  return (
    <div className={cx('flex min-h-0 flex-col gap-2', expanded && 'flex-1', className)}>
      <div className={cx('relative flex min-h-0 flex-col', expanded && 'flex-1')}>
        <div
          ref={scroller}
          onScroll={updateReach}
          className={cx(
            'bg-socrates-soft relative overflow-auto overscroll-contain rounded-[14px]',
            expanded ? 'min-h-0 flex-1' : 'h-[min(40dvh,280px)]',
          )}
        >
          <canvas
            ref={canvas}
            role="img"
            tabIndex={0}
            aria-label={doc.isEmpty ? 'Handwriting area, empty' : 'Handwriting area with your writing'}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onLostPointerCapture={onLostCapture}
            onKeyDown={onKeyDown}
            onContextMenu={(event) => event.preventDefault()}
            style={{
              width: sheetWidth || '100%',
              height,
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            className={cx('text-socrates-ink block outline-none', tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair')}
          />
          {empty && (
            <p
              aria-hidden
              className="text-socrates-faint pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] leading-5"
            >
              Write here with your finger, stylus or trackpad
            </p>
          )}
        </div>
        {/* Moving around a long answer: buttons for a finger; a wheel, trackpad or two fingers also scroll. */}
        <div className="pointer-events-none absolute top-2 right-2 bottom-2 flex flex-col justify-between">
          <span>
            {reach.up && (
              <button type="button" aria-label="Scroll up" title="Scroll up" onClick={() => move(-1)} className={scrollButton}>
                <ChevronUp aria-hidden className="size-4" />
              </button>
            )}
          </span>
          <span>
            {(reach.down || canAddRoom) && (
              <button
                type="button"
                aria-label={reach.down ? 'Scroll down' : 'Add more space'}
                title={reach.down ? 'Scroll down' : 'Add more space below'}
                onClick={() => move(1)}
                className={scrollButton}
              >
                {reach.down ? <ChevronDown aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
              </button>
            )}
          </span>
        </div>
      </div>
      {full && (
        <p role="status" className="text-socrates-muted px-1 text-[11.5px] leading-4">
          This page is full. Send it, then carry on in your next message.
        </p>
      )}
      <div role="toolbar" aria-label="Handwriting tools" className="flex items-center gap-1">
        <div role="group" aria-label="Tool" className="bg-socrates-chip flex rounded-full">
          <button
            type="button"
            aria-label="Pen"
            aria-pressed={tool === 'pen'}
            title="Pen"
            onClick={() => setTool('pen')}
            disabled={disabled}
            className={cx(tools, tool === 'pen' && 'bg-brand text-on-brand hover:bg-brand')}
          >
            <PenLine aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Eraser"
            aria-pressed={tool === 'eraser'}
            title="Eraser: rub out a whole stroke"
            onClick={() => setTool('eraser')}
            disabled={disabled}
            className={cx(tools, tool === 'eraser' && 'bg-brand text-on-brand hover:bg-brand')}
          >
            <Eraser aria-hidden className="size-4" />
          </button>
        </div>
        <button type="button" aria-label="Undo" title="Undo" onClick={() => doc.undo()} disabled={disabled || !doc.canUndo} className={tools}>
          <Undo2 aria-hidden className="size-4" />
        </button>
        <button type="button" aria-label="Redo" title="Redo" onClick={() => doc.redo()} disabled={disabled || !doc.canRedo} className={tools}>
          <Redo2 aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Clear writing"
          title="Clear (you can undo this)"
          onClick={() => doc.clear()}
          disabled={disabled || doc.isEmpty}
          className={tools}
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
        {penSeen && (
          <button
            type="button"
            aria-pressed={fingerDraws}
            title={fingerDraws ? 'Fingers write. Tap so fingers only scroll.' : 'Fingers scroll while you use the stylus. Tap to write with a finger too.'}
            onClick={() => setFingerDraws((on) => !on)}
            className={cx(
              'flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium',
              fingerDraws ? 'bg-brand text-on-brand' : 'bg-socrates-chip text-brand',
            )}
          >
            <Hand aria-hidden className="size-3.5" />
            Finger
          </button>
        )}
        <span className="flex-1" />
        {toolbarSlot}
        {onExpandedChange && (
          <button
            type="button"
            aria-label={expanded ? 'Smaller writing area' : 'Bigger writing area'}
            title={expanded ? 'Smaller' : 'Full screen'}
            onClick={() => onExpandedChange(!expanded)}
            className={tools}
          >
            {expanded ? <Minimize2 aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
