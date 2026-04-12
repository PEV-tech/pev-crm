import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

// Max file sizes and allowed types for security
const REDIRECT_BASE = '/dashboard/parametres'

function verifyState(state: string, secret: string): { valid: boolean; consultantId: string | null } {
  const parts = state.split(':')
  if (parts.length !== 3) return { valid: false, consultantId: null }

  const [consultantId, nonce, receivedHmac] = parts
  const expectedHmac = createHash('sha256')
    .update(`${consultantId}:${nonce}:${secret}`)
    .digest('hex')
    .substring(0, 16)

  if (receivedHmac !== expectedHmac) return { valid: false, consultantId: null }
  return { valid: true, consultantId }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=error`, request.url))
  }

  // Verify state HMAC to prevent CSRF and state tampering
  const { valid, consultantId } = verifyState(state, process.env.GOOGLE_CLIENT_SECRET!)
  if (!valid || !consultantId) {
    console.error('Google callback: invalid state signature')
    return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=error&reason=csrf`, request.url))
  }

  // Verify the authenticated user matches the consultant in the state
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: consultant } = await supabase
    .from('consultants')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!consultant || consultant.id !== consultantId) {
    console.error('Google callback: state consultant_id does not match authenticated user')
    return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=error&reason=mismatch`, request.url))
  }

  try {
    // Exchange code for tokens
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
      console.error('Google callback: token exchange failed (no access_token returned)')
      return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=error&reason=token`, request.url))
    }

    // Get Google user email
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const googleUser = await userRes.json()

    // Store token using SECURITY DEFINER function
    const { error: rpcError } = await supabase.rpc('upsert_google_token', {
      p_consultant_id: consultantId,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      p_google_email: googleUser.email || null,
      p_scopes: tokens.scope ? tokens.scope.split(' ') : [],
    })

    if (rpcError) {
      console.error('Google callback: rpc upsert failed')
      // Fallback: try direct upsert
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
        console.error('Google callback: direct upsert also failed')
        return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=error&reason=db`, request.url))
      }
    }

    return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=success`, request.url))
  } catch (err) {
    console.error('Google OAuth callback error')
    return NextResponse.redirect(new URL(`${REDIRECT_BASE}?google=error&reason=exception`, request.url))
  }
}
