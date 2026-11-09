import type { Metadata } from 'next';
import { DiagnosticSetupScreen } from '@/features/diagnostic/ui';

export const metadata: Metadata = { title: 'Diagnostic test' };

export default function DiagnosticPage() {
  return <DiagnosticSetupScreen />;
}
