/**
 * Next.js instrumentation: every uncaught server error (route handlers,
 * pages, server components) is stored in MongoDB so admins can see it
 * on the System Health screen.
 */
export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routePath?: string; routeType?: string }
) {
  // The import must sit inside this check so the edge bundle never includes MongoDB.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const err = error as { message?: string; stack?: string; digest?: string };
    const { logError } = await import('./lib/monitoring');
    await logError({
      source: 'server',
      route: context.routePath || request.path,
      method: request.method,
      message: err?.message || String(error),
      stack: err?.stack,
      digest: err?.digest,
      userAgent: String(request.headers['user-agent'] || ''),
    });
  }
}
