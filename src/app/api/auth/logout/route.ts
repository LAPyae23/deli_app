import { NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}

export async function POST() {
  return clearSession(NextResponse.json({ success: true }));
}

/** Sign-out links navigate here; clears the cookie and returns to the home page. */
export async function GET(request: Request) {
  return clearSession(NextResponse.redirect(new URL('/', request.url)));
}
