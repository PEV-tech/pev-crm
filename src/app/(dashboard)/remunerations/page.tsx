export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { RemunerationsClient } from './remunerations-client'

async function getRemunData() {
  const supabase = await createClient()

  // Get current consultant
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { dossiers: [], consultant: null, role: null }
  }

  // Get consultant info
  const { data: consultant, error: consultantError } = await supabase
    .from('consultants')
    .select('*')
    .eq('auth_user_id', user.id)
    .single() as { data: any; error: any }

  if (consultantError) {
    console.error('Error fetching consultant:', consultantError)
    return { dossiers: [], consultant: null, role: null }
  }

  // Get all dossiers with commission data
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')

  if (dossiersError) {
    console.error('Error fetching dossiers:', dossiersError)
    return { dossiers: [], consultant, role: consultant?.role }
  }

  return {
    dossiers: dossiers || [],
    consultant,
    role: consultant?.role,
  }
}

export default async function RemunerationsPage() {
  const { dossiers, consultant, role } = await getRemunData()

  return <RemunerationsClient dossiers={dossiers} consultant={consultant} role={role} />
}
