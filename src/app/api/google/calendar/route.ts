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
    const url = new URL(request.url)
    const name = url.searchParams.get('name')
    const email = url.searchParams.get('email')
    if (!name && !email) return NextResponse.json({ error: 'Nom ou email requis' }, { status: 400 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: consultant } = await supabase.from('consultants').select('id').eq('auth_user_id', user.id).single()
    if (!consultant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('consultant_id', consultant.id).single()
    if (!tokenData) return NextResponse.json({ connected: false, events: [] })
    const accessToken = await getValidToken(supabase, tokenData, consultant.id)
    const tMin = new Date(Date.now() - 180 * 86400000).toISOString()
    const tMax = new Date(Date.now() + 365 * 86400000).toISOString()
    const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events`
    const params = `&timeMin=${tMin}&timeMax=${tMax}&maxResults=30&orderBy=startTime&singleEvents=true`

    // Search by name and optionally by email, merge results
    const searches: Promise<any>[] = []
    if (name) {
      searches.push(
        fetch(`${baseUrl}?q=${encodeURIComponent(name)}${params}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then(r => r.json())
      )
    }
    if (email) {
      searches.push(
        fetch(`${baseUrl}?q=${encodeURIComponent(email)}${params}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then(r => r.json())
      )
    }

    const results = await Promise.all(searches)
    const allItems = new Map<string, any>()
    for (const cal of results) {
      for (const e of (cal.items || [])) {
        if (!allItems.has(e.id)) allItems.set(e.id, e)
      }
    }

    const events = Array.from(allItems.values()).map((e: any) => ({
      id: e.id,
      summary: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      htmlLink: e.htmlLink,
      attendees: (e.attendees || []).map((a: any) => ({
        email: a.email || '',
        displayName: a.displayName || '',
        responseStatus: a.responseStatus || 'needsAction',
        self: a.self || false,
      })),
      isPast: new Date(e.start?.dateTime || e.start?.date) < new Date(),
    }))

    // Sort by start date (newest first for past, soonest first for upcoming)
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({ connected: true, events })
  } catch (err) {
    console.error('Calendar error:', err)
    return NextResponse.json({ error: 'Erreur Calendar' }, { status: 500 })
  }
}
