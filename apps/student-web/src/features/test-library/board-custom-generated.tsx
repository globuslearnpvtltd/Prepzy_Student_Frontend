'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { BookOpen, Rocket, Target, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * "Test Generated Successfully!" after a board custom test is generated (previous app's CustomExamCreationSuccessModal):
 * blurred page behind (as before; z 52/53 so it sits above the custom-test dialog at 51 and blurs it too), purple header with a trophy, a summary card (course, difficulty, selected topics), then "Take Test Now" (opens the
 * test) or "Save for Later" (back to Assessments, where it is listed under Saved Tests). Closing it saves for later.
 */
export function BoardCustomGenerated({
  open,
  course,
  difficulty,
  topicsCount,
  onTakeNow,
  onSaveForLater,
}: {
  open: boolean;
  course: string;
  difficulty: string;
  topicsCount: number;
  onTakeNow: () => void;
  onSaveForLater: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onSaveForLater()}>
      <DialogContent
        onPointerDownOutside={(event) => event.preventDefault()}
        overlayClassName="z-[52] bg-generated-scrim/30 backdrop-blur-sm"
        className="z-[53] flex max-h-[90%] w-[95%] max-w-[512px] flex-col gap-6 overflow-y-auto rounded-[24px] p-0 font-sans md:w-[512px]"
      >
        <div className="from-brand-700 to-generated-deep flex flex-col items-center gap-[14px] rounded-t-[24px] bg-linear-to-r p-8 text-center">
          <span className="bg-generated-ring hidden size-16 items-center justify-center rounded-full md:flex">
            <Trophy aria-hidden className="text-on-brand size-[33px]" strokeWidth={2.2} />
          </span>
          <DialogTitle className="text-on-brand m-0 text-[24px] leading-[30px] font-bold md:leading-6">
            Test Generated Successfully!
          </DialogTitle>
          <DialogDescription className="text-generated-tint m-0 text-[14px] leading-[14px]">
            What would you like to do next?
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-5 p-6 pt-0">
          <div className="border-generated-line bg-generated-soft flex flex-col gap-4 rounded-[20px] border-2 p-[22px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-[5px]">
                <p className="text-generated-label m-0 text-[12px] leading-4 font-semibold">Course</p>
                <p className="m-0 text-[16px] leading-[19.2px] font-bold text-neutral-950">{titleCase(course)}</p>
              </div>
              <p className="bg-generated-primary text-on-brand m-0 shrink-0 rounded-full px-3 py-1.5 text-[12px] leading-4 font-bold">
                {titleCase(difficulty)}
              </p>
            </div>
            <div className="border-generated-line bg-surface flex items-center gap-2 rounded-2xl border p-[17px]">
              <span className="bg-generated-chip flex size-8 items-center justify-center rounded-full">
                <Target aria-hidden className="text-generated-primary size-4" />
              </span>
              <div className="flex flex-col gap-[5px]">
                <p className="text-generated-label m-0 text-[12px] leading-4 font-semibold">Selected Topics</p>
                <p className="text-generated-count m-0 text-[20px] leading-6 font-black">{topicsCount}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Choice
              onClick={onTakeNow}
              className="bg-generated-primary"
              icon={<Rocket aria-hidden className="text-on-brand size-6" />}
              iconClass="bg-generated-ring"
              title="Take Test Now"
              titleClass="text-on-brand"
              hint="Start immediately"
              hintClass="text-generated-hint"
            />
            <Choice
              onClick={onSaveForLater}
              className="border-generated-border bg-surface border-2"
              icon={<BookOpen aria-hidden className="size-6 text-neutral-600" />}
              iconClass="bg-neutral-100"
              title="Save for Later"
              titleClass="text-neutral-700"
              hint="Add to Tests & Quizzes"
              hintClass="text-generated-label"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Choice(props: {
  onClick: () => void;
  className: string;
  icon: ReactNode;
  iconClass: string;
  title: string;
  titleClass: string;
  hint: string;
  hintClass: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex items-center gap-4 rounded-[20px] p-[17px] text-left transition-transform duration-300 ease-in-out hover:scale-105 ${props.className}`}
    >
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${props.iconClass}`}>
        {props.icon}
      </span>
      <span className="flex flex-col gap-[5px]">
        <span className={`text-[16px] leading-[19.2px] font-bold ${props.titleClass}`}>{props.title}</span>
        <span className={`text-[12px] leading-[15.6px] font-medium ${props.hintClass}`}>{props.hint}</span>
      </span>
    </button>
  );
}
