'use client';

import { Spinner, cx } from '@prepzy/design-system';
import { useMutation } from '@tanstack/react-query';
import Image from '@tiptap/extension-image';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Camera, ImagePlus, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { userMessage } from '@/shared/lib/errors';
import { MATH_SYMBOLS } from '@/shared/ui/math-symbols';
import { htmlImageUrls, writtenToHtml } from '../attempt';
import type { UploadedImage, WrittenAnswer } from '../model';
import { useVoiceAnswer } from '../transcribe';
import { uploadAnswerImage } from '../upload';

const iconButton =
  'border-info-700 bg-surface text-info-700 flex size-9 items-center justify-center rounded-full border hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50';

/** The editor's state as a WrittenAnswer: HTML for grading, plain text for "answered", images still shown. */
export function editorAnswer(editor: Pick<Editor, 'getHTML' | 'getText' | 'isEmpty'>, images: UploadedImage[]): WrittenAnswer {
  const html = editor.isEmpty ? '' : editor.getHTML();
  const shown = htmlImageUrls(html);
  return { text: editor.getText().trim(), html, images: images.filter((img) => shown.includes(img.url)) };
}

/**
 * Written answer (previous app's DescriptiveAnswerBox): TipTap rich text with inline photos (upload or
 * camera), voice typing and an "fx" symbol palette in place of the old on-screen keyboard. Loaded lazily by
 * ./answer-box so only the test player pays for the editor.
 */
export default function RichAnswerBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: WrittenAnswer;
  onChange: (value: WrittenAnswer) => void;
}) {
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
    for (const file of Array.from(event.target.files ?? [])) upload.mutate(file);
    event.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="border-info-700 bg-info-25 relative flex min-h-[220px] flex-col rounded-[14px] border-[1.5px]">
        {editor ? (
          <EditorContent editor={editor} className="flex max-h-[420px] flex-1 flex-col overflow-y-auto" />
        ) : (
          <div aria-busy="true" className="min-h-[160px] flex-1" />
        )}
        <div className="absolute right-4 bottom-4 flex items-center gap-2.5">
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
      {symbols && (
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
