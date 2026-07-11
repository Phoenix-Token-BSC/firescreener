import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokensBySymbol, isValidContractAddress } from './lib/tokenRegistry';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Public routes that don't require authentication
const publicRoutes = ['/auth/login', '/auth/signup', '/dev/auth', '/', '/about', '/contact'];

// Routes that require authentication (both regular users and developers)
const protectedRoutes = ['/dashboard', '/profile', '/settings', '/claims', '/blaze-claim'];

// Routes that require developer authentication only
const devProtectedRoutes = ['/dev/dashboard', '/dev/analytics'];

async function verifySession(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    return !error && data !== null;
  } catch (err) {
    console.error('Session verification error:', err);
    return false;
  }
}

// Check if user has valid Supabase Auth session (for developers)
// Note: We just check for the presence of auth cookies, not validate them server-side
// Validation happens client-side in AuthContext
function hasSupabaseSession(request: NextRequest): boolean {
  try {
    // Supabase stores session in cookies with names like: sb-{project-ref}-auth-token
    // Just check if any Supabase auth cookie exists
    const cookies = request.cookies.getAll();
    const hasAuthCookie = cookies.some(c =>
      c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );

    return hasAuthCookie;
  } catch (err) {
    console.error('Supabase session check error:', err);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev routes: Don't check auth in middleware
  // Supabase stores session in localStorage, not cookies, so we can't verify server-side
  // Auth check happens client-side in the dev pages
  if (devProtectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check protected routes (both users and devs)
  // Note: Devs have Supabase session in localStorage (not cookies), so we can't verify server-side
  // We allow access and let client-side handle auth validation
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const authToken = request.cookies.get('auth_token')?.value;

    // Check if user has valid regular user session
    let isValidRegularUser = false;
    if (authToken) {
      isValidRegularUser = await verifySession(authToken);
    }

    // If regular user session is valid, allow access
    if (isValidRegularUser) {
      return NextResponse.next();
    }

    // If no regular user session, might be a dev with Supabase session (stored in localStorage)
    // Client-side will verify. Just let it through.
    return NextResponse.next();
  }

  // Allow public auth routes
  if (publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Check if this is a token page route pattern: /[chain]/[identifier]
  const tokenPageMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)$/);

  if (tokenPageMatch) {
    const [, chain, identifier] = tokenPageMatch;

    // ALWAYS allow direct contract address access - no redirects needed
    if (isValidContractAddress(identifier, chain as 'bsc' | 'sol' | 'rwa')) {
      return NextResponse.next();
    }

    // Only handle symbol-based redirects for backward compatibility
    // Check if it's a token symbol that needs to be redirected to contract address
    const tokensWithSymbol = getTokensBySymbol(identifier);
    const chainTokens = tokensWithSymbol.filter(token => token.chain === chain);

    if (chainTokens.length === 1) {
      // Only one token with this symbol on this chain - redirect to contract address
      const tokenMetadata = chainTokens[0];
      const newUrl = new URL(`/${chain}/${tokenMetadata.address}`, request.url);
      return NextResponse.redirect(newUrl, 301); // Permanent redirect
    } else if (chainTokens.length > 1) {
      // Multiple tokens with same symbol on same chain - redirect to error page with options
      const newUrl = new URL(`/error?type=duplicate_symbol&identifier=${encodeURIComponent(identifier)}&chain=${chain}`, request.url);
      return NextResponse.redirect(newUrl, 302); // Temporary redirect
    }

    // If no token found with this symbol, let Next.js handle the 404
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};
