import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that don't require authentication
const publicRoutes = ['/login', '/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes without authentication
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return await updateSession(request)
  }

  // For all other routes, update the session (which will validate auth)
  return await updateSession(request)
}

export const config = {
  // Matcher for all routes except:
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization files)
  // - favicon.ico (favicon file)
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
