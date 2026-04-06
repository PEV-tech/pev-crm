'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChallengesClient } from './challenges-client'

interface ChallengeData {
  consultant: string
  objectif: number
  collecte: number
  challengeId?: string
}

export function ChallengesClientWrapper() {
  const [data, setData] = React.useState<ChallengeData[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient()

        const currentYear = new Date().getFullYear()

        const [consultantsRes, challengesRes, dossiersRes] = await Promise.all([
          supabase
            .from('consultants')
            .select('*')
            .eq('actif', true)
            .neq('role', 'back_office'),
          supabase
            .from('challenges')
            .select('*')
            .eq('annee', currentYear),
          supabase
            .from('v_dossiers_complets')
            .select('*')
            .eq('statut', 'client_finalise'),
        ])

        const consultants = consultantsRes.data || []
        const challenges = challengesRes.data || []
        const dossiers = dossiersRes.data || []

        const result = consultants
          .filter((c: any) => c.role === 'consultant' || c.role === 'manager')
          .map((consultant: any) => {
            const challenge = challenges.find((c: any) => c.consultant_id === consultant.id)

            // Calculate collecte from finalized dossiers matching this consultant
            const collecte = dossiers
              .filter((d: any) => d.consultant_nom === consultant.nom)
              .reduce((sum: number, d: any) => sum + (d.montant || 0), 0)

            return {
              consultant: `${consultant.prenom} ${consultant.nom}`,
              objectif: challenge?.objectif || 0,
              collecte: collecte,
              challengeId: challenge?.id,
            }
          })
          .sort((a, b) => b.collecte - a.collecte)

        setData(result)
      } catch (error) {
        console.error('Error fetching challenges data:', error)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>
  }

  return <ChallengesClient initialData={data} />
}
