import { ReaderChrome } from '@/shared/layout/reader-chrome';

/** Reading pages (notes, summary videos, course catalogue / details): header only, no section sidebar or bottom bar. */
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return <ReaderChrome>{children}</ReaderChrome>;
}
