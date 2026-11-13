'use client';

import { cx } from '@prepzy/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, Fragment, useMemo, useRef, useState } from 'react';
import { useCurrentUser } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import type { HelpRequest } from '../../api';
import { DESKTOP_QUERY, profileKeys, useHelpRequests, useMediaQuery, useOffline } from '../../hooks';
import { card, ErrorState, formatDay, formatPhone, Icon, OfflineBanner, PageHeading, pageContainer } from '../kit';
import { CallModal, EmailModal, FaqModal, ReportModal, ReportSentModal, RequestModal } from './help-modals';
import { HelpHeadingSkeleton, HelpSkeleton } from './help-states';
import {
  CALL_HOURS,
  FAQS,
  requestNumber,
  searchFaqs,
  searchTokens,
  statusOf,
  TOP_QUESTION_IDS,
  TOPICS,
  type Faq,
  type Topic,
} from './help-data';

type Modal =
  | { kind: 'faq'; faq: Faq }
  | { kind: 'call' }
  | { kind: 'email' }
  | { kind: 'report' }
  | { kind: 'sent'; request: HelpRequest }
  | { kind: 'request'; request: HelpRequest }
  | null;

const listCard = cx(card, 'flex flex-col px-[16px] pt-[14px] pb-[6px] lg:gap-[14px] lg:p-[20px]');
const overline = 'text-neutral-550 text-[11px] leading-normal font-semibold uppercase';

// Phone topic chips use shorter names; the phone home lists three top questions.
const SHORT_TOPIC: Partial<Record<Topic, string>> = { 'Tests and results': 'Tests' };
const MOBILE_HIDDEN_TOP = new Set(['basic-vs-topper']);

function Highlight({ text, tokens, strongClass }: { text: string; tokens: string[]; strongClass: string }) {
  if (tokens.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return (
    <>
      {text.split(pattern).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={strongClass}>
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function QuestionRow({
  faq,
  last,
  className,
  onOpen,
}: {
  faq: Faq;
  last: boolean;
  className?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'flex w-full items-center gap-[12px] py-[12px] text-left',
        !last && 'border-account-line border-b',
        className,
      )}
    >
      <span className="text-account-ink min-w-0 flex-1 text-[14px] font-semibold">{faq.question}</span>
      <Icon name="chevron-right-lg.svg" size={18} />
    </button>
  );
}

interface TalkProps {
  variant: 'mobile' | 'desktop';
  offline: boolean;
  onCall: () => void;
  onEmail: () => void;
  onReport: () => void;
}

/** On phones, Report a problem sits at the bottom of the page instead of in this card. */
const TalkCard = forwardRef<HTMLDivElement, TalkProps>(function TalkCard(
  { variant, offline, onCall, onEmail, onReport },
  ref,
) {
  const mobile = variant === 'mobile';
  const rows = [
    { title: 'Call us', subtitle: CALL_HOURS, name: 'call.svg', onClick: onCall },
    { title: 'Email us', subtitle: 'Reply within a day', name: 'email-us.svg', onClick: onEmail },
  ];
  return (
    <div
      ref={ref}
      className={
        mobile
          ? cx(card, 'flex w-full flex-col px-[16px] pt-[14px] pb-[6px] lg:hidden')
          : cx(card, 'hidden w-[380px] shrink-0 flex-col gap-[14px] p-[20px] lg:flex')
      }
    >
      <p className={overline}>Talk to us</p>
      {rows.map((row, i) => (
        <button
          key={row.title}
          type="button"
          onClick={row.onClick}
          className={cx(
            'flex w-full items-center gap-[12px] py-[12px] text-left',
            i < rows.length - 1 && 'border-account-line border-b',
          )}
        >
          <span className={cx('bg-brand-75 flex shrink-0 rounded-[10px]', mobile ? 'p-[8px]' : 'p-[9px]')}>
            <Icon name={row.name} size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="text-account-ink text-[14px] font-semibold">{row.title}</span>
            <span className="text-neutral-550 text-[12px]">{row.subtitle}</span>
          </span>
          {mobile && <Icon name="chevron-right-lg.svg" size={18} />}
        </button>
      ))}
      {!mobile && (
        <button
          type="button"
          onClick={onReport}
          disabled={offline}
          className="bg-brand hover:bg-account-hover text-on-brand w-full rounded-full px-[16px] py-[9px] text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          Report a problem
        </button>
      )}
    </div>
  );
});

/** Help and support: FAQ search and topics, call / email, Report a problem and the student's requests. */
export function HelpScreen() {
  const exam = useExam();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const loginPhone = formatPhone(user.data?.phone);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const offline = useOffline();
  // FAQs are bundled with the page; only "Your requests" comes from the server (skipped while offline).
  const requestsQuery = useHelpRequests(!offline);
  const requests = requestsQuery.data ?? [];
  const load = offline ? 'ready' : requestsQuery.isPending ? 'loading' : requestsQuery.isError ? 'error' : 'ready';

  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const desktopTalkRef = useRef<HTMLDivElement>(null);
  const mobileTalkRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => searchTokens(query), [query]);
  const searching = tokens.length > 0;
  const results = useMemo(() => (searching ? searchFaqs(query) : []), [searching, query]);

  const listed = topic
    ? FAQS.filter((f) => f.topic === topic)
    : TOP_QUESTION_IDS.map((id) => FAQS.find((f) => f.id === id)).filter((f): f is Faq => !!f);
  const listTitle = topic ? `${topic} · ${listed.length} answer${listed.length === 1 ? '' : 's'}` : 'Top questions';

  const openReport = () => setModal({ kind: 'report' });
  const talkToUs = () => {
    setModal(null);
    // Search hides the phone card, so clear it first.
    if (!desktop) setQuery('');
    setTimeout(
      () =>
        (desktop ? desktopTalkRef : mobileTalkRef).current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }),
      0,
    );
  };

  const handleSent = (request: HelpRequest) => {
    queryClient.setQueryData<HelpRequest[]>(profileKeys.helpRequests, (prev = []) => [
      request,
      ...prev.filter((r) => r.id !== request.id),
    ]);
    setModal({ kind: 'sent', request });
  };

  const talkProps = {
    offline,
    onCall: () => setModal({ kind: 'call' as const }),
    onEmail: () => setModal({ kind: 'email' as const }),
    onReport: openReport,
  };

  return (
    <div className="w-full">
      {offline && (
        <OfflineBanner
          message="You’re offline. Top answers are saved on this device. Report a problem needs internet."
          onRetry={() => {
            if (navigator.onLine) requestsQuery.refetch();
          }}
        />
      )}
      <div className={pageContainer}>
        {load === 'loading' ? (
          <HelpHeadingSkeleton />
        ) : (
          <PageHeading
            backHref={routes.profile(exam.slug)}
            backLabel="Back to My Account"
            title="Help and support"
            intro="Find an answer, or reach us. We reply within a day."
            mobileIntro="Find an answer, or reach us. We reply within a day."
          />
        )}

        {load === 'loading' && <HelpSkeleton />}
        {load === 'error' && (
          <ErrorState
            title="We couldn’t load help"
            text="You can still reach us by call or email."
            onRetry={() => requestsQuery.refetch()}
            linkLabel="Report a problem"
            onLink={openReport}
          />
        )}

        {load === 'ready' && (
          <div className="flex w-full flex-col items-start gap-[16px] lg:flex-row lg:gap-[24px]">
            <div className="flex w-full min-w-0 flex-1 flex-col gap-[16px] lg:gap-[20px]">
              <div className="lg:bg-surface lg:border-account-line flex flex-col gap-[16px] lg:gap-[14px] lg:rounded-[16px] lg:border lg:p-[20px]">
                <div
                  className={cx(
                    'bg-surface flex items-center gap-[10px] rounded-[12px]',
                    searching
                      ? 'border-brand border-[1.5px] px-[13.5px]'
                      : 'border-account-outline focus-within:border-brand border px-[14px]',
                  )}
                >
                  <Icon name="help/search.svg" size={18} />
                  <input
                    type="text"
                    id="help-query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={desktop ? 'Search help, like "refund" or "daily limit"' : 'Search help'}
                    aria-label="Search help"
                    className={cx(
                      'text-account-ink placeholder:text-account-placeholder min-w-0 flex-1 border-0 bg-transparent text-[14px] outline-none lg:text-[13px]',
                      searching ? 'py-[11.5px]' : 'py-[12px]',
                    )}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="flex shrink-0"
                    >
                      <Icon name="help/clear.svg" size={18} />
                    </button>
                  )}
                </div>
                {!searching && (
                  <div className="flex flex-wrap gap-[8px]">
                    {TOPICS.map((t) => {
                      const selected = topic === t;
                      const short = SHORT_TOPIC[t];
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTopic(selected ? null : t)}
                          aria-pressed={selected}
                          className={cx(
                            'rounded-full py-[7px] text-[12px] font-medium transition-colors',
                            selected
                              ? 'border-brand text-brand bg-brand-75 border-[1.5px] px-[12px] lg:px-[14px]'
                              : 'bg-account-tile lg:bg-account-soft text-account-body hover:bg-brand-75 hover:text-brand px-[12px] lg:px-[14px]',
                          )}
                        >
                          {short ? (
                            <>
                              <span className="lg:hidden">{short}</span>
                              <span className="hidden lg:inline">{t}</span>
                            </>
                          ) : (
                            t
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {(!searching || results.length === 0) && <TalkCard ref={mobileTalkRef} variant="mobile" {...talkProps} />}

              {searching && results.length > 0 && (
                <div className={cx(card, 'flex flex-col px-[16px] py-[14px] lg:p-[20px]')}>
                  <p className="text-account-ink text-[12px] leading-normal font-semibold lg:text-[13px]">
                    {results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”
                  </p>
                  {results.map((faq, i) => (
                    <button
                      key={faq.id}
                      type="button"
                      onClick={() => setModal({ kind: 'faq', faq })}
                      className={cx(
                        'flex w-full flex-col items-start gap-[4px] py-[12px] text-left',
                        i > 0 && 'border-account-line border-t',
                      )}
                    >
                      <span className="text-account-ink text-[13px] font-semibold lg:text-[14px]">
                        <Highlight text={faq.question} tokens={tokens} strongClass="font-bold" />
                      </span>
                      <span className="text-neutral-550 text-[12px] lg:text-[13px]">
                        <Highlight
                          text={faq.answer[0] ?? ''}
                          tokens={tokens}
                          strongClass="text-account-ink font-bold"
                        />
                      </span>
                      <span className="bg-account-tile text-account-body rounded-full px-[8px] py-[3px] text-[11px] font-medium">
                        {faq.topic}
                      </span>
                    </button>
                  ))}
                  {/* Phones have the Report a problem button under the card instead */}
                  <div className="border-account-line hidden flex-wrap gap-[6px] border-t pt-[12px] text-[13px] lg:flex">
                    <span className="text-neutral-550">Didn’t find it?</span>
                    <button
                      type="button"
                      onClick={openReport}
                      disabled={offline}
                      className="text-brand font-semibold disabled:opacity-40"
                    >
                      Report a problem
                    </button>
                  </div>
                </div>
              )}

              {searching && results.length === 0 && (
                <div
                  className={cx(
                    card,
                    'flex flex-col items-center gap-[10px] px-[16px] py-[28px] text-center lg:px-[20px]',
                  )}
                >
                  <div className="bg-brand-75 flex size-[52px] items-center justify-center rounded-full">
                    <Icon name="help/no-results.svg" size={24} />
                  </div>
                  <p className="text-account-ink max-w-full text-[16px] leading-normal font-semibold break-words">
                    No answers for “{query.trim()}”
                  </p>
                  <p className="text-neutral-550 text-[13px] leading-normal">
                    Try a shorter word, like “plan” or “medium”. Or ask us, we reply within a day.
                  </p>
                  <button
                    type="button"
                    onClick={openReport}
                    disabled={offline}
                    className="bg-brand hover:bg-account-hover text-on-brand hidden rounded-full px-[20px] py-[12px] text-[14px] font-semibold transition-colors disabled:opacity-40 lg:block"
                  >
                    Report a problem
                  </button>
                </div>
              )}

              {!searching && (
                <div className={listCard}>
                  <p className={overline}>{listTitle}</p>
                  {listed.map((faq, i) => (
                    <QuestionRow
                      key={faq.id}
                      faq={faq}
                      last={i === listed.length - 1}
                      className={!topic && MOBILE_HIDDEN_TOP.has(faq.id) ? 'hidden lg:flex' : ''}
                      onOpen={() => setModal({ kind: 'faq', faq })}
                    />
                  ))}
                </div>
              )}

              {!searching && requests.length > 0 && (
                <div className={cx(card, 'flex flex-col px-[16px] pt-[14px] pb-[6px]')}>
                  <p className={overline}>Your requests</p>
                  {requests.map((r, i) => {
                    const status = statusOf(r.status);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setModal({ kind: 'request', request: r })}
                        className={cx(
                          'flex w-full items-center gap-[12px] py-[12px] text-left',
                          i > 0 && 'border-account-line border-t',
                        )}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                          <span className="text-account-ink truncate text-[14px] font-semibold">{r.topic}</span>
                          <span className="text-neutral-550 truncate text-[12px]">
                            {requestNumber(r.id)} · {formatDay(r.createdAt)}
                          </span>
                        </span>
                        <span
                          className={cx(
                            'shrink-0 rounded-full px-[10px] py-[3px] text-[11px] font-semibold',
                            status.badge,
                          )}
                        >
                          {status.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={openReport}
                disabled={offline}
                className="border-account-outline text-brand hover:bg-account-soft w-full rounded-full border py-[14px] text-[14px] font-semibold transition-colors disabled:opacity-40 lg:hidden"
              >
                Report a problem
              </button>
            </div>

            <TalkCard ref={desktopTalkRef} variant="desktop" {...talkProps} />
          </div>
        )}
      </div>

      {modal?.kind === 'faq' && <FaqModal faq={modal.faq} onTalk={talkToUs} onClose={() => setModal(null)} />}
      {modal?.kind === 'call' && <CallModal loginPhone={loginPhone} onClose={() => setModal(null)} />}
      {modal?.kind === 'email' && <EmailModal loginPhone={loginPhone} onClose={() => setModal(null)} />}
      {modal?.kind === 'report' && (
        <ReportModal loginPhone={loginPhone} offline={offline} onSent={handleSent} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'sent' && <ReportSentModal request={modal.request} onClose={() => setModal(null)} />}
      {modal?.kind === 'request' && <RequestModal request={modal.request} onClose={() => setModal(null)} />}
    </div>
  );
}
