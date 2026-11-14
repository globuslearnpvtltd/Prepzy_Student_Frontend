'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle, Skeleton } from '@prepzy/design-system';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useExam } from '@/shared/hooks/use-exam';
import { userMessage } from '@/shared/lib/errors';
import { SubjectCardGrid } from '@/shared/ui/subject-card';
import { SYLLABUS_COPY, type SyllabusKind, type SyllabusSubject } from '../api';
import { useSyllabusSubjects } from '../hooks';

const titleCase = (value: string) => value.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * The subjects of the student's class that have a PDF of this kind, as subject cards. Shared by the picker and the
 * syllabus page opened without a subject.
 */
export function SyllabusSubjectList({
  kind,
  onPick,
  columns = 2,
  enabled = true,
}: {
  kind: SyllabusKind;
  onPick: (subject: SyllabusSubject) => void;
  columns?: 2 | 3;
  enabled?: boolean;
}) {
  const subjects = useSyllabusSubjects(kind, enabled);
  if (subjects.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 text-sm">
        <p className="text-foreground-muted">{userMessage(subjects.error, "We couldn't load the subjects.")}</p>
        <button
          type="button"
          onClick={() => void subjects.refetch()}
          className="bg-brand hover:bg-brand-deep text-on-brand rounded-full px-4 py-2 text-[12px] font-semibold"
        >
          Try again
        </button>
      </div>
    );
  if (subjects.isPending)
    return (
      <div aria-busy="true" aria-label="Loading subjects" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[96px] w-full rounded-xl" />
        ))}
      </div>
    );
  if (subjects.data.length === 0) return <p className="text-foreground-muted text-sm">No Subjects Available</p>;
  return (
    <SubjectCardGrid
      columns={columns}
      label="Subjects"
      items={subjects.data.map((subject) => ({
        key: subject.id,
        title: titleCase(subject.name),
        subject: subject.name,
        onClick: () => onPick(subject),
      }))}
    />
  );
}

/**
 * "Select Subject for Syllabus / Trends" (previous app's SyllabusModal / TrendsModal): a centred modal from md up, a
 * bottom sheet on phones. Picking a subject opens its PDF page.
 */
export function SyllabusSubjectPicker({
  kind,
  open,
  onOpenChange,
}: {
  kind: SyllabusKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const exam = useExam();
  const router = useRouter();
  const copy = SYLLABUS_COPY[kind];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-0 overflow-hidden p-0 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:w-full max-md:max-w-none max-md:transform-none max-md:rounded-t-[24px] max-md:rounded-b-none md:max-w-[600px] md:rounded-[20px]">
        <div className="flex justify-center pt-2.5 md:hidden" aria-hidden>
          <span className="bg-learn-handle h-1 w-9 rounded-full" />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-4 md:px-7 md:pt-7 md:pb-6">
          <DialogTitle className="text-[20px] font-semibold text-neutral-800">
            Select Subject for <span className="text-brand">{copy.pickerTitle}</span>
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="text-neutral-400 hover:text-neutral-700 shrink-0"
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>
        <DialogDescription className="sr-only">Pick a subject to open its {copy.label.toLowerCase()} PDF.</DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 md:px-7">
          {/* Room for the hover zoom of the cards. */}
          <div className="p-2">
            <SyllabusSubjectList
              kind={kind}
              enabled={open}
              onPick={(subject) => {
                onOpenChange(false);
                router.push(copy.href(exam.slug, subject.id));
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
