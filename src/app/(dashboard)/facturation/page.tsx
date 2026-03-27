import { createClient } from '@/lib/supabase/server'
import { VDossiersComplets } from '@/types/database'
import { FacturationClient } from './facturation-client'

async function getFacturationData() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_dossiers_complets')
    .select('*')
    .eq('statut', 'client_finalise')
    .order('date_operation', { ascending: false })

  if (error) {
    console.error('Error fetching facturation data:', error)
    return []
  }

  return (data || []) as VDossiersComplets[]
}

export default async function FacturationPage() {
  const data = await getFacturationData()

  return <FacturationClient initialData={data} />
}
