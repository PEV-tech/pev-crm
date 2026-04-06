'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Settings, Users, Package, Grid3x3 } from 'lucide-react'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export default function ParametresPage() {
  const supabase = createClient()
  const [consultants, setConsultants] = React.useState<any[]>([])
  const [produits, setProduits] = React.useState<any[]>([])
  const [compagnies, setCompagnies] = React.useState<any[]>([])
  const [grilles, setGrilles] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [consultantsRes, produitsRes, compagniesRes, grillesRes] = await Promise.all([
          supabase.from('consultants').select('*'),
          supabase.from('produits').select('*'),
          supabase.from('compagnies').select('*'),
          supabase.from('taux_produit_compagnie').select('*'),
        ])

        setConsultants(consultantsRes.data || [])
        setProduits(produitsRes.data || [])
        setCompagnies(compagniesRes.data || [])
        setGrilles(grillesRes.data || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const consultantsColumns: ColumnDefinition<any>[] = [
    {
      key: 'prenom',
      label: 'Prénom',
      sortable: true,
    },
    {
      key: 'nom',
      label: 'Nom',
      sortable: true,
    },
    {
      key: 'role',
      label: 'Rôle',
      sortable: true,
      render: (value) => {
        const roleMap: Record<string, string> = {
          manager: 'Manager',
          consultant: 'Consultant',
          back_office: 'Back Office',
        }
        return roleMap[value] || value
      },
    },
    {
      key: 'taux_remuneration',
      label: 'Taux rémunération',
      render: (value) => value != null ? `${(value * 100).toFixed(0)}%` : '-',
    },
    {
      key: 'zone',
      label: 'Zone',
    },
    {
      key: 'actif',
      label: 'Actif',
      render: (value) => (
        <span className={value ? 'text-green-600 font-medium' : 'text-gray-400'}>
          {value ? 'Oui' : 'Non'}
        </span>
      ),
    },
  ]

  const produitsColumns: ColumnDefinition<any>[] = [
    {
      key: 'nom',
      label: 'Nom produit',
      sortable: true,
    },
    {
      key: 'categorie',
      label: 'Catégorie',
      sortable: true,
    },
  ]

  const compagniesColumns: ColumnDefinition<any>[] = [
    {
      key: 'nom',
      label: 'Nom compagnie',
      sortable: true,
    },
    {
      key: 'taux_defaut',
      label: 'Taux défaut',
      render: (value) => `${value}%`,
    },
  ]

  const grillesColumns: ColumnDefinition<any>[] = [
    {
      key: 'id',
      label: 'ID',
    },
    {
      key: 'type_frais',
      label: 'Type de frais',
      sortable: true,
    },
    {
      key: 'encours_min',
      label: 'En cours min',
      render: (value) => formatCurrency(value),
    },
    {
      key: 'encours_max',
      label: 'En cours max',
      render: (value) => (value ? formatCurrency(value) : 'Illimité'),
    },
    {
      key: 'taux',
      label: 'Taux',
      render: (value) => `${value}%`,
    },
    {
      key: 'actif',
      label: 'Actif',
      render: (value) => (
        <span className={value ? 'text-green-600 font-medium' : 'text-gray-400'}>
          {value ? 'Oui' : 'Non'}
        </span>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-600 mt-1">Administration de l&apos;application</p>
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="consultants" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="consultants" className="flex items-center gap-2">
                <Users size={16} />
                <span className="hidden sm:inline">Consultants</span>
              </TabsTrigger>
              <TabsTrigger value="produits" className="flex items-center gap-2">
                <Package size={16} />
                <span className="hidden sm:inline">Produits</span>
              </TabsTrigger>
              <TabsTrigger value="compagnies" className="flex items-center gap-2">
                <Grid3x3 size={16} />
                <span className="hidden sm:inline">Compagnies</span>
              </TabsTrigger>
              <TabsTrigger value="grilles" className="flex items-center gap-2">
                <Settings size={16} />
                <span className="hidden sm:inline">Grilles</span>
              </TabsTrigger>
            </TabsList>

            {/* Consultants Tab */}
            <TabsContent value="consultants">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {consultants.length} consultant(s)
                  </p>
                </div>
                <DataTable data={consultants} columns={consultantsColumns} pageSize={10} />
              </div>
            </TabsContent>

            {/* Produits Tab */}
            <TabsContent value="produits">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {produits.length} produit(s)
                  </p>
                </div>
                <DataTable data={produits} columns={produitsColumns} pageSize={10} />
              </div>
            </TabsContent>

            {/* Compagnies Tab */}
            <TabsContent value="compagnies">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {compagnies.length} compagnie(s)
                  </p>
                </div>
                <DataTable data={compagnies} columns={compagniesColumns} pageSize={10} />
              </div>
            </TabsContent>

            {/* Grilles Tab */}
            <TabsContent value="grilles">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {grilles.length} grille(s) de taux
                  </p>
                </div>
                <DataTable data={grilles} columns={grillesColumns} pageSize={10} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">À propos des paramètres</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>
            Cette page affiche les paramètres de configuration actuels de l&apos;application.
          </p>
          <p>
            Pour modifier ces paramètres, veuillez contacter un administrateur.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
