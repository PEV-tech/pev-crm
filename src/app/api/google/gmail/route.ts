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
    const sd = await s.json()
    if (!sd.messages?.length) return NextResponse.json({ connected: true, messages: [] })
    const messages = await Promise.all(sd.messages.slice(0, 15).map(async (msg: any) => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, { headers: { Authorization: `Bearer ${accessToken}` } })
      const d = await r.json()
      const h = d.payload?.headers || []
      const g = (n: string) => h.find((x: any) => x.name === n)?.value || ''
      return { id: d.id, threadId: d.threadId, from: g('From'), to: g('To'), subject: g('Subject'), date: g('Date'), snippet: d.snippet, hasAttachments: d.payload?.parts?.some((p: any) => p.filename?.length > 0) || false, labelIds: d.labelIds || [] }
    }))
    return NextResponse.json({ connected: true, messages })
  } catch (err) {
    console.error('Gmail error:', err)
    return NextResponse.json({ error: 'Erreur Gmail' }, { status: 500 })
  }
}
