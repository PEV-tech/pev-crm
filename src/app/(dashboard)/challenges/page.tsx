import { createClient } from '@/lib/supabase/server'
import { ChallengesClient } from './challenges-client'

async function getChallengesData() {
  const supabase = await createClient()

  // Get current year
  const currentYear = new Date().getFullYear()

  // Get all consultants
  const { data: consultants, error: consultantsError } = await supabase
    .from('consultants')
    .select('*')
    .eq('actif', true)

  if (consultantsError) {
    console.error('Error fetching consultants:', consultantsError)
    return []
  }

  // Get challenges
  const { data: challenges, error: challengesError } = await supabase
    .from('challenges')
    .select('*')
    .eq('annee', currentYear) as { data: any[]; error: any }

  if (challengesError) {
    console.error('Error fetching challenges:', challengesError)
    return []
  }

  // Get collecte data
  const { data: dossiers, error: dossiersError } = await supabase
    .from('v_dossiers_complets')
    .select('*')

  if (dossiersError) {
    console.error('Error fetching dossiers:', dossiersError)
    return []
  }

  // Merge data
  const result = (consultants ?? []).map((consultant: any) => {
    const challenge = (challenges ?? []).find((c: any) => c.consultant_id === consultant.id)
    const collecte = (dossiers ?? [])
      .filter((d: any) => d.consultant_nom === consultant.nom && d.statut === 'client_finalise')
      .reduce((sum: number, d: any) => sum + (d.montant || 0), 0) || 0

    return {
      consultant: consultant.nom || consultant.prenom || 'Inconnu',
      objectif: challenge?.objectif || 0,
      collecte: collecte,
      challengeId: challenge?.id,
    }
  })

  return result
}

export default async function ChallengesPage() {
  const data = await getChallengesData()

  return <ChallengesClient initialData={data} />
}
