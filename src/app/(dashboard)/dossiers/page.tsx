import { createClient } from '@/lib/supabase/server'
import { VDossiersComplets } from '@/types/database'
import { DossiersClient } from './dossiers-client'

async function getDossiers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_dossiers_complets')
    .select('*')
    .order('date_operation', { ascending: false })

  if (error) {
    console.error('Error fetching dossiers:', error)
    return []
  }

  return (data || []) as VDossiersComplets[]
}

export default async function DossiersPage() {
  const dossiers = await getDossiers()

  return <DossiersClient initialData={dossiers} />
}
