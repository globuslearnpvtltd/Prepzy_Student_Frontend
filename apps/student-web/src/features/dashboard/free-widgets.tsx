'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@prepzy/design-system';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Crown, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { routes } from '@/shared/config/routes';
import { dashboardApi } from './api';
import { SectionError, useDashboardContext } from './widget-kit';

/** Board widgets shown only to a student without an active plan (previous app's CBSEDashboard free state). */

const PYQ_FALLBACK = '/illustrations/dashboard/pyq-paper.webp';

/** "Get Ready For Your Exams": locked PYQ papers that lead to the upgrade prompt. */
export function GetReadyExam() {
  const { exam, noPlan } = useDashboardContext();
  const [upgrade, setUpgrade] = useState(false);
  const papers = useQuery({
    queryKey: ['dashboard', exam.slug, 'pyq-teasers'],
    queryFn: () => dashboardApi.pyqTeasers(exam),
    enabled: noPlan,
  });
  if (!noPlan) return null;
  return (
    <section aria-labelledby="get-ready" className="flex flex-col gap-2.5">
      <h2 id="get-ready" className="text-brand text-[18px] leading-[18px] font-semibold md:text-[22px] md:leading-[22px]">
        Get Ready For Your Exams
      </h2>
      {papers.isError ? (
        <SectionError title="Failed to fetch exams" error={papers.error} />
      ) : papers.isPending ? null : papers.data.length === 0 ? (
        <p className="text-foreground-muted mt-3 text-sm">No Exams Available</p>
      ) : (
        <ul className="mt-3 flex w-full gap-3 overflow-x-auto">
          {papers.data.map((paper) => (
            <li
              key={`${paper.subjectId}-${paper.year}`}
              className="border-info-soft bg-surface flex h-[174px] w-full shrink-0 rounded-[20px] border-[1.5px] p-2.5 md:max-w-[48%] md:min-w-[48%]"
            >
              <span className="relative h-full w-[100px] shrink-0 overflow-hidden rounded-xl md:w-[182px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote paper art from the CMS */}
                <img src={paper.image ?? PYQ_FALLBACK} alt="" className="size-full object-cover" />
                <span className="bg-neutral-900/60 absolute inset-0 flex items-center justify-center backdrop-blur-[9.5px]">
                  <Lock aria-label="Locked" className="text-on-brand size-9" />
                </span>
              </span>
              <div className="flex flex-1 flex-col gap-[13px] p-6">
                <div className="flex gap-2">
                  {[paper.className, paper.year].map((tag) => (
                    <span key={tag} className="border-brand bg-brand-75 text-brand rounded-md border px-2 py-1.5 text-[8px] leading-2 font-medium md:text-[11px] md:leading-3">
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-[16px] leading-5 font-semibold text-neutral-900 md:text-[20px]">
                  {paper.title.length > 14 ? `${paper.title.slice(0, 14)}...` : paper.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setUpgrade(true)}
                  className="border-brand text-brand flex w-fit items-center gap-1 rounded-[10px] border-[1.5px] px-3 py-2 text-[10px] leading-2.5 font-semibold md:h-[39px] md:text-xs"
                >
                  Start Now &gt;
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <UpgradeDialog open={upgrade} onOpenChange={setUpgrade} />
    </section>
  );
}

function UpgradeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { exam } = useDashboardContext();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 overflow-hidden p-0">
        <div className="from-brand-400 to-brand-800 flex h-[189px] items-center justify-center bg-linear-to-br">
          <span className="bg-accent-400 flex size-20 items-center justify-center rounded-full">
            <Crown aria-hidden className="text-on-brand size-10" />
          </span>
        </div>
        <div className="flex flex-col gap-3 px-6 pt-8 pb-6 text-center">
          <DialogTitle className="text-xl font-semibold text-neutral-900">Upgrade your Plan</DialogTitle>
          <DialogDescription className="mb-5 text-sm text-neutral-600">
            Upgrade to the Comprehensive Plan to access both learning and exam prep in one go.
          </DialogDescription>
          <Link
            href={routes.plans(exam.slug)}
            className="bg-info-600 text-on-brand flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium"
          >
            Upgrade Now <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Dear Student … BUY Plan Now" banner at the bottom of the free dashboard. */
export function ChooseYourPlan() {
  const { exam, noPlan } = useDashboardContext();
  if (!noPlan) return null;
  return (
    <section aria-label="Choose your plan" className="mt-8 md:mt-[50px]">
      <div className="from-brand via-brand to-accent-400 relative h-[380px] w-full overflow-hidden rounded-[20px] bg-linear-to-r from-0% via-55% to-100% p-[30px] md:h-[246px] md:bg-linear-135">
        <div className="relative z-10 flex flex-col gap-[18px] md:w-1/2">
          <p className="text-on-brand text-sm leading-6 font-semibold md:text-[20px]">Dear Student,</p>
          <p className="text-on-brand text-sm leading-[22px] md:text-[16px]">
            To access <strong className="font-semibold">Assessments </strong>features like past papers, mock tests, and performance tracking —{' '}
            <br />
            <strong className="font-semibold underline">BUY Plan Now.</strong>
          </p>
        </div>
        <div className="relative z-10 mt-0 inline-block md:mt-[18px]">
          <span aria-hidden className="border-on-brand absolute inset-0 translate-x-1 translate-y-1 rounded-[14px] border-2" />
          <Link
            href={routes.plans(exam.slug)}
            className="border-on-brand bg-brand text-on-brand relative flex w-[198px] items-center justify-center rounded-[14px] border-2 px-6 py-2 font-semibold md:h-[54px]"
          >
            Upgrade Now
          </Link>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative SVG */}
        <img
          src="/illustrations/dashboard/choose-plan-rocket.svg"
          alt=""
          className="absolute top-[200px] right-0 h-[200px] w-[345px] md:top-0 md:h-[246px] md:w-[551px]"
        />
      </div>
    </section>
  );
}
