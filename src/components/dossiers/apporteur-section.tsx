'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'

interface ApporteurSectionProps {
  editApporteurExt: boolean
  editApporteurExtNom: string
  editApporteurExtTaux: string
  onToggleApporteurExt: (checked: boolean) => void
  onApporteurExtNomChange: (value: string) => void
  onApporteurExtTauxChange: (value: string) => void
}

export function ApporteurSection({
  editApporteurExt,
  editApporteurExtNom,
  editApporteurExtTaux,
  onToggleApporteurExt,
  onApporteurExtNomChange,
  onApporteurExtTauxChange,
}: ApporteurSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Apporteur externe</label>
        <button
          type="button"
          onClick={() => onToggleApporteurExt(!editApporteurExt)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editApporteurExt ? 'bg-indigo-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${editApporteurExt ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {editApporteurExt && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Nom de l'apporteur</label>
            <Input
              type="text"
              value={editApporteurExtNom}
              onChange={(e) => onApporteurExtNomChange(e.target.value)}
              placeholder="Nom de l'apporteur"
              className="w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Taux apporteur (%)</label>
            <Input
              type="number"
              value={editApporteurExtTaux}
              onChange={(e) => onApporteurExtTauxChange(e.target.value)}
              placeholder="30"
              step="0.01"
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
