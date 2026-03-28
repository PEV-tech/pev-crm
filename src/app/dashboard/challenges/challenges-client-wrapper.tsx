'use client'

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'
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
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const currentYear = new Date().getFullYear()

        const [consultantsRes, challengesRes, dossiersRes] = await Promise.all([
          supabase
            .from('consultants')
            .select('*')
            .eq('actif', true),
          supabase
            .from('challenges')
            .select('*')
            .eq('annee', currentYear),
          supabase
            .from('v_dossiers_complets')
            .select('*'),
        ])

        const consultants = consultantsRes.data || []
        const challenges = challengesRes.data || []
        const dossiers = dossiersRes.data || []

        const result = consultants.map((consultant: any) => {
          const challenge = challenges.find((c: any) => c.consultant_id === consultant.id)
          const collecte = dossiers
            .filter((d: any) => d.consultant_nom === consultant.nom && d.statut === 'client_finalise')
            .reduce((sum: number, d: any) => sum + (d.montant || 0), 0) || 0

          return {
            consultant: consultant.nom || consultant.prenom || 'Inconnu',
            objectif: challenge?.objectif || 0,
            collecte: collecte,
            challengeId: challenge?.id,
          }
        })

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
