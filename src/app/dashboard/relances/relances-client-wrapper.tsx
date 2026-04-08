'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VDossiersComplets, Consultant } from '@/types/database'
import { RelancesClient } from './relances-client'

interface RelanceRow {
  id: string
  clientNom: string
  consultantNom: string
  consultantPrenom: string
  produitNom: string
  dateOperation: string
  typeRelance: 'kyc' | 'inactivite' | 'paiement' | 'reglementaire' | 'facture_aging'
  statut: string
  urgency: 'critical' | 'high' | 'medium'
  detail?: string
}

export function RelancesClientWrapper() {
  const [data, setData] = useState<RelanceRow[]>([])
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
          .select('id, statut, date_operation, date_facture, client_nom, consultant_nom, consultant_prenom, produit_nom, statut_kyc, der, pi, preco, lm, rm, facturee, payee')

        if (dossiersError) throw dossiersError

        // Fetch consultants for back_office filtering
        const { data: consultants, error: consultantsError } = await supabase
          .from('consultants')
          .select('id, nom, prenom')

        if (consultantsError) throw consultantsError

        // Build relance items
        const relances: RelanceRow[] = []
        const now = new Date()

        if (dossiers) {
          dossiers.forEach((dossier: VDossiersComplets) => {
            // Skip if no client or consultant name
            if (!dossier.client_nom || !dossier.consultant_nom) return

            // Skip back_office consultants
            if (dossier.consultant_nom?.toLowerCase() === 'back office') return

            const dateOperation = dossier.date_operation ? new Date(dossier.date_operation) : null
            const daysSinceOperation = dateOperation
              ? Math.floor((now.getTime() - dateOperation.getTime()) / (1000 * 60 * 60 * 24))
              : null

            // 1. KYC manquant: statut_kyc = false/'non' AND statut = 'client_en_cours'
            if (
              dossier.statut === 'client_en_cours' &&
              (dossier.statut_kyc === 'non' || dossier.statut_kyc === false)
            ) {
              relances.push({
                id: `kyc-${dossier.id}`,
                clientNom: dossier.client_nom || '',
                consultantNom: dossier.consultant_nom || '',
                consultantPrenom: dossier.consultant_prenom || '',
                produitNom: dossier.produit_nom || 'N/A',
                dateOperation: dossier.date_operation || '',
                typeRelance: 'kyc',
                statut: dossier.statut || '',
                urgency: 'critical',
              })
            }

            // 2. Inactivité 30j+: statut = 'client_en_cours' AND date_operation > 30 days ago
            if (
              dossier.statut === 'client_en_cours' &&
              daysSinceOperation !== null &&
              daysSinceOperation >= 30
            ) {
              relances.push({
                id: `inactivite-${dossier.id}`,
                clientNom: dossier.client_nom || '',
                consultantNom: dossier.consultant_nom || '',
                consultantPrenom: dossier.consultant_prenom || '',
                produitNom: dossier.produit_nom || 'N/A',
                dateOperation: dossier.date_operation || '',
                typeRelance: 'inactivite',
                statut: dossier.statut || '',
                urgency: daysSinceOperation >= 60 ? 'high' : 'medium',
              })
            }

            // 3. Paiement en attente: finalized dossiers where facturee=true but payee=false/null
            if (
              dossier.statut === 'client_finalise' &&
              dossier.facturee === true &&
              (dossier.payee === 'non' || dossier.payee === false || dossier.payee === null)
            ) {
              // Check if facture is aging (30j+ since date_facture)
              const dateFacture = dossier.date_facture ? new Date(dossier.date_facture) : null
              const daysSinceFacture = dateFacture
                ? Math.floor((now.getTime() - dateFacture.getTime()) / (1000 * 60 * 60 * 24))
                : null

              if (daysSinceFacture !== null && daysSinceFacture >= 30) {
                relances.push({
                  id: `facture_aging-${dossier.id}`,
                  clientNom: dossier.client_nom || '',
                  consultantNom: dossier.consultant_nom || '',
                  consultantPrenom: dossier.consultant_prenom || '',
                  produitNom: dossier.produit_nom || 'N/A',
                  dateOperation: dossier.date_operation || '',
                  typeRelance: 'facture_aging',
                  statut: dossier.statut || '',
                  urgency: daysSinceFacture >= 60 ? 'critical' : 'high',
                  detail: `Facture impayée depuis ${daysSinceFacture}j`,
                })
              } else {
                relances.push({
                  id: `paiement-${dossier.id}`,
                  clientNom: dossier.client_nom || '',
                  consultantNom: dossier.consultant_nom || '',
                  consultantPrenom: dossier.consultant_prenom || '',
                  produitNom: dossier.produit_nom || 'N/A',
                  dateOperation: dossier.date_operation || '',
                  typeRelance: 'paiement',
                  statut: dossier.statut || '',
                  urgency: 'high',
                })
              }
            }

            // 4. Réglementaire incomplet: finalized dossiers with missing compliance fields
            if (dossier.statut === 'client_finalise') {
              const missingFields: string[] = []
              if (dossier.statut_kyc !== 'oui' && dossier.statut_kyc !== true) missingFields.push('Réglementaire')
              if (!dossier.der) missingFields.push('DER')
              if (!dossier.pi) missingFields.push('PI')
              if (!dossier.preco) missingFields.push('PRECO')
              if (!dossier.lm) missingFields.push('LM')
              if (!dossier.rm) missingFields.push('RM')

              if (missingFields.length > 0) {
                relances.push({
                  id: `reglementaire-${dossier.id}`,
                  clientNom: dossier.client_nom || '',
                  consultantNom: dossier.consultant_nom || '',
                  consultantPrenom: dossier.consultant_prenom || '',
                  produitNom: dossier.produit_nom || 'N/A',
                  dateOperation: dossier.date_operation || '',
                  typeRelance: 'reglementaire',
                  statut: dossier.statut || '',
                  urgency: missingFields.length >= 4 ? 'critical' : missingFields.length >= 2 ? 'high' : 'medium',
                  detail: `Manquant : ${missingFields.join(', ')}`,
                })
              }
            }
          })
        }

        // Remove duplicates (a dossier could match multiple criteria)
        const uniqueRelances = Array.from(
          new Map(relances.map((item) => [item.id, item])).values()
        )

        // Sort by urgency (critical first) then by date
        uniqueRelances.sort((a, b) => {
          const urgencyOrder = { critical: 0, high: 1, medium: 2 }
          const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
          if (urgencyDiff !== 0) return urgencyDiff

          const dateA = new Date(a.dateOperation).getTime()
          const dateB = new Date(b.dateOperation).getTime()
          return dateA - dateB
        })

        setData(uniqueRelances)
      } catch (err) {
        console.error('Error fetching relances:', err)
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
        <p className="text-red-800">Erreur lors du chargement des relances: {error.message}</p>
      </div>
    )
  }

  return <RelancesClient initialData={data} />
}
