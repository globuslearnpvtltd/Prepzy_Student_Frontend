'use client';

import { Skeleton } from '@prepzy/design-system';
import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { isApiError, userMessage } from '@/shared/lib/errors';
import { SYLLABUS_COPY, type SyllabusKind } from '../api';
import { useSyllabusContext, useSyllabusPdf } from '../hooks';
import { PdfViewer } from './pdf-viewer';
import { SyllabusSubjectList } from './subject-picker';

const titleCase = (value: string) => value.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function Message({ title }: { title: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <span className="bg-brand-50 text-brand flex size-14 items-center justify-center rounded-full">
        <FileText aria-hidden className="size-7" />
      </span>
      <p className="text-[16px] font-medium text-neutral-600">{title}</p>
    </div>
  );
}

/**
 * /[exam]/syllabus and /[exam]/pyq-trends (previous app's /syllabus and /trend-analysis): the PDF of one subject of
 * the student's class, "Subject · Class" on top. Without `?subject_id=` the page lists the subjects to pick from.
 */
export function SyllabusScreen({ kind, subjectId: rawSubjectId }: { kind: SyllabusKind; subjectId: string | null }) {
  const router = useRouter();
  const subjectId = rawSubjectId && /^\d+$/.test(rawSubjectId) ? rawSubjectId : null;
  const { exam, classId, isPending, error } = useSyllabusContext();
  const pdf = useSyllabusPdf(kind, subjectId);
  const copy = SYLLABUS_COPY[kind];

  let body: ReactNode;
  if (error) body = <Message title={userMessage(error)} />;
  else if (isPending) body = <Skeleton aria-label="Loading" className="h-[60vh] w-full rounded-xl" />;
  else if (classId === null) body = <Message title={`${copy.label} is available with an active plan.`} />;
  else if (!subjectId)
    body = (
      <section aria-labelledby="pick-subject" className="flex flex-col gap-4">
        <h2 id="pick-subject" className="text-[20px] font-semibold text-neutral-800">
          Select Subject for <span className="text-brand">{copy.pickerTitle}</span>
        </h2>
        <SyllabusSubjectList kind={kind} columns={3} onPick={(subject) => router.push(copy.href(exam.slug, subject.id))} />
      </section>
    );
  else if (pdf.isPending) body = <Skeleton aria-label="Loading" className="h-[60vh] w-full rounded-xl" />;
  else if (pdf.isError)
    body = <Message title={isApiError(pdf.error) && pdf.error.status === 404 ? copy.empty : userMessage(pdf.error)} />;
  else body = <PdfViewer url={pdf.data.url} title={`${copy.kicker}: ${titleCase(pdf.data.subjectName)}`} />;

  const heading = pdf.data ? [pdf.data.subjectName, pdf.data.className].filter(Boolean).map(titleCase).join(' · ') : copy.label;
  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        {pdf.data && <p className="text-brand text-[13px] font-semibold tracking-wide uppercase">{copy.kicker}</p>}
        <h1 className="md:text-brand text-[24px] leading-8 font-bold text-neutral-950 md:text-[32px] md:leading-10">{heading}</h1>
      </header>
      {body}
    </div>
  );
}
