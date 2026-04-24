'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'

interface ConsultantPaliersProps {
  consultantId: string
  taux_remuneration?: number | null
}

interface GrilleRow {
  ca_min: number
  ca_max: number | null
  taux_remuneration: number
}

// Consultants couverts par le contrat Mandat d'intérêt commun (paliers 65/75/85)
const MANDAT_PRENOMS = ['Guillaume', 'James', 'Hugues', 'Valentin', 'Gilles', 'Véronique', 'Veronique']

/**
 * Panneau dépliable "Paliers 65 / 75 / 85" affiché sur la fiche consultant.
 * Calcule le CA cabinet cumulé sur 12 mois glissants pour ce consultant, en déduit
 * le palier marginal actuel et l'écart jusqu'au palier suivant.
 *
 * Formule (contrat Mandat d'intérêt commun, art. 8) :
 *   - 0 → 75 000 €          : 65 % part consultant
 *   - 75 001 → 100 000 €    : 75 % part consultant
 *   - > 100 000 €           : 85 % part consultant
 * Ces taux sont MARGINAUX (appliqués par tranche), pas cumulatifs.
 * Assiette : CA encaissé par le cabinet pour le compte du Mandataire sur 12 mois
 * glissants. On prend ici dossiers.commission_brute des dossiers facturés du
 * consultant sur [J-365, J].
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export function ConsultantPaliers({ consultantId }: ConsultantPaliersProps) {
  const supabase = React.useMemo(() => createClient() as AnyClient, [])
  const [caRolling, setCaRolling] = React.useState<number | null>(null)
  const [grilles, setGrilles] = React.useState<GrilleRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [prenom, setPrenom] = React.useState<string>('')

  const now = React.useMemo(() => new Date(), [])
  const from = React.useMemo(() => {
    const d = new Date(now)
    d.setFullYear(d.getFullYear() - 1)
    return d
  }, [now])

  const fetchAll = React.useCallback(async () => {
    setLoading(true)
    const fromIso = from.toISOString().slice(0, 10)
    const toIso = now.toISOString().slice(0, 10)
    const [consRes, dossiersRes, grillesRes] = await Promise.all([
      supabase.from('consultants').select('prenom').eq('id', consultantId).maybeSingle(),
      supabase
        .from('v_dossiers_complets')
        .select('commission_brute, date_facture, facturee')
        .eq('consultant_id', consultantId)
        .eq('facturee', true)
        .gte('date_facture', fromIso)
        .lte('date_facture', toIso),
      supabase
        .from('grilles_commissionnement')
        .select('ca_min, ca_max, taux_remuneration')
        .order('ca_min'),
    ])

    setPrenom(consRes.data?.prenom || '')
    const total = (dossiersRes.data || []).reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, d: any) => sum + (Number(d.commission_brute) || 0),
      0,
    )
    setCaRolling(total)
    setGrilles(grillesRes.data || [])
    setLoading(false)
  }, [consultantId, supabase, from, now])

  React.useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const isMandatScope = MANDAT_PRENOMS.includes(prenom)

  // Détermine le palier courant + écart jusqu'au suivant
  const { currentTier, nextTierGap, nextTierLabel } = React.useMemo(() => {
    if (caRolling === null || grilles.length === 0) {
      return { currentTier: null as GrilleRow | null, nextTierGap: null as number | null, nextTierLabel: '' }
    }
    const current = grilles.find(
      (g) => caRolling >= g.ca_min && (g.ca_max === null || caRolling <= g.ca_max),
    ) || grilles[grilles.length - 1]
    const idx = grilles.findIndex((g) => g === current)
    const next = idx >= 0 && idx < grilles.length - 1 ? grilles[idx + 1] : null
    const gap = next && current.ca_max !== null ? current.ca_max + 1 - caRolling : null
    const label = next ? `${Math.round(next.taux_remuneration * 100)} %` : 'palier maximum'
    return { currentTier: current, nextTierGap: gap, nextTierLabel: label }
  }, [caRolling, grilles])

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" />
        Chargement des paliers…
      </div>
    )
  }

  if (!isMandatScope) {
    return (
      <p className="text-xs text-gray-500 italic">
        Ce consultant n'est pas sur le contrat Mandat d'intérêt commun 65/75/85 (arrangement séparé).
      </p>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="text-xs text-gray-500">
        Fenêtre 12 mois glissants : <strong>{formatDate(from)}</strong> → <strong>{formatDate(now)}</strong>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-xs text-indigo-700">CA cabinet cumulé (12 mois)</p>
          <p className="text-xl font-bold text-indigo-900 mt-1">{formatCurrency(caRolling || 0)}</p>
        </div>

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-700">Palier actuel</p>
          <p className="text-xl font-bold text-green-900 mt-1">
            {currentTier ? `${Math.round(currentTier.taux_remuneration * 100)} %` : '—'}
          </p>
          {currentTier && (
            <p className="text-xs text-green-700 mt-0.5">
              tranche {formatCurrency(currentTier.ca_min)}
              {currentTier.ca_max !== null ? ` – ${formatCurrency(currentTier.ca_max)}` : ' +'}
            </p>
          )}
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">Écart palier suivant</p>
          <p className="text-xl font-bold text-amber-900 mt-1">
            {nextTierGap !== null ? formatCurrency(nextTierGap) : '—'}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            pour atteindre le palier {nextTierLabel}
          </p>
        </div>
      </div>

      {grilles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Progression des paliers marginaux</p>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
            {grilles.map((g, i) => {
              const isCurrent = currentTier === g
              const width =
                g.ca_max === null
                  ? 30
                  : Math.max(10, Math.min(50, ((g.ca_max - g.ca_min) / 100000) * 30))
              return (
                <div
                  key={i}
                  className={`h-full ${isCurrent ? 'bg-green-500' : 'bg-gray-300'}`}
                  style={{ width: `${width}%` }}
                  title={`${Math.round(g.taux_remuneration * 100)} % sur ${formatCurrency(g.ca_min)}${g.ca_max !== null ? ` – ${formatCurrency(g.ca_max)}` : '+'}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            {grilles.map((g, i) => (
              <span key={i}>{Math.round(g.taux_remuneration * 100)} %</span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-400 italic">
        Le CA cumulé est calculé à partir des dossiers facturés de ce consultant sur la fenêtre 12 mois glissants.
        Taux marginaux : chaque tranche est taxée à son propre taux (pas de cumul).
      </p>
    </div>
  )
}
