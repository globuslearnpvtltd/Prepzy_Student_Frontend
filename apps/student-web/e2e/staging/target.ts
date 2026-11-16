import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getExam, type ExamDesign } from '../../src/shared/config/exams';

export const STAGING_SESSION = join(tmpdir(), 'prepzy-e2e', 'staging-student.json');

// One fixed device id, so every PC running these tests counts as the same device (the server allows two).
export const STAGING_DEVICE = 'e2e-playwright';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|([a-z0-9-]+\.)+localhost)$/;
const STAGING_HOST = /(^|[.-])staging([.-]|$)/;

export function loadStagingEnvFile(appDir: string): void {
  const file = join(appDir, '.env.e2e');
  if (existsSync(file)) process.loadEnvFile(file);
}

function setting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. Add it to apps/student-web/.env.e2e (see e2e/staging/README.md).`);
  return value;
}

function safeAddress(name: string): string {
  const value = setting(name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a full address such as https://staging.example.com.`);
  }
  const host = url.hostname.toLowerCase();
  if (!LOCAL_HOST.test(host) && !STAGING_HOST.test(host)) {
    throw new Error(
      `${name} points to "${host}". These tests run only on this PC (localhost) or on a staging host, never on production.`,
    );
  }
  return url.toString().replace(/\/+$/, '');
}

export const stagingSiteUrl = (): string => safeAddress('E2E_BASE_URL');

export const stagingApiUrl = (): string => safeAddress('E2E_API_URL');

export function stagingExam(): ExamDesign {
  const exam = getExam(setting('E2E_EXAM').toLowerCase());
  if (!exam) throw new Error('E2E_EXAM must be an exam slug from src/shared/config/exams.ts, for example neet or cbse.');
  return exam;
}

export function stagingLogin(): { phone: string; otp: string } {
  const phone = setting('E2E_PHONE');
  const otp = setting('E2E_OTP');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('E2E_PHONE must be the full number with the country code, in the form +91XXXXXXXXXX.');
  }
  if (!/^\d{6}$/.test(otp)) throw new Error('E2E_OTP must be the 6-digit fixed code of the test student.');
  return { phone, otp };
}
