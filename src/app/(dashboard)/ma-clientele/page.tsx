export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { MaClienteleClient } from './ma-clientele-client'

async function getConsultantDossiers() {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { dossiers: [], consultant: null }
  }

  // Get consultant info
  const { data: consultant, error: consultantError } = await supabase
    .from('consultants')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: any; error: any }

  if (consultantError) {
    console.error('Error fetching consultant:', consultantError)
    return { dossiers: [], consultant: null }
  }

  // Get dossiers for this consultant
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')
    .eq('consultant_nom', consultant?.nom)

  if (dossiersError) {
    console.error('Error fetching dossiers:', dossiersError)
    return { dossiers: [], consultant }
  }

  return {
    dossiers: dossiers || [],
    consultant,
  }
}

export default async function MaClientelePage() {
  const { dossiers, consultant } = await getConsultantDossiers()

  return <MaClienteleClient initialData={dossiers} consultant={consultant} />
}
