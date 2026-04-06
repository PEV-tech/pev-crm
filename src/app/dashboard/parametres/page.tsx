'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, ColumnDefinition } from '@/components/shared/data-table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, Users, Package, Grid3x3, Edit2, Trash2, Check, X, Plus } from 'lucide-react'
import { useUser, useRole } from '@/hooks/use-user'

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(0)}%`
}

const formatPercentageDecimal = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(2)}%`
}

interface EditingState {
  id: string | number
  data: Record<string, any>
}

export default function ParametresPage() {
  const supabase = createClient()
  const role = useRole()
  const { consultant } = useUser()
  const isManager = role === 'manager' || role === 'back_office'

  const [consultants, setConsultants] = React.useState<any[]>([])
  const [produits, setProduits] = React.useState<any[]>([])
  const [compagnies, setCompagnies] = React.useState<any[]>([])
  const [grilles, setGrilles] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  // Editing states
  const [editingConsultants, setEditingConsultants] = React.useState<EditingState | null>(null)
  const [editingProduits, setEditingProduits] = React.useState<EditingState | null>(null)
  const [editingCompagnies, setEditingCompagnies] = React.useState<EditingState | null>(null)
  const [editingGrilles, setEditingGrilles] = React.useState<EditingState | null>(null)

  // New entry states
  const [newConsultant, setNewConsultant] = React.useState<Record<string, any> | null>(null)
  const [newProduit, setNewProduit] = React.useState<Record<string, any> | null>(null)
  const [newCompagnie, setNewCompagnie] = React.useState<Record<string, any> | null>(null)
  const [newGrille, setNewGrille] = React.useState<Record<string, any> | null>(null)

  const [saving, setSaving] = React.useState(false)

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

  // Save helper function
  const saveToDatabase = async (
    table: string,
    data: Record<string, any>,
    isNew: boolean,
    id?: string | number
  ) => {
    try {
      setSaving(true)
      if (isNew) {
        const { error } = await supabase.from(table).insert([data])
        if (error) throw error
      } else {
        const { error } = await supabase.from(table).update(data).eq('id', id)
        if (error) throw error
      }
      return true
    } catch (error) {
      console.error('Error saving:', error)
      alert('Erreur lors de la sauvegarde')
      return false
    } finally {
      setSaving(false)
    }
  }

  // Fetch all data after save
  const refetchAllData = async () => {
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
      console.error('Error refetching data:', error)
    }
  }

  // Consultant handlers
  const handleEditConsultant = (consultant: any) => {
    setEditingConsultants({
      id: consultant.id,
      data: { ...consultant },
    })
  }

  const handleSaveConsultant = async () => {
    if (!editingConsultants) return
    const saved = await saveToDatabase('consultants', editingConsultants.data, false, editingConsultants.id)
    if (saved) {
      setEditingConsultants(null)
      await refetchAllData()
    }
  }

  const handleAddConsultant = async () => {
    if (!newConsultant) return
    const saved = await saveToDatabase('consultants', newConsultant, true)
    if (saved) {
      setNewConsultant(null)
      await refetchAllData()
    }
  }

  // Produit handlers
  const handleEditProduit = (produit: any) => {
    setEditingProduits({
      id: produit.id,
      data: { ...produit },
    })
  }

  const handleSaveProduit = async () => {
    if (!editingProduits) return
    const saved = await saveToDatabase('produits', editingProduits.data, false, editingProduits.id)
    if (saved) {
      setEditingProduits(null)
      await refetchAllData()
    }
  }

  const handleAddProduit = async () => {
    if (!newProduit) return
    const saved = await saveToDatabase('produits', newProduit, true)
    if (saved) {
      setNewProduit(null)
      await refetchAllData()
    }
  }

  // Compagnie handlers
  const handleEditCompagnie = (compagnie: any) => {
    setEditingCompagnies({
      id: compagnie.id,
      data: { ...compagnie },
    })
  }

  const handleSaveCompagnie = async () => {
    if (!editingCompagnies) return
    const saved = await saveToDatabase('compagnies', editingCompagnies.data, false, editingCompagnies.id)
    if (saved) {
      setEditingCompagnies(null)
      await refetchAllData()
    }
  }

  const handleAddCompagnie = async () => {
    if (!newCompagnie) return
    const saved = await saveToDatabase('compagnies', newCompagnie, true)
    if (saved) {
      setNewCompagnie(null)
      await refetchAllData()
    }
  }

  // Grille handlers
  const handleEditGrille = (grille: any) => {
    setEditingGrilles({
      id: grille.id,
      data: { ...grille },
    })
  }

  const handleSaveGrille = async () => {
    if (!editingGrilles) return
    const saved = await saveToDatabase('taux_produit_compagnie', editingGrilles.data, false, editingGrilles.id)
    if (saved) {
      setEditingGrilles(null)
      await refetchAllData()
    }
  }

  const handleAddGrille = async () => {
    if (!newGrille) return
    const saved = await saveToDatabase('taux_produit_compagnie', newGrille, true)
    if (saved) {
      setNewGrille(null)
      await refetchAllData()
    }
  }

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
      render: (value) => formatPercentage(value),
    },
    {
      key: 'taux_encours',
      label: 'Taux encours',
      render: (value) => formatPercentage(value),
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
      render: (value) => value != null ? `${(value * 100).toFixed(2)}%` : '-',
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
        <p className="text-gray-600 mt-1">
          {isManager ? 'Administration de l\'application' : 'Consultation de la configuration'}
        </p>
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
                  {isManager && (
                    <Button
                      onClick={() => setNewConsultant({})}
                      size="sm"
                      variant="outline"
                      disabled={newConsultant !== null}
                    >
                      <Plus size={16} className="mr-2" />
                      Nouveau
                    </Button>
                  )}
                </div>

                {/* New Consultant Form */}
                {isManager && newConsultant && (
                  <ConsultantForm
                    data={newConsultant}
                    onChange={setNewConsultant}
                    onSave={handleAddConsultant}
                    onCancel={() => setNewConsultant(null)}
                    saving={saving}
                    isNew
                  />
                )}

                {/* Consultants Table */}
                <div className="space-y-3">
                  {consultants.map((consultant) => (
                    <ConsultantRow
                      key={consultant.id}
                      consultant={consultant}
                      isEditing={editingConsultants?.id === consultant.id}
                      editData={editingConsultants?.data || {}}
                      onEdit={() => handleEditConsultant(consultant)}
                      onSave={handleSaveConsultant}
                      onCancel={() => setEditingConsultants(null)}
                      onDataChange={(data) => {
                        if (editingConsultants) {
                          setEditingConsultants({
                            ...editingConsultants,
                            data,
                          })
                        }
                      }}
                      isManager={isManager}
                      saving={saving}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Produits Tab */}
            <TabsContent value="produits">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {produits.length} produit(s)
                  </p>
                  {isManager && (
                    <Button
                      onClick={() => setNewProduit({})}
                      size="sm"
                      variant="outline"
                      disabled={newProduit !== null}
                    >
                      <Plus size={16} className="mr-2" />
                      Nouveau
                    </Button>
                  )}
                </div>

                {/* New Produit Form */}
                {isManager && newProduit && (
                  <ProduitForm
                    data={newProduit}
                    onChange={setNewProduit}
                    onSave={handleAddProduit}
                    onCancel={() => setNewProduit(null)}
                    saving={saving}
                    isNew
                  />
                )}

                {/* Produits Table */}
                <div className="space-y-3">
                  {produits.map((produit) => (
                    <ProduitRow
                      key={produit.id}
                      produit={produit}
                      isEditing={editingProduits?.id === produit.id}
                      editData={editingProduits?.data || {}}
                      onEdit={() => handleEditProduit(produit)}
                      onSave={handleSaveProduit}
                      onCancel={() => setEditingProduits(null)}
                      onDataChange={(data) => {
                        if (editingProduits) {
                          setEditingProduits({
                            ...editingProduits,
                            data,
                          })
                        }
                      }}
                      isManager={isManager}
                      saving={saving}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Compagnies Tab */}
            <TabsContent value="compagnies">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {compagnies.length} compagnie(s)
                  </p>
                  {isManager && (
                    <Button
                      onClick={() => setNewCompagnie({})}
                      size="sm"
                      variant="outline"
                      disabled={newCompagnie !== null}
                    >
                      <Plus size={16} className="mr-2" />
                      Nouveau
                    </Button>
                  )}
                </div>

                {/* New Compagnie Form */}
                {isManager && newCompagnie && (
                  <CompagnieForm
                    data={newCompagnie}
                    onChange={setNewCompagnie}
                    onSave={handleAddCompagnie}
                    onCancel={() => setNewCompagnie(null)}
                    saving={saving}
                    isNew
                  />
                )}

                {/* Compagnies Table */}
                <div className="space-y-3">
                  {compagnies.map((compagnie) => (
                    <CompagnieRow
                      key={compagnie.id}
                      compagnie={compagnie}
                      isEditing={editingCompagnies?.id === compagnie.id}
                      editData={editingCompagnies?.data || {}}
                      onEdit={() => handleEditCompagnie(compagnie)}
                      onSave={handleSaveCompagnie}
                      onCancel={() => setEditingCompagnies(null)}
                      onDataChange={(data) => {
                        if (editingCompagnies) {
                          setEditingCompagnies({
                            ...editingCompagnies,
                            data,
                          })
                        }
                      }}
                      isManager={isManager}
                      saving={saving}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Grilles Tab */}
            <TabsContent value="grilles">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {grilles.length} grille(s) de taux
                  </p>
                  {isManager && (
                    <Button
                      onClick={() => setNewGrille({})}
                      size="sm"
                      variant="outline"
                      disabled={newGrille !== null}
                    >
                      <Plus size={16} className="mr-2" />
                      Nouveau
                    </Button>
                  )}
                </div>

                {/* New Grille Form */}
                {isManager && newGrille && (
                  <GrilleForm
                    data={newGrille}
                    onChange={setNewGrille}
                    onSave={handleAddGrille}
                    onCancel={() => setNewGrille(null)}
                    saving={saving}
                    isNew
                  />
                )}

                {/* Grilles Table */}
                <div className="space-y-3">
                  {grilles.map((grille) => (
                    <GrilleRow
                      key={grille.id}
                      grille={grille}
                      isEditing={editingGrilles?.id === grille.id}
                      editData={editingGrilles?.data || {}}
                      onEdit={() => handleEditGrille(grille)}
                      onSave={handleSaveGrille}
                      onCancel={() => setEditingGrilles(null)}
                      onDataChange={(data) => {
                        if (editingGrilles) {
                          setEditingGrilles({
                            ...editingGrilles,
                            data,
                          })
                        }
                      }}
                      isManager={isManager}
                      saving={saving}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className={isManager ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}>
        <CardHeader>
          <CardTitle className="text-base">À propos des paramètres</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          {isManager ? (
            <>
              <p>
                Vous avez accès à la modification des paramètres de configuration de l&apos;application.
              </p>
              <p>
                Cliquez sur le bouton Éditer pour modifier une ligne, ou Nouveau pour ajouter une nouvelle entrée.
              </p>
            </>
          ) : (
            <>
              <p>
                Cette page affiche les paramètres de configuration actuels de l&apos;application.
              </p>
              <p>
                Pour modifier ces paramètres, veuillez contacter un manager ou l&apos;équipe back-office.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Consultant Row Component
function ConsultantRow({
  consultant,
  isEditing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onDataChange,
  isManager,
  saving,
}: {
  consultant: any
  isEditing: boolean
  editData: Record<string, any>
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDataChange: (data: Record<string, any>) => void
  isManager: boolean
  saving: boolean
}) {
  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <EditInput
            label="Prénom"
            value={editData.prenom || ''}
            onChange={(value) => onDataChange({ ...editData, prenom: value })}
          />
          <EditInput
            label="Nom"
            value={editData.nom || ''}
            onChange={(value) => onDataChange({ ...editData, nom: value })}
          />
          <EditSelect
            label="Rôle"
            value={editData.role || 'consultant'}
            onChange={(value) => onDataChange({ ...editData, role: value })}
            options={[
              { label: 'Consultant', value: 'consultant' },
              { label: 'Manager', value: 'manager' },
              { label: 'Back Office', value: 'back_office' },
            ]}
          />
          <EditInput
            label="Taux (%)"
            type="number"
            step="0.1"
            value={editData.taux_remuneration ? (editData.taux_remuneration * 100).toString() : ''}
            onChange={(value) =>
              onDataChange({
                ...editData,
                taux_remuneration: value ? parseFloat(value) / 100 : null,
              })
            }
          />
          <EditInput
            label="Zone"
            value={editData.zone || ''}
            onChange={(value) => onDataChange({ ...editData, zone: value })}
          />
          <EditCheckbox
            label="Actif"
            checked={editData.actif ?? true}
            onChange={(value) => onDataChange({ ...editData, actif: value })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            <X size={16} className="mr-1" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
          >
            <Check size={16} className="mr-1" />
            Enregistrer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{consultant.prenom}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{consultant.nom}</p>
        </div>
        <div>
          <span className="text-sm text-gray-600">
            {consultant.role === 'manager'
              ? 'Manager'
              : consultant.role === 'back_office'
                ? 'Back Office'
                : 'Consultant'}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-600">{formatPercentage(consultant.taux_remuneration)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{consultant.zone || '-'}</p>
        </div>
        <div>
          <span className={`text-sm font-medium ${consultant.actif ? 'text-green-600' : 'text-gray-400'}`}>
            {consultant.actif ? 'Oui' : 'Non'}
          </span>
        </div>
      </div>
      {isManager && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="ml-4"
        >
          <Edit2 size={16} />
        </Button>
      )}
    </div>
  )
}

// Produit Row Component
function ProduitRow({
  produit,
  isEditing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onDataChange,
  isManager,
  saving,
}: {
  produit: any
  isEditing: boolean
  editData: Record<string, any>
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDataChange: (data: Record<string, any>) => void
  isManager: boolean
  saving: boolean
}) {
  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <EditInput
            label="Nom produit"
            value={editData.nom || ''}
            onChange={(value) => onDataChange({ ...editData, nom: value })}
          />
          <EditInput
            label="Catégorie"
            value={editData.categorie || ''}
            onChange={(value) => onDataChange({ ...editData, categorie: value })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            <X size={16} className="mr-1" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
          >
            <Check size={16} className="mr-1" />
            Enregistrer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{produit.nom}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{produit.categorie || '-'}</p>
        </div>
      </div>
      {isManager && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="ml-4"
        >
          <Edit2 size={16} />
        </Button>
      )}
    </div>
  )
}

// Compagnie Row Component
function CompagnieRow({
  compagnie,
  isEditing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onDataChange,
  isManager,
  saving,
}: {
  compagnie: any
  isEditing: boolean
  editData: Record<string, any>
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDataChange: (data: Record<string, any>) => void
  isManager: boolean
  saving: boolean
}) {
  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <EditInput
            label="Nom compagnie"
            value={editData.nom || ''}
            onChange={(value) => onDataChange({ ...editData, nom: value })}
          />
          <EditInput
            label="Taux défaut (%)"
            type="number"
            step="0.1"
            value={editData.taux_defaut ? (editData.taux_defaut * 100).toString() : ''}
            onChange={(value) =>
              onDataChange({
                ...editData,
                taux_defaut: value ? parseFloat(value) / 100 : null,
              })
            }
          />
          <EditInput
            label="Taux encours (%)"
            type="number"
            step="0.1"
            value={editData.taux_encours ? (editData.taux_encours * 100).toString() : ''}
            onChange={(value) =>
              onDataChange({
                ...editData,
                taux_encours: value ? parseFloat(value) / 100 : null,
              })
            }
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            <X size={16} className="mr-1" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
          >
            <Check size={16} className="mr-1" />
            Enregistrer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{compagnie.nom}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{formatPercentage(compagnie.taux_defaut)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{formatPercentage(compagnie.taux_encours)}</p>
        </div>
      </div>
      {isManager && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="ml-4"
        >
          <Edit2 size={16} />
        </Button>
      )}
    </div>
  )
}

// Grille Row Component
function GrilleRow({
  grille,
  isEditing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onDataChange,
  isManager,
  saving,
}: {
  grille: any
  isEditing: boolean
  editData: Record<string, any>
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDataChange: (data: Record<string, any>) => void
  isManager: boolean
  saving: boolean
}) {
  if (isEditing) {
    return (
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <EditInput
            label="Type de frais"
            value={editData.type_frais || ''}
            onChange={(value) => onDataChange({ ...editData, type_frais: value })}
          />
          <EditInput
            label="En cours min"
            type="number"
            value={editData.encours_min ? editData.encours_min.toString() : ''}
            onChange={(value) =>
              onDataChange({
                ...editData,
                encours_min: value ? parseFloat(value) : null,
              })
            }
          />
          <EditInput
            label="En cours max"
            type="number"
            value={editData.encours_max ? editData.encours_max.toString() : ''}
            onChange={(value) =>
              onDataChange({
                ...editData,
                encours_max: value ? parseFloat(value) : null,
              })
            }
          />
          <EditInput
            label="Taux (%)"
            type="number"
            step="0.01"
            value={editData.taux ? (editData.taux * 100).toString() : ''}
            onChange={(value) =>
              onDataChange({
                ...editData,
                taux: value ? parseFloat(value) / 100 : null,
              })
            }
          />
          <EditCheckbox
            label="Actif"
            checked={editData.actif ?? true}
            onChange={(value) => onDataChange({ ...editData, actif: value })}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            <X size={16} className="mr-1" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
          >
            <Check size={16} className="mr-1" />
            Enregistrer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4">
        <div>
          <p className="text-sm text-gray-600">{grille.type_frais}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{formatCurrency(grille.encours_min)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{grille.encours_max ? formatCurrency(grille.encours_max) : 'Illimité'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">{formatPercentageDecimal(grille.taux)}</p>
        </div>
        <div>
          <span className={`text-sm font-medium ${grille.actif ? 'text-green-600' : 'text-gray-400'}`}>
            {grille.actif ? 'Oui' : 'Non'}
          </span>
        </div>
      </div>
      {isManager && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="ml-4"
        >
          <Edit2 size={16} />
        </Button>
      )}
    </div>
  )
}

// Form Components
function ConsultantForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  return (
    <div className="border rounded-lg p-4 bg-green-50 mb-4">
      <h4 className="font-medium mb-4 text-gray-900">
        {isNew ? 'Nouveau consultant' : 'Modifier consultant'}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
        <EditInput
          label="Prénom"
          value={data.prenom || ''}
          onChange={(value) => onChange({ ...data, prenom: value })}
        />
        <EditInput
          label="Nom"
          value={data.nom || ''}
          onChange={(value) => onChange({ ...data, nom: value })}
        />
        <EditSelect
          label="Rôle"
          value={data.role || 'consultant'}
          onChange={(value) => onChange({ ...data, role: value })}
          options={[
            { label: 'Consultant', value: 'consultant' },
            { label: 'Manager', value: 'manager' },
            { label: 'Back Office', value: 'back_office' },
          ]}
        />
        <EditInput
          label="Taux (%)"
          type="number"
          step="0.1"
          value={data.taux_remuneration ? (data.taux_remuneration * 100).toString() : ''}
          onChange={(value) =>
            onChange({
              ...data,
              taux_remuneration: value ? parseFloat(value) / 100 : null,
            })
          }
        />
        <EditInput
          label="Zone"
          value={data.zone || ''}
          onChange={(value) => onChange({ ...data, zone: value })}
        />
        <EditCheckbox
          label="Actif"
          checked={data.actif ?? true}
          onChange={(value) => onChange({ ...data, actif: value })}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={16} className="mr-1" />
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          <Check size={16} className="mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

function ProduitForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  return (
    <div className="border rounded-lg p-4 bg-green-50 mb-4">
      <h4 className="font-medium mb-4 text-gray-900">
        {isNew ? 'Nouveau produit' : 'Modifier produit'}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <EditInput
          label="Nom produit"
          value={data.nom || ''}
          onChange={(value) => onChange({ ...data, nom: value })}
        />
        <EditInput
          label="Catégorie"
          value={data.categorie || ''}
          onChange={(value) => onChange({ ...data, categorie: value })}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={16} className="mr-1" />
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          <Check size={16} className="mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

function CompagnieForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  return (
    <div className="border rounded-lg p-4 bg-green-50 mb-4">
      <h4 className="font-medium mb-4 text-gray-900">
        {isNew ? 'Nouvelle compagnie' : 'Modifier compagnie'}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <EditInput
          label="Nom compagnie"
          value={data.nom || ''}
          onChange={(value) => onChange({ ...data, nom: value })}
        />
        <EditInput
          label="Taux défaut (%)"
          type="number"
          step="0.1"
          value={data.taux_defaut ? (data.taux_defaut * 100).toString() : ''}
          onChange={(value) =>
            onChange({
              ...data,
              taux_defaut: value ? parseFloat(value) / 100 : null,
            })
          }
        />
        <EditInput
          label="Taux encours (%)"
          type="number"
          step="0.1"
          value={data.taux_encours ? (data.taux_encours * 100).toString() : ''}
          onChange={(value) =>
            onChange({
              ...data,
              taux_encours: value ? parseFloat(value) / 100 : null,
            })
          }
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={16} className="mr-1" />
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          <Check size={16} className="mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

function GrilleForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew: boolean
}) {
  return (
    <div className="border rounded-lg p-4 bg-green-50 mb-4">
      <h4 className="font-medium mb-4 text-gray-900">
        {isNew ? 'Nouvelle grille' : 'Modifier grille'}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
        <EditInput
          label="Type de frais"
          value={data.type_frais || ''}
          onChange={(value) => onChange({ ...data, type_frais: value })}
        />
        <EditInput
          label="En cours min"
          type="number"
          value={data.encours_min ? data.encours_min.toString() : ''}
          onChange={(value) =>
            onChange({
              ...data,
              encours_min: value ? parseFloat(value) : null,
            })
          }
        />
        <EditInput
          label="En cours max"
          type="number"
          value={data.encours_max ? data.encours_max.toString() : ''}
          onChange={(value) =>
            onChange({
              ...data,
              encours_max: value ? parseFloat(value) : null,
            })
          }
        />
        <EditInput
          label="Taux (%)"
          type="number"
          step="0.01"
          value={data.taux ? (data.taux * 100).toString() : ''}
          onChange={(value) =>
            onChange({
              ...data,
              taux: value ? parseFloat(value) / 100 : null,
            })
          }
        />
        <EditCheckbox
          label="Actif"
          checked={data.actif ?? true}
          onChange={(value) => onChange({ ...data, actif: value })}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={16} className="mr-1" />
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
        >
          <Check size={16} className="mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  )
}

// Helper Components
function EditInput({
  label,
  value,
  onChange,
  type = 'text',
  step = undefined,
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  step?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
        step={step}
      />
    </div>
  )
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function EditCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="ml-2 text-xs font-medium text-gray-700">{label}</span>
      </label>
    </div>
  )
}
