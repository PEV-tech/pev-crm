import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allocateLine, summarizeAllocations, type AllocationTarget } from '@/lib/encours/allocation'

function isUuid(x: unknown): x is string {
  return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })

    const b = body as Record<string, unknown>
    if (!isUuid(b.dossier_id)) return NextResponse.json({ error: 'dossier_id invalide' }, { status: 400 })
    if (typeof b.montant_brut_percu !== 'number' || b.montant_brut_percu < 0 || !Number.isFinite(b.montant_brut_percu)) {
      return NextResponse.json({ error: 'montant_brut_percu invalide' }, { status: 400 })
    }
    if (typeof b.type_commission !== 'string' || !['entree','encours'].includes(b.type_commission)) {
      return NextResponse.json({ error: 'type_commission invalide' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    const { data: dossier, error: dErr } = await supabase
      .from('v_dossiers_complets' as never)
      .select('id, client_id, consultant_id, apporteur_id, apporteur_ext_nom, taux_apporteur_ext, produit_id, compagnie_id, co_titulaire_id, client_nom, client_prenom, client_pays, produit_nom, produit_categorie, compagnie_nom, consultant_prenom, consultant_nom, taux_remuneration')
      .eq('id', b.dossier_id).maybeSingle()
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })
    if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    const d = dossier as Record<string, unknown>

    const rawTargets = Array.isArray(b.targets) ? b.targets : null
    const targetSpecs: Array<{ consultant_id: string; split_pct: number }> =
      rawTargets && rawTargets.length > 0
        ? rawTargets.map((t) => {
            const tr = t as Record<string, unknown>
            if (!isUuid(tr.consultant_id)) throw new Error('target.consultant_id invalide')
            const pct = typeof tr.split_pct === 'number' ? tr.split_pct : 1
            return { consultant_id: tr.consultant_id as string, split_pct: pct }
          })
        : (() => {
            if (!isUuid(d.consultant_id)) throw new Error('Dossier sans consultant_id')
            return [{ consultant_id: d.consultant_id as string, split_pct: 1 }]
          })()

    const consultantIds = new Set<string>()
    targetSpecs.forEach((t) => consultantIds.add(t.consultant_id))

    const { data: consultants, error: cErr } = await supabase
      .from('consultants' as never).select('id, prenom, nom, role, taux_remuneration, zone, actif, auth_user_id')
      .in('id', Array.from(consultantIds))
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })

    const byId = new Map<string, unknown>()
    for (const c of (consultants ?? []) as Array<{ id: string }>) byId.set(c.id, c)

    const targets: AllocationTarget[] = targetSpecs.map((t) => {
      const c = byId.get(t.consultant_id)
      if (!c) throw new Error(`Consultant ${t.consultant_id} introuvable`)
      return { consultant: c as Parameters<typeof allocateLine>[0]['targets'][number]['consultant'], split_pct: t.split_pct }
    })

    const montantBrut = b.montant_brut_percu as number
    const tauxApporteurExt = typeof d.taux_apporteur_ext === 'number' ? d.taux_apporteur_ext : 0
    const remApporteurExt = typeof b.override_rem_apporteur_ext === 'number'
      ? b.override_rem_apporteur_ext : montantBrut * tauxApporteurExt

    const drafts = allocateLine({
      line: { id: '00000000-0000-0000-0000-000000000000', type_commission: b.type_commission as 'entree' | 'encours', montant_brut_percu: montantBrut },
      dossier: dossier as unknown as Parameters<typeof allocateLine>[0]['dossier'],
      targets,
      dossierEnrichment: {
        client_nom: d.client_nom as string | null,
        client_prenom: d.client_prenom as string | null,
        client_pays: d.client_pays as string | null,
        produit_nom: d.produit_nom as string | null,
        produit_categorie: d.produit_categorie as string | null,
        compagnie_nom: d.compagnie_nom as string | null,
      },
      rem_apporteur_ext_montant: remApporteurExt,
      rem_apporteur_interne_montant: 0,
    })
    const summary = summarizeAllocations(drafts)

    return NextResponse.json({
      drafts, summary,
      dossier: { id: d.id, client_nom: d.client_nom, client_prenom: d.client_prenom, produit_nom: d.produit_nom, produit_categorie: d.produit_categorie, compagnie_nom: d.compagnie_nom },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur interne' }, { status: 500 })
  }
}
