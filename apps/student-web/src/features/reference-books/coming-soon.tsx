import { BookOpen, BookMarked, Library } from 'lucide-react';

/** On-brand placeholder until the reference books API exists. */
export function ReferenceBooksComingSoon() {
  return (
    <section
      aria-labelledby="reference-title"
      className="from-brand-450 to-brand relative overflow-hidden rounded-xl bg-linear-to-br px-6 py-12 text-center md:px-12 md:py-16"
    >
      <span aria-hidden className="bg-surface/10 absolute -top-16 -right-16 size-56 rounded-full" />
      <span aria-hidden className="bg-surface/10 absolute -bottom-20 -left-10 size-48 rounded-full" />
      <div className="relative mx-auto flex max-w-lg flex-col items-center gap-4">
        <div className="flex items-end gap-2" aria-hidden>
          <BookMarked className="text-accent-400 size-10" />
          <Library className="text-on-brand size-14" />
          <BookOpen className="text-accent-400 size-10" />
        </div>
        <span className="border-surface/20 bg-surface/10 text-on-brand/80 rounded-full border px-3 py-1 text-xs font-semibold">
          Reference Books
        </span>
        <h1 id="reference-title" className="font-display text-on-brand text-3xl font-bold">
          Reference books are coming soon
        </h1>
        <p className="text-on-brand/75 text-sm">
          NCERT and the best reference books for every chapter, in one place — with Atlas ready to explain any page.
        </p>
      </div>
    </section>
  );
}
