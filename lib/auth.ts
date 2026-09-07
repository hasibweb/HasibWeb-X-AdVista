import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const cookieName = 'advista_admin';
const maxAgeSeconds = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error('AUTH_SECRET must be set to at least 24 characters.');
  }
  return secret;
}

function sign(value: string) {
  return createHmac('sha256', getSecret()).update(value).digest('hex');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 8) {
    throw new Error('ADMIN_PASSWORD must be set to at least 8 characters.');
  }
  return safeEqual(password, expected);
}

export async function createAdminSession() {
  const issuedAt = Date.now();
  const nonce = randomBytes(16).toString('hex');
  const payload = `${issuedAt}.${nonce}`;
  const token = `${payload}.${sign(payload)}`;

  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.AUTH_COOKIE_SECURE === 'false' ? false : process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(cookieName);
}

export async function isAdminAuthenticated() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [issuedAtRaw, nonce, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > maxAgeSeconds * 1000) return false;

  return safeEqual(sign(`${issuedAtRaw}.${nonce}`), signature);
}
