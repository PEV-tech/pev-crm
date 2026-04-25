'use client'

/**
 * src/app/dashboard/encours/new-encours-modal.tsx
 *
 * Modale "+ Encours" — saisie unifiée d'un lot avec ses lignes.
 *
 * Flow :
 *   1. Métadonnées du lot (partenaire, période, date réception, commentaire)
 *   2. Tableau dynamique : N lignes (client + montant), max 30
 *   3. Submit → POST batch + N x POST lines (parallèle) → redirection
 *      vers /dashboard/encours/[id] où la preview des allocations
 *      s'affiche pour validation finale.
 *
 * Le consultant rattaché à chaque ligne est dérivé automatiquement du
 * dossier (via v_dossiers_complets). Pas de saisie manuelle. La règle
 * de commission appliquée à chaque ligne est celle de SON consultant
 * (déterminée par determineRule au moment de la validation).
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Search, Trash2, Plus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export interface NewEncoursModalProps {
  isOpen: boolean
  onClose: () => void
  /** Si fourni, appelé avec l'id du batch créé. Sinon redirection auto vers /dashboard/encours/[id]. */
  onCreated?: (batchId: string) => void
}

interface CompagnieOption { id: string; nom: string | null }

interface DossierSuggestion {
  id: string
  client_nom: string | null
  client_prenom: string | null
  produit_nom: string | null
  compagnie_nom: string | null
  consultant_prenom: string | null
  consultant_nom: string | null
}

interface DraftLine {
  /** ID local stable pour la clé React (pas en DB) */
  uid: string
  dossier: DossierSuggestion | null
  /** Texte tapé dans l'autocomplete tant que rien n'est sélectionné */
  query: string
  /** Suggestions affichées sous le champ (par ligne) */
  suggestions: DossierSuggestion[]
  /** Loader pendant la recherche */
  searching: boolean
  /** Dropdown ouvert (par ligne) */
  dropdownOpen: boolean
  /** Montant en string (pour parser . et ,) */
  montantStr: string
}

const MAX_LINES = 30
const SOFT_WARN_AT = 25

const CURRENT_YEAR = new Date().getUTCFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

const fmtEUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

function computeTrimestreBounds(annee: number, trimestre: number): { debut: string; fin: string } {
  const t = Math.max(1, Math.min(4, trimestre))
  const startMonth = (t - 1) * 3
  const endMonth = startMonth + 2
  const debut = new Date(Date.UTC(annee, startMonth, 1))
  const fin = new Date(Date.UTC(annee, endMonth + 1, 0))
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { debut: iso(debut), fin: iso(fin) }
}

function makeUid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function emptyLine(): DraftLine {
  return { uid: makeUid(), dossier: null, query: '', suggestions: [], searching: false, dropdownOpen: false, montantStr: '' }
}

function formatDossierLabel(d: DossierSuggestion): string {
  const client = [d.client_prenom, d.client_nom].filter(Boolean).join(' ').trim()
  const produit = d.produit_nom ?? '(produit ?)'
  const comp = d.compagnie_nom ?? '—'
  return `${client || '(client ?)'} · ${produit} · ${comp}`
}

function consultantLabel(d: DossierSuggestion | null): string {
  if (!d) return '—'
  const c = [d.consultant_prenom, d.consultant_nom].filter(Boolean).join(' ').trim()
  return c || '—'
}

export function NewEncoursModal({ isOpen, onClose, onCreated }: NewEncoursModalProps) {
  const router = useRouter()

  // Métadonnées du lot
  const [compagnieId, setCompagnieId] = React.useState<string>('')
  const [partenaireLabel, setPartenaireLabel] = React.useState<string>('')
  const [annee, setAnnee] = React.useState<number>(CURRENT_YEAR)
  const [trimestre, setTrimestre] = React.useState<number>(1)
  const [dateReception, setDateReception] = React.useState<string>('')
  const [commentaire, setCommentaire] = React.useState<string>('')

  // Lignes
  const [lines, setLines] = React.useState<DraftLine[]>(() => [emptyLine()])

  // UI state
  const [compagnies, setCompagnies] = React.useState<CompagnieOption[]>([])
  const [submitting, setSubmitting] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  // Reset à l'ouverture
  React.useEffect(() => {
    if (!isOpen) return
    setCompagnieId(''); setPartenaireLabel('')
    setAnnee(CURRENT_YEAR)
    const m = new Date().getUTCMonth()
    setTrimestre(Math.floor(m / 3) + 1)
    setDateReception(new Date().toISOString().slice(0, 10))
    setCommentaire('')
    setLines([emptyLine()])
    setErrorMsg(null)
  }, [isOpen])

  // Charge compagnies
  React.useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('compagnies').select('id, nom').order('nom', { ascending: true })
      if (cancelled) return
      if (error) { console.error('[NewEncoursModal] load compagnies', error.message); setCompagnies([]) }
      else setCompagnies((data ?? []) as CompagnieOption[])
    }
    void load()
    return () => { cancelled = true }
  }, [isOpen])

  // Escape
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, submitting])

  // Search debounced par ligne — un seul useEffect qui gère toutes les lignes
  React.useEffect(() => {
    if (!isOpen) return
    const timers: number[] = []

    lines.forEach((line) => {
      if (line.dossier && line.query === formatDossierLabel(line.dossier)) return
      const q = line.query.trim()
      if (q.length < 2) {
        if (line.suggestions.length > 0) {
          setLines((prev) => prev.map((l) => l.uid === line.uid ? { ...l, suggestions: [] } : l))
        }
        return
      }
      const t = window.setTimeout(() => { void searchForLine(line.uid, q) }, 300)
      timers.push(t)
    })

    return () => { timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.map((l) => `${l.uid}:${l.query}:${l.dossier?.id ?? ''}`).join('|'), isOpen])

  const searchForLine = async (uid: string, q: string) => {
    setLines((prev) => prev.map((l) => l.uid === uid ? { ...l, searching: true } : l))
    try {
      const supabase = createClient()
      const term = `%${q}%`
      const { data, error } = await supabase
        .from('v_dossiers_complets')
        .select('id, client_nom, client_prenom, produit_nom, compagnie_nom, consultant_prenom, consultant_nom')
        .or(`client_nom.ilike.${term},client_prenom.ilike.${term}`)
        .limit(8)
      if (error) { console.error('[NewEncoursModal] search', error.message); return }
      setLines((prev) => prev.map((l) => l.uid === uid
        ? { ...l, searching: false, suggestions: (data ?? []) as DossierSuggestion[] }
        : l))
    } catch {
      setLines((prev) => prev.map((l) => l.uid === uid ? { ...l, searching: false } : l))
    }
  }

  const updateLine = (uid: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => l.uid === uid ? { ...l, ...patch } : l))
  }

  const addLine = () => {
    if (lines.length >= MAX_LINES) return
    setLines((prev) => [...prev, emptyLine()])
  }

  const removeLine = (uid: string) => {
    setLines((prev) => prev.length === 1 ? [emptyLine()] : prev.filter((l) => l.uid !== uid))
  }

  const selectDossier = (uid: string, d: DossierSuggestion) => {
    updateLine(uid, { dossier: d, query: formatDossierLabel(d), suggestions: [], dropdownOpen: false })
  }

  const clearDossier = (uid: string) => {
    updateLine(uid, { dossier: null, query: '', suggestions: [] })
  }

  // Total temps réel
  const total = lines.reduce((s, l) => {
    const m = Number((l.montantStr || '').replace(',', '.'))
    return s + (Number.isFinite(m) ? m : 0)
  }, 0)

  // Lignes valides : un dossier sélectionné + un montant > 0
  const validLines = lines.filter((l) => {
    const m = Number((l.montantStr || '').replace(',', '.'))
    return l.dossier !== null && Number.isFinite(m) && m > 0
  })

  const canSubmit = validLines.length > 0 && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setErrorMsg(null)

    const bounds = computeTrimestreBounds(annee, trimestre)
    const batchPayload: Record<string, unknown> = {
      source_type: 'manuel',
      annee, trimestre,
      periode_debut: bounds.debut, periode_fin: bounds.fin,
    }
    if (compagnieId) batchPayload.compagnie_id = compagnieId
    if (partenaireLabel.trim()) batchPayload.partenaire_label = partenaireLabel.trim()
    if (dateReception) batchPayload.date_reception = dateReception
    if (commentaire.trim()) batchPayload.commentaire = commentaire.trim()

    setSubmitting(true)
    try {
      // 1. Créer le lot
      const batchRes = await fetch('/api/encours/batches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
      })
      const batchJson = (await batchRes.json().catch(() => null)) as { data?: { id: string }; error?: string } | null
      if (!batchRes.ok || !batchJson?.data?.id) {
        setErrorMsg(batchJson?.error ?? `Création du lot échouée (HTTP ${batchRes.status})`)
        return
      }
      const batchId = batchJson.data.id

      // 2. Insérer les lignes en parallèle
      const linePayloads = validLines.map((l) => ({
        batch_id: batchId,
        type_commission: 'encours' as const,
        montant_brut_percu: Number((l.montantStr || '').replace(',', '.')),
        dossier_id: l.dossier!.id,
        statut_rapprochement: 'rapproche_manuel' as const,
        periode_reference_debut: bounds.debut,
        periode_reference_fin: bounds.fin,
      }))

      const lineResponses = await Promise.allSettled(
        linePayloads.map((p) => fetch('/api/encours/lines', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        })),
      )

      const failed = lineResponses.filter((r) =>
        r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      ).length

      if (failed > 0) {
        // Le batch est créé mais certaines lignes ont planté. On ne supprime
        // pas le batch (l'utilisateur peut compléter sur la page détail).
        setErrorMsg(`${failed} ligne(s) sur ${linePayloads.length} n'ont pas pu être créées. Le lot est créé en brouillon, va sur le détail pour corriger.`)
        // Quand même rediriger après un délai court pour montrer l'erreur
        setTimeout(() => {
          if (onCreated) onCreated(batchId)
          else router.push(`/dashboard/encours/${batchId}`)
          onClose()
        }, 2500)
        return
      }

      // 3. Succès complet → redirection
      if (onCreated) onCreated(batchId)
      else router.push(`/dashboard/encours/${batchId}`)
      onClose()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />

      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nouveau lot d&apos;encours</h2>
            <p className="text-xs text-gray-500 mt-0.5">Saisie manuelle — sélectionne les clients concernés et leurs montants.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" aria-label="Fermer">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
          {/* Bloc 1 — Métadonnées du lot */}
          <div className="px-5 py-4 space-y-3 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Partenaire</label>
                <select value={compagnieId} onChange={(e) => setCompagnieId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Aucun (label libre) —</option>
                  {compagnies.map((c) => (<option key={c.id} value={c.id}>{c.nom ?? '(sans nom)'}</option>))}
                </select>
                {!compagnieId && (
                  <input type="text" placeholder="Ou libellé partenaire" value={partenaireLabel} onChange={(e) => setPartenaireLabel(e.target.value)}
                    className="mt-2 w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Année</label>
                  <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value, 10))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {YEAR_OPTIONS.map((y) => (<option key={y} value={y}>{y}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Trimestre</label>
                  <select value={trimestre} onChange={(e) => setTrimestre(parseInt(e.target.value, 10))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={1}>T1</option><option value={2}>T2</option><option value={3}>T3</option><option value={4}>T4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Réception</label>
                  <input type="date" value={dateReception} onChange={(e) => setDateReception(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Commentaire (optionnel)</label>
              <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Ex: relevé Cardif T2 2026"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Bloc 2 — Lignes */}
          <div className="px-5 py-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Clients concernés <span className="text-xs text-gray-500 font-normal">({validLines.length} valide{validLines.length > 1 ? 's' : ''} sur {lines.length})</span>
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={lines.length >= MAX_LINES} className="gap-1">
                <Plus size={14} />Ajouter un client
              </Button>
            </div>

            {lines.length >= SOFT_WARN_AT && (
              <div className="mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2 flex items-center gap-2">
                <AlertTriangle size={12} />
                {lines.length} ligne(s) sur {MAX_LINES} maximum. Pour des lots plus gros, utilise plusieurs lots.
              </div>
            )}

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={line.uid} className="grid grid-cols-12 gap-2 items-start bg-white border border-gray-200 rounded-md p-2">
                  <div className="col-span-1 flex items-center justify-center text-xs text-gray-400 pt-2">{idx + 1}</div>

                  <div className="col-span-6 relative">
                    {line.dossier ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                        <span className="text-sm text-gray-800 flex-1 truncate">{formatDossierLabel(line.dossier)}</span>
                        <button type="button" onClick={() => clearDossier(line.uid)} className="text-xs text-gray-500 hover:text-gray-700 underline">Changer</button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="text" value={line.query}
                            onChange={(e) => updateLine(line.uid, { query: e.target.value, dropdownOpen: true })}
                            onFocus={() => updateLine(line.uid, { dropdownOpen: true })}
                            placeholder="Rechercher un client (min. 2 lettres)…"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        {line.dropdownOpen && line.query.trim().length >= 2 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {line.searching ? (
                              <div className="px-3 py-3 text-xs text-gray-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin" />Recherche…</div>
                            ) : line.suggestions.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-500">Aucun dossier trouvé</div>
                            ) : (line.suggestions.map((d) => (
                              <button key={d.id} type="button" onClick={() => selectDossier(line.uid, d)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-100 last:border-b-0">
                                <div className="font-medium text-gray-900 truncate">{[d.client_prenom, d.client_nom].filter(Boolean).join(' ').trim() || '(client ?)'}</div>
                                <div className="text-xs text-gray-500 truncate">{d.produit_nom ?? '—'} · {d.compagnie_nom ?? '—'} · Consultant : {consultantLabel(d)}</div>
                              </button>
                            )))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="col-span-3 pt-2">
                    <span className="text-xs text-gray-600">{line.dossier ? consultantLabel(line.dossier) : <span className="text-gray-400">—</span>}</span>
                  </div>

                  <div className="col-span-1 pt-1">
                    <input type="text" inputMode="decimal" value={line.montantStr}
                      onChange={(e) => updateLine(line.uid, { montantStr: e.target.value })}
                      placeholder="0,00"
                      className="w-full border border-gray-300 rounded-md px-2 py-2 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="col-span-1 flex items-center justify-center pt-1">
                    <button type="button" onClick={() => removeLine(line.uid)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Retirer cette ligne">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* En-tête colonnes (rappel) */}
            <div className="grid grid-cols-12 gap-2 px-2 mt-3 text-xs text-gray-400 uppercase tracking-wide">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-6">Client / Dossier</div>
              <div className="col-span-3">Consultant rattaché (auto)</div>
              <div className="col-span-1 text-right">Montant €</div>
              <div className="col-span-1"></div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">Total brut</p>
              <p className="text-lg font-bold tabular-nums text-gray-900">{fmtEUR.format(total)}</p>
            </div>
            <div className="flex items-center gap-2">
              {errorMsg && (<p className="text-xs text-red-700 max-w-md">{errorMsg}</p>)}
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (<><Loader2 size={16} className="animate-spin mr-2" />Création…</>) : (<>Créer le lot ({validLines.length})</>)}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
