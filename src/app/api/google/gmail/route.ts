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
    const email = new URL(request.url).searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: consultant } = await supabase.from('consultants').select('id').eq('auth_user_id', user.id).single()
    if (!consultant) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('consultant_id', consultant.id).single()
    if (!tokenData) return NextResponse.json({ connected: false, messages: [] })
    const accessToken = await getValidToken(supabase, tokenData, consultant.id)
    const s = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(email)}&maxResults=20`, { headers: { Authorization: `Bearer ${accessToken}` } })
    const sd = await s.json() as Record<string, unknown>
    if (!(sd.messages as unknown[])?.length) return NextResponse.json({ connected: true, messages: [] })
    const messages = await Promise.all((sd.messages as Record<string, unknown>[]).slice(0, 15).map(async (msg: Record<string, unknown>) => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const d = await r.json() as Record<string, unknown>
      const h = (d.payload as Record<string, unknown>)?.headers as Record<string, unknown>[] || []
      const g = (n: string) => (h.find((x: Record<string, unknown>) => x.name === n) as Record<string, unknown>)?.value || ''
      return { id: d.id, threadId: d.threadId, from: g('From'), to: g('To'), subject: g('Subject'), date: g('Date'), snippet: d.snippet, hasAttachments: ((d.payload as Record<string, unknown>)?.parts as Record<string, unknown>[] || []).some((p: Record<string, unknown>) => (p.filename as string)?.length > 0) || false, labelIds: d.labelIds || [] }
    }))
    return NextResponse.json({ connected: true, messages })
  } catch (err) {
    console.error('Gmail error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Gmail API error' }, { status: 500 })
  }
}
