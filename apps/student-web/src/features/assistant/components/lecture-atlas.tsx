'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useActivePlan } from '@/features/auth';
import { LiveVoiceLayer, LiveVoiceProvider, useLiveVoice, type VoiceConfig } from '@/features/live-voice';
import { useExam } from '@/shared/hooks/use-exam';
import { assistantApi, type AtlasSurface } from '../api';
import { atlasKeys } from '../hooks';
import { AtlasPanel } from './atlas-panel';
import { ChatLauncher, ChatOverlay } from './atlas-host';

export interface LectureAtlasProps {
  courseId: number | string;
  moduleId?: number | string | null;
  lectureId?: number | string | null;
  /** Render your own opener (e.g. NEET's "Ask Atlas AI" card); the floating launcher is always shown too. */
  children?: (open: () => void) => React.ReactNode;
}

const toNumber = (value: number | string | null | undefined) => (value === null || value === undefined || value === '' ? null : Number(value));

/** The lecture tutor (Atlas scoped to the course): floating launcher + chat panel over the lecture. */
export function LectureAtlas({ courseId, moduleId, lectureId, children }: LectureAtlasProps) {
  const exam = useExam();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const surface = useMemo<AtlasSurface>(
    () => ({ kind: 'lecture', courseId: Number(courseId), moduleId: toNumber(moduleId), lectureId: toNumber(lectureId) }),
    [courseId, moduleId, lectureId],
  );
  const avatar = useQuery({
    queryKey: atlasKeys.avatar(exam.slug, surface),
    queryFn: () => assistantApi.avatar(exam.category, surface),
    staleTime: Infinity,
  });
  const plan = useActivePlan(exam);
  // Board lectures: course + lecture. NEET video steps: course + module (chapter); class_id feeds the meter.
  const voiceConfig = useMemo<VoiceConfig>(
    () =>
      exam.category === 'competitive'
        ? { variant: 'neet-lecture', courseId: Number(courseId), moduleId: toNumber(moduleId), classId: plan.data?.classId ?? null }
        : { variant: 'lecture', courseId: Number(courseId), lectureId: toNumber(lectureId) },
    [exam.category, courseId, moduleId, lectureId, plan.data?.classId],
  );
  const close = () => {
    setOpen(false);
    setExpanded(false);
  };
  return (
    // Leaving the lecture unmounts the provider, which hangs up (and saves) a running call.
    <LiveVoiceProvider config={voiceConfig}>
      {children?.(() => setOpen(true))}
      <LectureLauncher show={!open} label={`Ask ${avatar.data?.name ?? 'your tutor'}`} image={avatar.data?.image} onOpen={() => setOpen(true)} />
      <ChatOverlay open={open} expanded={expanded} onClose={close}>
        <AtlasPanel exam={exam} surface={surface} expanded={expanded} onExpand={setExpanded} onClose={close} />
      </ChatOverlay>
      <LiveVoiceLayer chatOpen={open} onOpenChat={() => setOpen(true)} expanded={expanded} />
    </LiveVoiceProvider>
  );
}

function LectureLauncher({ show, ...props }: { show: boolean; label: string; image?: string | null; onOpen: () => void }) {
  const voice = useLiveVoice();
  return show && !voice?.isActive ? <ChatLauncher {...props} /> : null;
}
