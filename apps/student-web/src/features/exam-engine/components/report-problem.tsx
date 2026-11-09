'use client';

import { Button, cx, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@prepzy/design-system';
import { useMutation } from '@tanstack/react-query';
import { ImagePlus, TriangleAlert, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { userMessage } from '@/shared/lib/errors';
import { REPORT_SECTIONS, reportProblem, type ReportSection } from '../report';
import { RichText } from './rich-text';

/** "Report a problem" link under a reviewed question (previous app's ReportAProblem modal). */
export function ReportProblem({ questionId, questionHtml }: { questionId: string; questionHtml: string }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<ReportSection>('Question');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const descriptionId = useId();
  const fileId = useId();

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const send = useMutation({
    mutationFn: () => reportProblem({ questionId, section, description, image }),
    onSuccess: () => {
      toast.success('Problem reported successfully');
      setOpen(false);
      setDescription('');
      setImage(null);
      setSection('Question');
    },
    onError: (error) => toast.error(userMessage(error, 'Could not send your report. Please try again.')),
  });

  return (
    <>
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(true)} className="text-danger-600 flex items-center gap-2.5 text-sm">
          <TriangleAlert aria-hidden className="size-4" />
          <span className="underline">Report a problem</span>
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[640px]">
          <DialogTitle className="text-info-600 text-center">Report a Problem !</DialogTitle>
          <DialogDescription className="text-foreground text-center">
            Notice something wrong or confusing? Tell us about the issue so we can improve your learning experience.
          </DialogDescription>
          <div className="text-sm font-medium">
            Question : <RichText html={questionHtml} className="inline text-sm" />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">I want to report problem in :</legend>
            <div className="flex flex-wrap gap-2">
              {REPORT_SECTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={section === s}
                  onClick={() => setSection(s)}
                  className={cx('rounded-full border px-3 py-1.5 text-xs', section === s ? 'border-info-600 bg-info-50' : 'border-border')}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-2.5 md:flex-row">
            <div className="w-full md:w-[65%]">
              <label htmlFor={descriptionId} className="mb-2 block text-sm font-medium">
                Describe the issue
              </label>
              <textarea
                id={descriptionId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write your problem here..."
                className="border-border h-20 w-full rounded-lg border p-3 text-sm md:h-40"
              />
            </div>
            <div className="w-full md:w-[35%]">
              <label htmlFor={fileId} className="mb-2 block text-sm font-medium">
                Upload Screenshot (optional)
              </label>
              <label
                htmlFor={fileId}
                className="border-border relative flex h-20 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed md:h-40"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview
                  <img src={preview} alt="Screenshot preview" className="size-full object-contain" />
                ) : (
                  <ImagePlus aria-hidden className="text-foreground-muted size-6" />
                )}
              </label>
              <input id={fileId} type="file" accept="image/*" className="sr-only" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
              {image && (
                <button type="button" onClick={() => setImage(null)} className="text-danger-600 mt-1 flex items-center gap-1 text-xs">
                  <X aria-hidden className="size-3" /> Remove screenshot
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button intent="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => send.mutate()} disabled={!description.trim() || send.isPending}>
              {send.isPending ? 'Sending…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
