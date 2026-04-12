import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getValidToken(supabase: Awaited<ReturnType<typeof createClient>>, token: Record<string, unknown>, cid: string): Promise<string> {
  if (token.expires_at && new Date(token.expires_at as string).getTime() > Date.now() + 60000) return token.access_token as string
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: token.refresh_token as string, grant_type: 'refresh_token' }),
  })
  const t = await r.json() as Record<string, unknown>
  if (!t.access_token) throw new Error('Refresh failed')
  await supabase.from('google_tokens').update({ access_token: t.access_token as string, expires_at: new Date(Date.now() + (t.expires_in as number) * 1000).toISOString() }).eq('consultant_id', cid)
  return t.access_token as string
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
    const searches: Promise<Record<string, unknown>>[] = []
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
    const allItems = new Map<string, Record<string, unknown>>()
    for (const cal of results) {
      for (const e of (cal.items as unknown[] || [])) {
        const event = e as Record<string, unknown>
        if (!allItems.has(event.id as string)) allItems.set(event.id as string, event)
      }
    }

    const events = Array.from(allItems.values()).map((e: Record<string, unknown>) => {
      const start = e as any
      return {
        id: e.id,
        summary: e.summary,
        start: start.start?.dateTime || start.start?.date,
        end: start.end?.dateTime || start.end?.date,
        htmlLink: e.htmlLink,
        attendees: ((e.attendees || []) as Record<string, unknown>[]).map((a: Record<string, unknown>) => ({
          email: a.email || '',
          displayName: a.displayName || '',
          responseStatus: a.responseStatus || 'needsAction',
          self: a.self || false,
        })),
        isPast: new Date((start.start?.dateTime || start.start?.date) as string) < new Date(),
      }
    })

    // Sort by start date (newest first for past, soonest first for upcoming)
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({ connected: true, events })
  } catch (err) {
    console.error('Calendar error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Calendar API error' }, { status: 500 })
  }
}
