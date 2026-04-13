'use client'

import * as React from 'react'
import { VDossiersComplets } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Award, Pencil, Save, X, Loader2, TrendingUp, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/formatting'

const formatPct = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(2)}%`
}

interface CommissionPanelProps {
  dossier: VDossiersComplets
  isConsultant: boolean
  editingTaux: boolean
  editTauxEntree: string
  editTauxGestion: string
  savingTaux: boolean
  dossierHasEncours: boolean
  tauxEntree: number | null
  tauxGestion: number | null
  effectiveTauxEntree: number | null
  effectiveTauxGestion: number | null
  commissionBruteCalculee: number | null
  quarterlyEncoursCommission: number | null
  partConsultantEntree: number | null
  partConsultantEncours: number | null
  onEditTauxEntreeChange: (value: string) => void
  onEditTauxGestionChange: (value: string) => void
  onEditApporteurExtChange: (checked: boolean) => void
  onEditApporteurExtNomChange: (value: string) => void
  onEditApporteurExtTauxChange: (value: string) => void
  onToggleEditing: () => void
  onSaveTaux: () => void
  editApporteurExt: boolean
  editApporteurExtNom: string
  editApporteurExtTaux: string
  apporteurs?: { id: string; nom: string; prenom: string; taux_commission: number }[]
  editApporteurId?: string
  editApporteurTaux?: string
  showNewApporteurModal?: boolean
  newApporteurNom?: string
  newApporteurPrenom?: string
  newApporteurTauxDefaut?: string
  savingNewApporteur?: boolean
  onEditApporteurIdChange?: (v: string) => void
  onEditApporteurTauxChange?: (v: string) => void
  onShowNewApporteurModalChange?: (v: boolean) => void
  onNewApporteurNomChange?: (v: string) => void
  onNewApporteurPrenomChange?: (v: string) => void
  onNewApporteurTauxDefautChange?: (v: string) => void
  onCreateApporteur?: () => void
}

export function CommissionPanel({
  dossier,
  isConsultant,
  editingTaux,
  editTauxEntree,
  editTauxGestion,
  savingTaux,
  dossierHasEncours,
  tauxEntree,
  tauxGestion,
  effectiveTauxEntree,
  effectiveTauxGestion,
  commissionBruteCalculee,
  quarterlyEncoursCommission,
  partConsultantEntree,
  partConsultantEncours,
  onEditTauxEntreeChange,
  onEditTauxGestionChange,
  onEditApporteurExtChange,
  onEditApporteurExtNomChange,
  onEditApporteurExtTauxChange,
  onToggleEditing,
  onSaveTaux,
  editApporteurExt,
  editApporteurExtNom,
  editApporteurExtTaux,
  apporteurs = [],
  editApporteurId = '',
  editApporteurTaux = '',
  showNewApporteurModal = false,
  newApporteurNom = '',
  newApporteurPrenom = '',
  newApporteurTauxDefaut = '',
  savingNewApporteur = false,
  onEditApporteurIdChange,
  onEditApporteurTauxChange,
  onShowNewApporteurModalChange,
  onNewApporteurNomChange,
  onNewApporteurPrenomChange,
  onNewApporteurTauxDefautChange,
  onCreateApporteur,
}: CommissionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Award size={20} className="text-indigo-600" />
            {isConsultant ? 'Ma rémunération' : 'Détail de la commission'}
          </CardTitle>
          {!editingTaux && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={onToggleEditing}
            >
              <Pencil size={16} />
              Modifier les taux
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Taux editing section */}
        {editingTaux && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-amber-900">Modifier les taux de commission</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleEditing}
                className="text-gray-500"
              >
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Taux d'entrée (%)
                </label>
                <Input
                  type="number"
                  value={editTauxEntree}
                  onChange={(e) => onEditTauxEntreeChange(e.target.value)}
                  placeholder="1.25"
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full"
                />
                {tauxEntree && (
                  <p className="text-xs text-gray-500 mt-1">
                    Grille : {(tauxEntree * 100).toFixed(2)}%
                  </p>
                )}
              </div>

              {dossierHasEncours && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Taux de gestion (%)
                  </label>
                  <Input
                    type="number"
                    value={editTauxGestion}
                    onChange={(e) => onEditTauxGestionChange(e.target.value)}
                    placeholder="0.50"
                    step="0.01"
                    min="0"
                    max="100"
                    className="w-full"
                  />
                  {tauxGestion && (
                    <p className="text-xs text-gray-500 mt-1">
                      Grille : {(tauxGestion * 100).toFixed(2)}%
                    </p>
                  )}
                </div>
              )}

              {/* Apporteur externe */}
              <div className="border-t border-amber-200 pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Apporteur externe</label>
                  <button
                    type="button"
                    onClick={() => onEditApporteurExtChange(!editApporteurExt)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editApporteurExt ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${editApporteurExt ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {editApporteurExt && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Apporteur</label>
                      <div className="flex gap-1">
                        <select
                          value={editApporteurId}
                          onChange={(e) => {
                            onEditApporteurIdChange?.(e.target.value)
                            const found = apporteurs.find(a => a.id === e.target.value)
                            if (found && found.taux_commission > 0) onEditApporteurTauxChange?.((found.taux_commission * 100).toFixed(2))
                          }}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                        >
                          <option value="">— Sélectionner —</option>
                          {apporteurs.map(a => (
                            <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => onShowNewApporteurModalChange?.(true)}
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 text-indigo-600" title="Créer">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Taux apporteur (%)</label>
                      <Input
                        type="number"
                        value={editApporteurId ? editApporteurTaux : editApporteurExtTaux}
                        onChange={(e) => editApporteurId ? onEditApporteurTauxChange?.(e.target.value) : onEditApporteurExtTauxChange(e.target.value)}
                        placeholder="30"
                        step="0.01"
                        min="0"
                        max="100"
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleEditing}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-navy-700 hover:bg-navy-800 gap-2"
                onClick={onSaveTaux}
                disabled={savingTaux}
              >
                {savingTaux ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Sauvegarder
              </Button>
            </div>
          </div>
        )}

        {/* Droits d'entrée (souscription) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
            À la souscription (droits d'entrée)
          </p>
          {isConsultant ? (
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-indigo-700">Votre rémunération</p>
              <p className="text-2xl font-bold text-indigo-900 mt-1">{formatCurrency(partConsultantEntree)}</p>
              {effectiveTauxEntree && (
                <p className="text-xs text-indigo-600 mt-1">Taux commission : {formatPct(effectiveTauxEntree)}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`grid ${dossier.has_apporteur_ext && dossier.taux_apporteur_ext && dossier.taux_apporteur_ext > 0 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'} gap-3`}>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Commission brute</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatCurrency(commissionBruteCalculee)}
                  </p>
                  {effectiveTauxEntree ? (
                    <>
                      <p className="text-xs text-gray-500 mt-1">
                        {tauxEntree && dossier.taux_commission && (Math.abs(dossier.taux_commission - tauxEntree) > 0.00001)
                          ? `Grille : ${formatPct(tauxEntree)} → Appliqué : ${formatPct(dossier.taux_commission)}`
                          : `Taux appliqué : ${formatPct(effectiveTauxEntree)}`
                        }
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(dossier.montant)} × {formatPct(effectiveTauxEntree)}</p>
                    </>
                  ) : null}
                </div>
                {dossier.has_apporteur_ext && dossier.taux_apporteur_ext && dossier.taux_apporteur_ext > 0 && (
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-sm text-orange-600">Part apporteur ({dossier.apporteur_ext_nom || 'Externe'})</p>
                    <p className="text-xl font-bold text-orange-900 mt-1">
                      {formatCurrency(dossier.rem_apporteur_ext)}
                    </p>
                    <p className="text-xs text-orange-500 mt-1">
                      {formatPct(dossier.taux_apporteur_ext)} de {formatCurrency(commissionBruteCalculee)}
                    </p>
                  </div>
                )}
                {(partConsultantEntree !== null && partConsultantEntree !== undefined) && (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-sm text-indigo-600">Part consultant</p>
                    <p className="text-xl font-bold text-indigo-900 mt-1">{formatCurrency(partConsultantEntree)}</p>
                    {dossier.taux_remuneration && (
                      <p className="text-xs text-indigo-500 mt-1">
                        ({formatPct(dossier.taux_remuneration)} de {formatCurrency(commissionBruteCalculee)})
                      </p>
                    )}
                  </div>
                )}
              </div>
              {dossier.produit_nom && dossier.compagnie_nom && (
                <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                  {dossier.produit_nom} · {dossier.compagnie_nom} · {dossier.financement || '-'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Encours trimestriel — uniquement pour PE, CAPI LUX, CAV LUX */}
        {dossierHasEncours && (effectiveTauxGestion || quarterlyEncoursCommission !== null) && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1">
              <TrendingUp size={13} />
              Sur encours (rémunération trimestrielle)
            </p>
            {isConsultant ? (
              partConsultantEncours !== null ? (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-700">Votre part estimée / trimestre</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {formatCurrency(partConsultantEncours)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Taux gestion : {formatPct(effectiveTauxGestion)} · Encours : {formatCurrency(dossier.montant)}
                  </p>
                </div>
              ) : effectiveTauxGestion ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Frais de gestion annuels (cabinet)</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {formatCurrency((dossier.montant || 0) * effectiveTauxGestion)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Taux gestion : {formatPct(effectiveTauxGestion)}</p>
                </div>
              ) : null
            ) : (
              effectiveTauxGestion && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Encours annuel</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatCurrency((dossier.montant || 0) * effectiveTauxGestion)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tauxGestion && dossier.taux_gestion && (Math.abs(dossier.taux_gestion - tauxGestion) > 0.00001)
                        ? `Grille : ${formatPct(tauxGestion)} → Appliqué : ${formatPct(dossier.taux_gestion)}`
                        : `Taux appliqué : ${formatPct(effectiveTauxGestion)}`
                      }
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Par trimestre</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {formatCurrency(quarterlyEncoursCommission)}
                    </p>
                    {partConsultantEncours !== null && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Part consultant : {formatCurrency(partConsultantEncours)}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Status note for non-finalised */}
        {dossier.statut !== 'client_finalise' && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">
            ⚠ Dossier non finalisé — ces montants sont des estimations basées sur le montant actuel.
          </p>
        )}
      </CardContent>
    </Card>

      {showNewApporteurModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onShowNewApporteurModalChange?.(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Nouvel apporteur</h3>
              <button onClick={() => onShowNewApporteurModalChange?.(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Prénom</label>
                  <Input value={newApporteurPrenom} onChange={(e) => onNewApporteurPrenomChange?.(e.target.value)} placeholder="Prénom" className="w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Nom</label>
                  <Input value={newApporteurNom} onChange={(e) => onNewApporteurNomChange?.(e.target.value)} placeholder="Nom" className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Taux habituel (%) — optionnel</label>
                <Input type="number" value={newApporteurTauxDefaut} onChange={(e) => onNewApporteurTauxDefautChange?.(e.target.value)} placeholder="ex: 20" step="0.01" min="0" max="100" className="w-full" />
              </div>
              <div className="flex gap-2 pt-2">
                <button className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50" onClick={() => onShowNewApporteurModalChange?.(false)}>Annuler</button>
                <button className="flex-1 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-1"
                  onClick={onCreateApporteur} disabled={savingNewApporteur || !newApporteurNom.trim() || !newApporteurPrenom.trim()}>
                  {savingNewApporteur ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  )
  }
