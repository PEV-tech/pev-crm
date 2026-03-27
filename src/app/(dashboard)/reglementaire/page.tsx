import { createClient } from '@/lib/supabase/server'
import { ReglementaireClient } from './reglementaire-client'

async function getComplianceData() {
  const supabase = await createClient()

  // Get all dossiers
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')

  if (dossiersError) {
    console.error('Error fetching dossiers:', dossiersError)
    return []
  }

  return dossiers || []
}

export default async function ReglementairePage() {
  const dossiers = await getComplianceData()

  return <ReglementaireClient initialData={dossiers} />
}
