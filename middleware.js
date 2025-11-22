// SHA-256 function for Vercel Edge Runtime
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Vercel Middleware to inject environment variables
export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // CRITICAL: Skip static files FIRST - before any processing
  // This must be checked before fetch() to avoid interfering with static file serving
  // Check for static file paths and file extensions
  const isStaticFile = 
    pathname.startsWith('/js/') ||
    pathname.startsWith('/css/') ||
    pathname.startsWith('/libs/') ||
    pathname.startsWith('/image/') ||
    pathname.startsWith('/api/') ||
    pathname === '/manifest.json' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    // Check for file extensions (but exclude .html)
    (/\.[a-zA-Z0-9]+$/.test(pathname) && !pathname.endsWith('.html'));
  
  if (isStaticFile) {
    // Return undefined to let Vercel serve static files directly
    // Do NOT call fetch() for static files
    return;
  }

  // Only process HTML pages and root path
  const isHtmlPage = pathname.endsWith('.html') || pathname === '/' || pathname.startsWith('/s=');
  if (!isHtmlPage) {
    // Not an HTML page and not a static file - let it pass through
    return;
  }

  try {
    // Fetch the original response
    const response = await fetch(request);

    // Check if it's an HTML response
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    // Get the HTML content
    const originalHtml = await response.text();

    // Replace the placeholder with actual environment variable
    const password = process.env.PASSWORD || '';
    let passwordHash = '';
    if (password) {
      passwordHash = await sha256(password);
    }

    // 替换密码占位符
    const modifiedHtml = originalHtml.replace(
      'window.__ENV__.PASSWORD = "{{PASSWORD}}";',
      `window.__ENV__.PASSWORD = "${passwordHash}"; // SHA-256 hash`
    );

    // Create new headers object
    const newHeaders = new Headers(response.headers);
    newHeaders.set('content-type', 'text/html; charset=utf-8');

    // Return modified HTML response
    return new Response(modifiedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    // If there's an error, let the request pass through
    console.error('Middleware error:', error);
    return;
  }
}

export const config = {
  // Only match HTML pages - DO NOT match static files
  matcher: [
    '/',
    '/s=:query',
    '/player.html',
    '/player.html/:path*',
    '/watch.html',
    '/watch.html/:path*',
    '/about.html'
  ],
};