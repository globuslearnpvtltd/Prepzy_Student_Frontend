'use client';

import { Spinner, cx } from '@prepzy/design-system';
import { useMutation } from '@tanstack/react-query';
import Image from '@tiptap/extension-image';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Camera, Check, ImagePlus, Keyboard, Mic, PenLine, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { clearInkDraft, InkPad, useInkDoc, useInkVersion } from '@/features/ink';
import { userMessage } from '@/shared/lib/errors';
import { MATH_SYMBOLS } from '@/shared/ui/math-symbols';
import { HANDWRITING_ALT, htmlImageUrls, withAnswerImage, writtenToHtml } from '../attempt';
import type { UploadedImage, WrittenAnswer } from '../model';
import { useVoiceAnswer } from '../transcribe';
import { MAX_ANSWER_IMAGES, TOO_MANY_IMAGES, uploadAnswerImage } from '../upload';

const iconButton =
  'border-info-700 bg-surface text-info-700 flex size-9 items-center justify-center rounded-full border hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50';

/** The editor's state as a WrittenAnswer: HTML for grading, plain text for "answered", images still shown. */
export function editorAnswer(editor: Pick<Editor, 'getHTML' | 'getText' | 'isEmpty'>, images: UploadedImage[]): WrittenAnswer {
  const html = editor.isEmpty ? '' : editor.getHTML();
  const shown = htmlImageUrls(html);
  return { text: editor.getText().trim(), html, images: images.filter((img) => shown.includes(img.url)) };
}

export interface RichAnswerBoxProps {
  label: string;
  value: WrittenAnswer;
  onChange: (value: WrittenAnswer) => void;
  /** Keeps unfinished handwriting of this question across a reload (attempt + question). Without it the pad still works. */
  inkDraftKey?: string;
}

/**
 * Written answer (previous app's DescriptiveAnswerBox): TipTap rich text with inline photos (upload or
 * camera), voice typing and an "fx" symbol palette in place of the old on-screen keyboard. Loaded lazily by
 * ./answer-box so only the test player pays for the editor.
 *
 * The pen opens a writing pad inside the same box: each handwritten page is uploaded like a photo and goes
 * into the answer as an inline picture (alt "Handwritten answer"), so the grader and the result screens see
 * it exactly as they see photos. Students can type and write in the same answer.
 */
export default function RichAnswerBox({ label, value, onChange, inkDraftKey }: RichAnswerBoxProps) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [symbols, setSymbols] = useState(false);
  const latest = useRef(value);
  latest.current = value;
  const emitted = useRef<string | null>(null);

  const emit = (editor: Editor, images = latest.current.images) => {
    const next = editorAnswer(editor, images);
    emitted.current = next.html ?? '';
    onChange(next);
  };

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value.html ?? writtenToHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: 'rich-text min-h-[160px] w-full flex-1 p-3 pb-14 text-sm outline-none',
      },
    },
    onUpdate: ({ editor: e }) => emit(e),
  });

  // An answer restored after the editor mounted (e.g. the saved attempt arrives) replaces the content.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const incoming = value.html ?? writtenToHtml(value);
    if (incoming === emitted.current || incoming === (editor.isEmpty ? '' : editor.getHTML())) return;
    editor.commands.setContent(incoming, false);
  }, [editor, value]);

  // ---- writing pad ----
  const ink = useInkDoc(inkDraftKey);
  const inkVersion = useInkVersion(ink);
  const [inkOpen, setInkOpen] = useState(false);
  const [inkFull, setInkFull] = useState(false);
  const [inkBusy, setInkBusy] = useState(false);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const addingInk = useRef(false);

  // An unfinished page (a draft restored after a reload) opens straight away, so it isn't forgotten.
  const draftChecked = useRef(false);
  useEffect(() => {
    if (draftChecked.current || ink.isEmpty) return;
    draftChecked.current = true;
    setInkOpen(true);
  }, [ink, inkVersion]);

  /**
   * Uploads the page and puts it at the end of the answer. `detached`: the box has left the screen (next
   * question), so the answer is updated without the editor. Returns false when it failed (the page is kept).
   */
  const addInk = async (detached = false): Promise<boolean> => {
    if (ink.isEmpty) return true;
    if (addingInk.current) return false;
    if (latest.current.images.length >= MAX_ANSWER_IMAGES) {
      toast.error(TOO_MANY_IMAGES);
      return false;
    }
    addingInk.current = true;
    if (!detached) setInkBusy(true);
    try {
      const file = await ink.toFile();
      if (!file) return true;
      const image = await uploadAnswerImage(file);
      const current = editorRef.current;
      if (!detached && current && !current.isDestroyed) {
        current.chain().focus('end').setImage({ src: image.url, alt: HANDWRITING_ALT }).createParagraphNear().run();
        emit(current, [...latest.current.images, image]);
      } else {
        onChangeRef.current(withAnswerImage(latest.current, image, HANDWRITING_ALT));
        clearInkDraft(inkDraftKey); // the pad's own autosave is gone with it
      }
      ink.reset();
      return true;
    } catch (error) {
      toast.error(userMessage(error, "Your handwriting couldn't be added. Please try again."));
      return false;
    } finally {
      addingInk.current = false;
      if (!detached) setInkBusy(false);
    }
  };
  const addInkRef = useRef(addInk);
  addInkRef.current = addInk;

  // Moving to another question with writing still on the pad adds it to this answer (it is not thrown away).
  // Deferred a tick so a development remount (Strict Mode) doesn't count as leaving.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current && !ink.isEmpty) void addInkRef.current(true);
      }, 0);
    };
  }, [ink]);

  const closeInk = async () => {
    if (!(await addInk())) return;
    setInkFull(false);
    setInkOpen(false);
  };

  // Full screen: Escape steps back to the in-box pad, and the page behind doesn't scroll.
  useEffect(() => {
    if (!inkFull) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setInkFull(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [inkFull]);

  const upload = useMutation({
    mutationFn: uploadAnswerImage,
    onSuccess: (image) => {
      if (!editor) return;
      editor.chain().focus('end').setImage({ src: image.url, alt: 'Uploaded answer' }).createParagraphNear().run();
      emit(editor, [...latest.current.images, image]);
    },
    onError: (error) => toast.error(userMessage(error, 'Upload failed. Please try again.')),
  });

  const voice = useVoiceAnswer(
    (text) => {
      if (!editor) return;
      editor.chain().focus('end').insertContent(editor.isEmpty ? text : ` ${text}`).run();
    },
    (error) => toast.error(userMessage(error, 'Failed to transcribe audio')),
  );

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const room = MAX_ANSWER_IMAGES - latest.current.images.length;
    const files = Array.from(event.target.files ?? []);
    if (files.length > room) toast.error(TOO_MANY_IMAGES);
    for (const file of files.slice(0, Math.max(0, room))) upload.mutate(file);
    event.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border-info-700 bg-info-25 relative flex min-h-[220px] flex-col rounded-[14px] border-[1.5px]">
        {editor ? (
          <EditorContent editor={editor} className={inkOpen ? 'hidden' : 'flex max-h-[420px] flex-1 flex-col overflow-y-auto'} />
        ) : (
          <div aria-busy="true" className={inkOpen ? 'hidden' : 'min-h-[160px] flex-1'} />
        )}
        {inkOpen && (
          <div
            role={inkFull ? 'dialog' : undefined}
            aria-modal={inkFull ? true : undefined}
            aria-label={inkFull ? 'Write your answer' : undefined}
            className={cx(
              'flex flex-col gap-2',
              inkFull
                ? 'bg-surface fixed inset-0 z-[80] px-3.5 pt-[max(12px,env(safe-area-inset-top))] pb-[max(10px,env(safe-area-inset-bottom))]'
                : 'p-2 sm:p-3',
            )}
          >
            <p className="text-foreground-muted px-1 text-xs">
              Write your answer by hand. <span className="font-semibold">Add to answer</span> puts this page in your answer; use the pen
              again for another page. You can type as well.
            </p>
            <InkPad
              doc={ink}
              expanded={inkFull}
              onExpandedChange={setInkFull}
              disabled={inkBusy}
              toolbarSlot={
                <>
                  <button
                    type="button"
                    aria-label="Back to typing"
                    title={ink.isEmpty ? 'Keyboard' : 'Add this page and go back to typing'}
                    onClick={() => void closeInk()}
                    disabled={inkBusy}
                    className="text-brand hover:bg-socrates-chip-hover flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
                  >
                    <Keyboard aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    // Back to the answer, which now shows the page (it was hidden behind the pad).
                    onClick={() => void closeInk()}
                    aria-label="Add to answer"
                    disabled={inkBusy || ink.isEmpty}
                    className="bg-info-700 text-on-brand flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    {inkBusy ? <Spinner size="sm" label="Adding" /> : <Check aria-hidden className="size-3.5" />}
                    {/* Short on phones so the pad's toolbar fits on one line. */}
                    <span className="sm:hidden">Add</span>
                    <span className="hidden sm:inline">Add to answer</span>
                  </button>
                </>
              }
            />
          </div>
        )}
        <div className={inkOpen ? 'hidden' : 'absolute right-4 bottom-4 flex items-center gap-2.5'}>
          <button
            type="button"
            className={iconButton}
            aria-label="Write by hand"
            title="Write by hand"
            disabled={!editor}
            onClick={() => {
              setSymbols(false);
              setInkOpen(true);
            }}
          >
            <PenLine aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            className={cx(iconButton, 'text-[13px] font-semibold italic', symbols && 'bg-info-700 text-on-brand')}
            aria-label="Math symbols"
            aria-expanded={symbols}
            onClick={() => setSymbols((open) => !open)}
          >
            fx
          </button>
          {voice.supported && (
            <button
              type="button"
              className={cx(iconButton, voice.state === 'recording' && 'bg-danger text-on-brand border-danger')}
              aria-label={voice.state === 'recording' ? 'Stop recording' : 'Answer by voice'}
              aria-pressed={voice.state === 'recording'}
              disabled={voice.state === 'transcribing'}
              onClick={() => (voice.state === 'recording' ? voice.stop() : void voice.start())}
            >
              {voice.state === 'transcribing' ? (
                <Spinner size="sm" label="Transcribing" />
              ) : voice.state === 'recording' ? (
                <Square aria-hidden className="size-4" />
              ) : (
                <Mic aria-hidden className="size-4" />
              )}
            </button>
          )}
          <button
            type="button"
            className={iconButton}
            aria-label="Add photo of your answer"
            disabled={upload.isPending || !editor}
            onClick={() => gallery.current?.click()}
          >
            {upload.isPending ? <Spinner size="sm" label="Uploading" /> : <ImagePlus aria-hidden className="size-4" />}
          </button>
          <button
            type="button"
            className={cx(iconButton, 'md:hidden')}
            aria-label="Take a photo"
            disabled={upload.isPending || !editor}
            onClick={() => camera.current?.click()}
          >
            <Camera aria-hidden className="size-4" />
          </button>
        </div>
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={onFile} data-testid="answer-gallery" />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      </div>
      {symbols && !inkOpen && (
        <div role="group" aria-label="Math symbols" className="border-info-50 bg-surface flex flex-wrap gap-1.5 rounded-[14px] border p-2">
          {MATH_SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              aria-label={`Insert ${symbol}`}
              // Keep the editor's selection: insert where the student was typing.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().insertContent(symbol).run()}
              className="bg-info-25 text-info-700 hover:bg-info-50 min-w-8 rounded-sm px-2 py-1 text-[14px]"
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
      {voice.state === 'recording' && (
        <p className="text-danger text-xs font-medium" role="status">
          Recording… tap the stop button when you&apos;re done.
        </p>
      )}
    </div>
  );
}
