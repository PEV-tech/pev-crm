import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    // Get current consultant to embed in state
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', request.url))

    const { data: consultant } = await supabase
      .from('consultants')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (!consultant) return NextResponse.redirect(new URL('/login', request.url))

    // Generate a cryptographic nonce to prevent CSRF and state tampering
    const nonce = randomBytes(32).toString('hex')

    // State = consultantId:nonce:hmac — the callback will verify the HMAC
    const statePayload = `${consultant.id}:${nonce}`
    const hmac = createHash('sha256')
      .update(`${statePayload}:${process.env.GOOGLE_CLIENT_SECRET}`)
      .digest('hex')
      .substring(0, 16)
    const state = `${statePayload}:${hmac}`

    const clientId = process.env.GOOGLE_CLIENT_ID!
    const redirectUri = process.env.GOOGLE_REDIRECT_URI!
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' ')

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', scopes)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)

    return NextResponse.redirect(url.toString())
  } catch (err) {
    console.error('Google auth init error')
    return NextResponse.redirect(new URL('/dashboard/parametres?google=error', request.url))
  }
}
