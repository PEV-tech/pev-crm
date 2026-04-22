'use client'

/**
 * Section "Administration" (manager uniquement)
 *
 * Contrôle de visibilité par rôle (table `visibility_settings`). Permet de masquer
 * des informations ou sous-menus aux consultants ou au back office.
 */

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Lock, Unlock } from 'lucide-react'
import type { TablesUpdate } from '@/types/database'
import { type ShowToast, SECTION_INTRO_CLS } from './helpers'

interface Props {
  showToast: ShowToast
}

type Setting = {
  id: string
  section: string
  label: string
  description: string | null
  consultant_visible: boolean
  back_office_visible: boolean
  sort_order: number | null
}

const SECTION_LABELS: Record<string, string> = {
  Remunerations: 'Rémunérations',
  Parametres: 'Paramètres',
  Clients: 'Clients',
  Dossiers: 'Dossiers',
}

export function AdminSection({ showToast }: Props) {
  const supabase = createClient()
  const [settings, setSettings] = React.useState<Setting[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pending, setPending] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    const { data } = await supabase.from('visibility_settings').select('*').order('sort_order')
    setSettings((data as any) || [])
    setLoading(false)
  }, [supabase])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggle = async (id: string, field: 'consultant_visible' | 'back_office_visible', currentValue: boolean) => {
    setPending(id + field)
    const payload: TablesUpdate<'visibility_settings'> = { [field]: !currentValue }
    const { error } = await supabase.from('visibility_settings').update(payload).eq('id', id)
    setPending(null)
    if (error) return showToast('Erreur lors de la sauvegarde', 'error')
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: !currentValue } : s)))
  }

  const toggleAll = async (section: string, field: 'consultant_visible' | 'back_office_visible', value: boolean) => {
    const sectionSettings = settings.filter((s) => s.section === section)
    await Promise.all(
      sectionSettings.map((s) =>
        (supabase.from('visibility_settings') as any).update({ [field]: value }).eq('id', s.id)
      )
    )
    setSettings((prev) => prev.map((s) => (s.section === section ? { ...s, [field]: value } : s)))
    showToast(value ? 'Section activée' : 'Section désactivée', 'success')
  }

  if (loading) return <p className="text-gray-500 p-4">Chargement…</p>

  const sections: Array<[string, Setting[]]> = []
  const grouped: Record<string, Setting[]> = {}
  settings.forEach((s) => {
    grouped[s.section] = grouped[s.section] || []
    grouped[s.section].push(s)
  })
  Object.entries(grouped).forEach(([k, v]) => sections.push([k, v]))

  return (
    <div className="space-y-4">
      <div className={SECTION_INTRO_CLS}>
        <div className="flex items-start gap-2">
          <Shield size={16} className="text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Visibilité des données par rôle.</p>
            <p className="text-xs text-indigo-700 mt-0.5">
              Les managers voient toujours tout. Ces toggles contrôlent uniquement ce que les
              consultants et le back office peuvent voir.
            </p>
          </div>
        </div>
      </div>

      {/* En-tête colonnes */}
      <div className="grid grid-cols-12 gap-4 items-center px-4 py-2 bg-gray-50 rounded-lg border">
        <div className="col-span-6">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Paramètre</span>
        </div>
        <div className="col-span-3 text-center">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Consultants</span>
        </div>
        <div className="col-span-3 text-center">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Back Office</span>
        </div>
      </div>

      {sections.map(([section, items]) => (
        <div key={section} className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {SECTION_LABELS[section] || section}
            </h3>
            <div className="flex gap-1 text-xs">
              <button className="text-blue-600 hover:underline" onClick={() => toggleAll(section, 'consultant_visible', true)}>Tout cocher consultants</button>
              <span className="text-gray-300">·</span>
              <button className="text-gray-500 hover:underline" onClick={() => toggleAll(section, 'consultant_visible', false)}>Tout décocher</button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((s) => (
              <div key={s.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-gray-50/50 transition-colors">
                <div className="col-span-6">
                  <p className="text-sm font-medium text-gray-800">{s.label}</p>
                  {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                </div>
                <div className="col-span-3 flex justify-center">
                  <Toggle
                    color="blue"
                    checked={s.consultant_visible}
                    disabled={pending === s.id + 'consultant_visible'}
                    onClick={() => toggle(s.id, 'consultant_visible', s.consultant_visible)}
                  />
                </div>
                <div className="col-span-3 flex justify-center">
                  <Toggle
                    color="purple"
                    checked={s.back_office_visible}
                    disabled={pending === s.id + 'back_office_visible'}
                    onClick={() => toggle(s.id, 'back_office_visible', s.back_office_visible)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Toggle({
  checked,
  onClick,
  disabled,
  color,
}: {
  checked: boolean
  onClick: () => void
  disabled?: boolean
  color: 'blue' | 'purple'
}) {
  const bg = checked ? (color === 'blue' ? 'bg-blue-500' : 'bg-purple-500') : 'bg-gray-300'
  const ring = color === 'blue' ? 'focus:ring-blue-400' : 'focus:ring-purple-400'
  const iconColor = color === 'blue' ? 'text-blue-500' : 'text-purple-500'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${ring} ${bg} ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      >
        {checked ? <Unlock size={10} className={iconColor} /> : <Lock size={10} className="text-gray-400" />}
      </span>
    </button>
  )
}
