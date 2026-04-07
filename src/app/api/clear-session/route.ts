import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()

  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'https://pev-crm.vercel.app'))

  // Clear all Supabase auth cookies
  allCookies.forEach(cookie => {
    if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      response.cookies.set(cookie.name, '', {
        expires: new Date(0),
        path: '/',
      })
    }
  })

  return response
}
