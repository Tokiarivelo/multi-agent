import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * GET /api/github/callback
 *
 * GitHub redirects here after user authorizes the OAuth App.
 * This server-side handler:
 *  1. Exchanges the `code` for an access token via github-mcp-service
 *  2. Returns an HTML page that posts a message to the opener popup and closes itself
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return new NextResponse(closePopupHtml({ error: error ?? 'Missing code' }), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const res = await fetch(`${GATEWAY_URL}/api/github/exchange?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(closePopupHtml({ error: text }), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const payload = await res.json() as {
      accessToken: string;
      login: string;
      avatarUrl: string;
    };

    return new NextResponse(closePopupHtml({ payload }), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    return new NextResponse(
      closePopupHtml({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { headers: { 'Content-Type': 'text/html' } },
    );
  }
}

interface SuccessPayload {
  payload: { accessToken: string; login: string; avatarUrl: string };
  error?: never;
}
interface ErrorPayload {
  error: string;
  payload?: never;
}

function closePopupHtml(opts: SuccessPayload | ErrorPayload): string {
  const script =
    opts.payload
      ? `
        window.opener?.postMessage({
          type: 'github_oauth_success',
          accessToken: ${JSON.stringify(opts.payload.accessToken)},
          login: ${JSON.stringify(opts.payload.login)},
          avatarUrl: ${JSON.stringify(opts.payload.avatarUrl)},
        }, '*');`
      : `
        window.opener?.postMessage({
          type: 'github_oauth_error',
          error: ${JSON.stringify(opts.error)},
        }, '*');`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GitHub Authorization</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #0d1117; color: #e6edf3; }
    .card { text-align: center; padding: 2rem; border-radius: 12px;
            background: #161b22; border: 1px solid #30363d; }
    .icon { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #8b949e; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${opts.payload ? '✅' : '❌'}</div>
    <h3>${opts.payload ? 'Authorization successful!' : 'Authorization failed'}</h3>
    <p>${opts.payload ? 'You can close this window.' : opts.error}</p>
  </div>
  <script>
    ${script}
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`;
}
