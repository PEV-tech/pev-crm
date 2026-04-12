'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'

interface CompliancePanelProps {
  isEditing: boolean
  reglementaireDone: number
  dossier: {
    statut_kyc?: string | null
    der?: boolean | null
    pi?: boolean | null
    preco?: boolean | null
    lm?: boolean | null
    rm?: boolean | null
  }
  editForm: Record<string, any>
  onEditFormChange: (name: string, value: string) => void
}

export function CompliancePanel({
  isEditing,
  reglementaireDone,
  dossier,
  editForm,
  onEditFormChange,
}: CompliancePanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Réglementaire</CardTitle>
          {!isEditing && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              reglementaireDone === 6 ? 'bg-green-100 text-green-700' :
              reglementaireDone >= 4 ? 'bg-blue-100 text-blue-700' :
              reglementaireDone >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>{reglementaireDone}/6</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!isEditing && (() => {
          const pct = (reglementaireDone / 6) * 100
          return (
            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${
                  pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : pct >= 30 ? 'bg-amber-500' : 'bg-red-500'
                }`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })()}
        {isEditing ? (
          <>
            {[
              { name: 'statut_kyc', label: 'KYC' },
              { name: 'der', label: 'DER' },
              { name: 'pi', label: 'PI' },
              { name: 'preco', label: 'PRECO' },
              { name: 'lm', label: 'LM' },
              { name: 'rm', label: 'RM' },
            ].map(({ name, label }) => (
              <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <Select
                  name={name}
                  value={editForm[name] || 'non'}
                  onChange={(e) => onEditFormChange(name, e.target.value)}
                  className="w-32"
                >
                  <option value="non">Non</option>
                  <option value="en_cours">En cours</option>
                  <option value="oui">Oui</option>
                </Select>
              </div>
            ))}
          </>
        ) : (
          <>
            {[
              { label: 'KYC', value: dossier.statut_kyc === 'oui', enCours: dossier.statut_kyc === 'en_cours' },
              { label: 'DER', value: !!dossier.der },
              { label: 'PI', value: !!dossier.pi },
              { label: 'PRECO', value: !!dossier.preco },
              { label: 'LM', value: !!dossier.lm },
              { label: 'RM', value: !!dossier.rm },
            ].map(({ label, value, enCours }) => (
              <div key={label} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <Badge variant={value ? 'success' : enCours ? 'warning' : 'destructive'}>
                  {value ? 'Validé' : enCours ? 'En cours' : 'Non validé'}
                </Badge>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
