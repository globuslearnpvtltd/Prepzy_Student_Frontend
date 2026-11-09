'use client';

import { Card, CardDescription, CardTitle } from '@prepzy/design-system';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { routes } from '@/shared/config/routes';
import { useExam } from '@/shared/hooks/use-exam';
import { listableTestTypes } from '../adapters';
import { TEST_TYPES } from '../test-types';

/** Entry page for tests: one card per test type the exam offers. */
export function TestHub() {
  const exam = useExam();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Tests</h1>
        <p className="text-foreground-muted text-sm">Practise under exam conditions and review every answer.</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {listableTestTypes(exam).map((type) => (
          <li key={type}>
            <Card asChild>
              <Link
                href={routes.testList(exam.slug, type)}
                className="h-full flex-row items-center justify-between transition-shadow hover:shadow-lg"
              >
                <div>
                  <CardTitle>{TEST_TYPES[type].label}</CardTitle>
                  <CardDescription>{TEST_TYPES[type].description}</CardDescription>
                </div>
                <ChevronRight aria-hidden className="text-brand size-5 shrink-0" />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
