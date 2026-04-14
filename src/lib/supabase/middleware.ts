import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

// Routes restricted to manager and back_office roles
// Note: /dashboard/remunerations is accessible to all roles (consultants see filtered view)
const MANAGER_ROUTES = [
  '/dashboard/encaissements',
  '/dashboard/parametres',
]

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl
  const publicRoutes = ['/login', '/auth']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Enforce secure cookie settings (keep httpOnly as set by Supabase —
            // auth cookies must remain readable by client-side JS)
            const secureOptions: CookieOptions = {
              ...options,
              secure: true,
              sameSite: 'lax',
            }
            response.cookies.set(name, value, secureOptions)
          })
        },
      },
    }
  )

  // Refresh session and validate user
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect unauthenticated users to login (except public routes)
  if (!isPublicRoute && (!user || error)) {
    const loginUrl = new URL('/login', request.url)
    // Sanitize redirect to prevent open redirect attacks
    const safeRedirect = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/dashboard'
    loginUrl.searchParams.set('redirect', safeRedirect)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from login page
  if (isPublicRoute && user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Server-side role check for manager-only routes
  const isManagerRoute = MANAGER_ROUTES.some(route => pathname.startsWith(route))
  if (isManagerRoute && user) {
    const { data: consultant } = await supabase
      .from('consultants')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    const role = consultant?.role
    if (role !== 'manager' && role !== 'back_office') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}
