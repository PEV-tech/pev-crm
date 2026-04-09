import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/dashboard/parametres?google=error', request.url))
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: process.env.GOOGLE_REDIRECT_URI!, grant_type: 'authorization_code' }),
    })
    const tokens = await tokenRes.json()
    if (!tokens.access_token) throw new Error('No token')
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    const googleUser = await userRes.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data: consultant } = await supabase.from('consultants').select('id').eq('auth_user_id', user.id).single()
    if (!consultant) throw new Error('Consultant not found')
    await supabase.from('google_tokens').upsert({
      consultant_id: consultant.id, access_token: tokens.access_token, refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      google_email: googleUser.email, scopes: tokens.scope?.split(' ') || [],
    }, { onConflict: 'consultant_id' })
    return NextResponse.redirect(new URL('/dashboard/parametres?google=success', request.url))
  } catch (err) {
    console.error('Google OAuth error:', err)
    return NextResponse.redirect(new URL('/dashboard/parametres?google=error', request.url))
  }
  }
