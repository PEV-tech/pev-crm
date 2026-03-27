import { createClient } from '@/lib/supabase/server'
import { EncaissementsClient } from './encaissements-client'

async function getEncaissements() {
  const supabase = await createClient()

  // Get all dossiers with factures
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')

  const { data: factures, error: facturesError } = await supabase
    .from('factures')
    .select('*')

  if (dossiersError || facturesError) {
    console.error('Error fetching data:', dossiersError || facturesError)
    return []
  }

  // Filter facturee=true AND payee='oui'
  const encaissements = factures
    ?.filter((f: any) => f.facturee && f.payee === 'oui')
    .map((f: any) => {
      const dossier = dossiers?.find((d: any) => d.id === f.dossier_id)
      return { ...f, dossier }
    }) || []

  return encaissements
}

export default async function EncaissementsPage() {
  const encaissements = await getEncaissements()

  return <EncaissementsClient initialData={encaissements} />
}
