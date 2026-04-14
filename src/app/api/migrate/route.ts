import { NextResponse } from 'next/server'

// Temporary migration endpoint — DELETE AFTER USE
export async function GET(request: Request) {
  // First, let's check what env vars are available
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (action === 'check') {
    return NextResponse.json({
      has_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_database_url: !!process.env.DATABASE_URL,
      has_direct_url: !!process.env.DIRECT_URL,
      has_supabase_db_url: !!process.env.SUPABASE_DB_URL,
      has_postgres_url: !!process.env.POSTGRES_URL,
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      env_keys: Object.keys(process.env).filter(k =>
        k.includes('SUPA') || k.includes('PG') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('DB_')
      )
    })
  }

  return NextResponse.json({ status: 'ok', usage: 'Add ?action=check to see available env vars' })
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    if (token !== 'pev-migrate-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try service role key approach via Supabase SQL API
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (serviceRoleKey && supabaseUrl) {
      // Use Supabase's built-in SQL execution for service_role
      const results = []

      // Step 1: ALTER TABLE
      const r1 = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      // Actually use the pg_net or direct approach
      // The service_role key with Supabase gives us DDL access via the SQL endpoint
      const sqlStatements = [
        `ALTER TABLE dossiers ADD COLUMN IF NOT EXISTS co_titulaire_id UUID REFERENCES clients(id) ON DELETE SET NULL`,
        `CREATE OR REPLACE VIEW v_dossiers_complets AS SELECT d.id, d.statut, d.montant, d.financement, d.commentaire, d.date_operation, d.date_entree_en_relation, d.date_signature, d.mode_detention, d.apporteur_label, d.referent, d.has_apporteur_ext, d.apporteur_ext_nom, d.taux_apporteur_ext, d.apporteur_id, cl.id AS client_id, cl.nom AS client_nom, cl.prenom AS client_prenom, cl.email AS client_email, cl.telephone AS client_telephone, cl.pays AS client_pays, cl.ville AS client_ville, cl.statut_kyc, cl.der, cl.pi, (cl.der AND cl.pi) AS preco, cl.lm, cl.rm, d.co_titulaire_id, cot.nom AS co_titulaire_nom, cot.prenom AS co_titulaire_prenom, co.id AS consultant_id, co.nom AS consultant_nom, co.prenom AS consultant_prenom, co.zone AS consultant_zone, co.taux_remuneration, p.nom AS produit_nom, p.categorie AS produit_categorie, cp.nom AS compagnie_nom, cm.taux_commission, cm.taux_gestion, cm.commission_brute, cm.rem_apporteur, cm.rem_apporteur_ext, cm.rem_support, cm.part_cabinet, cm.pct_cabinet, f.facturee, f.payee, f.date_facture FROM dossiers d LEFT JOIN clients cl ON cl.id = d.client_id LEFT JOIN clients cot ON cot.id = d.co_titulaire_id LEFT JOIN consultants co ON co.id = d.consultant_id LEFT JOIN produits p ON p.id = d.produit_id LEFT JOIN compagnies cp ON cp.id = d.compagnie_id LEFT JOIN commissions cm ON cm.dossier_id = d.id LEFT JOIN factures f ON f.dossier_id = d.id`
      ]

      for (const sql of sqlStatements) {
        const res = await fetch(`${supabaseUrl}/pg/query`, {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql })
        })
        const body = await res.text()
        results.push({ status: res.status, body: body.substring(0, 200) })
      }

      return NextResponse.json({ approach: 'service_role', results })
    }

    return NextResponse.json({ error: 'No suitable database credentials found in environment' }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
