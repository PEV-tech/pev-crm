'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VDossiersComplets } from '@/types/database'
import { Podium } from './podium'

interface PodiumData {
  rank: number
  consultantNom: string
  consultantPrenom: string
  collecte: number
  nbDossiers: number
}

export function PodiumWrapper() {
  const [data, setData] = useState<PodiumData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const supabase = createClient()

        // Fetch complete dossiers view
        const { data: dossiers, error: dossiersError } = await supabase
          .from('v_dossiers_complets')
          .select('consultant_nom, consultant_prenom, montant, statut')

        if (dossiersError) throw dossiersError

        // Filter and aggregate
        const consultantMap = new Map<
          string,
          { nom: string; prenom: string; collecte: number; nbDossiers: number }
        >()

        if (dossiers) {
          dossiers.forEach((dossier: VDossiersComplets) => {
            // Filter: statut = 'client_finalise' AND skip back_office
            if (dossier.statut !== 'client_finalise') return
            if (!dossier.consultant_nom || dossier.consultant_nom.toLowerCase() === 'back office')
              return

            const key = `${dossier.consultant_nom}-${dossier.consultant_prenom}`
            const current = consultantMap.get(key) || {
              nom: dossier.consultant_nom,
              prenom: dossier.consultant_prenom || '',
              collecte: 0,
              nbDossiers: 0,
            }

            current.collecte += dossier.montant || 0
            current.nbDossiers += 1

            consultantMap.set(key, current)
          })
        }

        // Convert to array and sort by collecte descending
        const podiumData = Array.from(consultantMap.values())
          .map((item, index) => ({
            rank: index + 1,
            consultantNom: item.nom,
            consultantPrenom: item.prenom,
            collecte: item.collecte,
            nbDossiers: item.nbDossiers,
          }))
          .sort((a, b) => b.collecte - a.collecte)
          .map((item, index) => ({
            ...item,
            rank: index + 1,
          }))

        setData(podiumData)
      } catch (err) {
        console.error('Error fetching podium data:', err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-red-800">
          Erreur lors du chargement du podium: {error.message}
        </p>
      </div>
    )
  }

  return <Podium data={data} />
}
