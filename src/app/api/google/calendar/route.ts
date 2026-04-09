import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getValidToken(supabase: any, token: any, cid: string) {
  if (token.expires_at && new Date(token.expires_at).getTime() > Date.now() + 60000) return token.access_token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: token.refresh_token, grant_type: 'refresh_token' }),
  })
  const t = await r.json()
  if (!t.access_token) throw new Error('Refresh failed')
  await supabase.from('google_tokens').update({ access_token: t.access_token, expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() }).eq('consultant_id', cid)
  return t.access_token
}

export async function GET(request: NextRequest) {
  try {
    const name = new URL(request.url).searchParams.get('name')
    if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: consultant } = await supabase.from('consultants').select('id').eq('auth_user_id', user.id).single()
    if (!consultant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('consultant_id', consultant.id).single()
    if (!tokenData) return NextResponse.json({ connected: false, events: [] })
    const accessToken = await getValidToken(supabase, tokenData, consultant.id)
    const tMin = new Date(Date.now() - 180 * 86400000).toISOString()
    const tMax = new Date(Date.now() + 180 * 86400000).toISOString()
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(name)}&timeMin=${tMin}&timeMax=${tMax}&maxResults=20&orderBy=startTime&singleEvents=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const cal = await r.json()
    const events = (cal.items || []).map((e: any) => ({
      id: e.id, summary: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      htmlLink: e.htmlLink,
      attendees: e.attendees?.length || 0,
      isPast: new Date(e.start?.dateTime || e.start?.date) < new Date(),
    }))
    return NextResponse.json({ connected: true, events })
  } catch (err) {
    console.error('Calendar error:', err)
    return NextResponse.json({ error: 'Erreur Calendar' }, { status: 500 })
  }
    }
