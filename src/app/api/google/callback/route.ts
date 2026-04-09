import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const consultantId = searchParams.get('state') // Passé par auth/route.ts

  if (!code || !consultantId) {
    console.error('Google callback: missing code or state', { code: !!code, consultantId: !!consultantId })
    return NextResponse.redirect(new URL('/dashboard/parametres?google=error', request.url))
  }

  try {
    // Échanger le code contre des tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokens.access_token) {
      console.error('Google callback: token exchange failed', JSON.stringify(tokens))
      return NextResponse.redirect(new URL('/dashboard/parametres?google=error&reason=token', request.url))
    }

    // Récupérer l'email Google du consultant
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const googleUser = await userRes.json()

    // Stocker le token avec l'ID du consultant (obtenu via state)
    const supabase = await createClient()
    const { error: upsertError } = await supabase.from('google_tokens').upsert({
      consultant_id: consultantId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      google_email: googleUser.email || null,
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'consultant_id' })

    if (upsertError) {
      console.error('Google callback: upsert failed', upsertError)
      return NextResponse.redirect(new URL('/dashboard/parametres?google=error&reason=db', request.url))
    }

    return NextResponse.redirect(new URL('/dashboard/parametres?google=success', request.url))
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/dashboard/parametres?google=error&reason=exception', request.url))
  }
}
