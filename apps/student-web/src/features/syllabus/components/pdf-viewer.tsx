'use client';

import { cx, Skeleton } from '@prepzy/design-system';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// pdf.js from cdnjs, as the previous app's syllabus pages loaded it (window.pdfjsLib, the 3.x UMD build).
const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
/** Pages are laid out A4 wide (794 px) at 100%, narrower when the screen is. */
const A4_WIDTH = 794;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const STEP = 0.25;

interface PdfViewport {
  width: number;
  height: number;
}
interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}
interface PdfPage {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => PdfRenderTask;
}
export interface PdfDocument {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
  destroy?: () => unknown;
}
export interface PdfJs {
  getDocument: (src: string) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJs;
  }
}

let loader: Promise<PdfJs> | null = null;

/** Loads pdf.js once per page load (concurrent calls share one script). */
export function loadPdfJs(): Promise<PdfJs> {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  loader ??= new Promise<PdfJs>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) return reject(new Error('pdf.js did not load'));
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('pdf.js did not load'));
    document.head.appendChild(script);
  }).finally(() => {
    // Once loaded, window.pdfjsLib answers; after a failure the next call tries again.
    loader = null;
  });
  return loader;
}

const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));

/** Width the page is drawn at: A4, or the available width when that is narrower, times the zoom. */
export const pageWidth = (available: number, scale: number) => Math.round(Math.min(A4_WIDTH, available > 0 ? available : A4_WIDTH) * scale);

/**
 * One page of a PDF at a time on a canvas, with zoom (50–300%), page navigation and Download (previous app's
 * syllabus / trend-analysis pages). When pdf.js or the file can't be loaded, the PDF is offered as a link instead.
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rendering, setRendering] = useState(false);
  const [available, setAvailable] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocument | null = null;
    setDoc(null);
    setFailed(false);
    setPage(1);
    loadPdfJs()
      .then((lib) => lib.getDocument(url).promise)
      .then((document) => {
        loaded = document;
        if (!cancelled) setDoc(document);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      void loaded?.destroy?.();
    };
  }, [url]);

  // The page follows the frame's width (phones), up to A4.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const style = window.getComputedStyle(element);
      setAvailable(element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [doc]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    let task: PdfRenderTask | null = null;
    let cancelled = false;
    setRendering(true);
    doc
      .getPage(page)
      .then((pdfPage) => {
        const target = canvas.current;
        const context = target?.getContext('2d');
        if (cancelled || !target || !context) return;
        const width = pageWidth(available, scale);
        const ratio = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale: (width / pdfPage.getViewport({ scale: 1 }).width) * ratio });
        target.width = Math.floor(viewport.width);
        target.height = Math.floor(viewport.height);
        target.style.width = `${width}px`;
        task = pdfPage.render({ canvasContext: context, viewport });
        return task.promise;
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, scale, available]);

  const pages = doc?.numPages ?? 0;
  const control = 'flex size-8 items-center justify-center rounded-md text-neutral-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40';

  if (failed)
    return (
      <div role="alert" className="border-line bg-surface flex flex-col items-center gap-3 rounded-xl border-2 px-5 py-10 text-center">
        <p className="text-[15px] font-semibold text-neutral-800">We couldn&apos;t show the PDF here.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand hover:bg-brand-deep text-on-brand flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold"
        >
          <ExternalLink aria-hidden className="size-4" />
          Open PDF
        </a>
      </div>
    );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="bg-neutral-100 flex items-center gap-1 rounded-lg p-1" role="group" aria-label="Zoom">
          <button type="button" className={control} aria-label="Zoom out" disabled={scale <= MIN_SCALE} onClick={() => setScale((s) => clampScale(s - STEP))}>
            <Minus aria-hidden className="size-4" />
          </button>
          <span className="w-12 text-center text-xs font-medium text-neutral-700" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" className={control} aria-label="Zoom in" disabled={scale >= MAX_SCALE} onClick={() => setScale((s) => clampScale(s + STEP))}>
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        {pages > 1 && <Pager page={page} pages={pages} onPage={setPage} compact />}
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand hover:bg-brand-deep text-on-brand flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
        >
          <Download aria-hidden className="size-3.5" />
          Download
        </a>
      </div>

      <div ref={frame} className="bg-neutral-100 flex overflow-auto rounded-xl px-2 py-4 md:px-4 md:py-10">
        {!doc ? (
          <Skeleton aria-label="Loading PDF" className="mx-auto aspect-[1/1.414] w-full max-w-[794px]" />
        ) : (
          <div className="bg-surface relative mx-auto h-fit shrink-0 shadow-lg">
            {rendering && (
              <div className="bg-surface/70 absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
                <span className="border-brand size-8 animate-spin rounded-full border-[3px] border-t-transparent" />
              </div>
            )}
            <canvas ref={canvas} className="block" role="img" aria-label={`${title}, page ${page} of ${pages}`} />
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center">
          <Pager page={page} pages={pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

function Pager({ page, pages, onPage, compact }: { page: number; pages: number; onPage: (page: number) => void; compact?: boolean }) {
  const button = cx(
    'flex items-center justify-center gap-1 font-medium text-neutral-600 transition-colors hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30',
    compact ? 'bg-neutral-100 size-8 rounded-md' : 'px-1 text-sm',
  );
  return (
    <nav
      aria-label={compact ? 'Pages' : 'Pages (bottom)'}
      className={cx('flex items-center gap-2', !compact && 'border-line bg-surface rounded-full border px-4 py-2 shadow-lg')}
    >
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft aria-hidden className="size-4" />
        {!compact && 'Prev'}
      </button>
      <span className="text-xs font-medium whitespace-nowrap text-neutral-500">
        {page} / {pages}
      </span>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        {!compact && 'Next'}
        <ChevronRight aria-hidden className="size-4" />
      </button>
    </nav>
  );
}
