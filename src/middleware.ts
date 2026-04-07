import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that don't require authentication
const publicRoutes = ['/login', '/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes without authentication
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return await updateSession(request)
  }

  // For all other routes, validate auth and redirect if not authenticated
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
