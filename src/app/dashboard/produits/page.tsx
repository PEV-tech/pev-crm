'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Package, Building, Search, TrendingUp, FileText, ChevronDown, ChevronUp } from 'lucide-react'

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(2)}%`
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
}

interface Produit {
  id: string
  nom: string
  categorie?: string
}

interface Compagnie {
  id: string
  nom: string
}

interface Taux {
  id: string
  produit_id: string
  compagnie_id: string
  taux_commission: number
  produit_nom?: string
  compagnie_nom?: string
}

interface GrilleFrais {
  id: string
  type_frais: string
  encours_min: number
  encours_max: number | null
  taux: number
}

interface DossierStats {
  produit_nom: string
  count: number
  total_montant: number
}

export default function ProduitsPage() {
  const [produits, setProduits] = React.useState<Produit[]>([])
  const [compagnies, setCompagnies] = React.useState<Compagnie[]>([])
  const [taux, setTaux] = React.useState<Taux[]>([])
  const [grillesFrais, setGrillesFrais] = React.useState<GrilleFrais[]>([])
  const [dossierStats, setDossierStats] = React.useState<DossierStats[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [filterCompagnie, setFilterCompagnie] = React.useState('')
  const [expandedProduct, setExpandedProduct] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const [produitsRes, compagniesRes, tauxRes, grillesRes, dossiersRes] = await Promise.all([
        supabase.from('produits').select('*').order('nom'),
        supabase.from('compagnies').select('*').order('nom'),
        supabase.from('taux_produit_compagnie').select('*'),
        supabase.from('grilles_frais').select('*').order('type_frais').order('encours_min'),
        supabase.from('v_dossiers_complets')
          .select('produit_nom, montant')
          .eq('statut', 'client_finalise'),
      ])

      setProduits(produitsRes.data || [])
      setCompagnies(compagniesRes.data || [])
      setTaux(tauxRes.data || [])
      setGrillesFrais(grillesRes.data || [])

      // Aggregate dossier stats by product
      const statsMap: Record<string, { count: number; total: number }> = {}
      for (const d of (dossiersRes.data || [])) {
        const nom = d.produit_nom || 'Inconnu'
        if (!statsMap[nom]) statsMap[nom] = { count: 0, total: 0 }
        statsMap[nom].count++
        statsMap[nom].total += d.montant || 0
      }
      setDossierStats(Object.entries(statsMap).map(([nom, s]) => ({
        produit_nom: nom,
        count: s.count,
        total_montant: s.total,
      })))

      setLoading(false)
    }
    fetchData()
  }, [])

  // Enrich taux with names
  const enrichedTaux = React.useMemo(() => {
    const produitMap = Object.fromEntries(produits.map(p => [p.id, p.nom]))
    const compagnieMap = Object.fromEntries(compagnies.map(c => [c.id, c.nom]))
    return taux.map(t => ({
      ...t,
      produit_nom: produitMap[t.produit_id] || 'Inconnu',
      compagnie_nom: compagnieMap[t.compagnie_id] || 'Inconnu',
    }))
  }, [taux, produits, compagnies])

  // Build product cards data
  const productCards = React.useMemo(() => {
    return produits
      .filter(p => {
        if (searchQuery) {
          return p.nom.toLowerCase().includes(searchQuery.toLowerCase())
        }
        return true
      })
      .map(p => {
        const productTaux = enrichedTaux
          .filter(t => t.produit_id === p.id)
          .filter(t => !filterCompagnie || t.compagnie_id === filterCompagnie)
        const stats = dossierStats.find(s => s.produit_nom === p.nom)
        return { ...p, taux: productTaux, stats }
      })
  }, [produits, enrichedTaux, dossierStats, searchQuery, filterCompagnie])

  // Grilles grouped by type
  const grillesEntree = grillesFrais.filter(g => g.type_frais === 'entree')
  const grillesGestion = grillesFrais.filter(g => g.type_frais === 'gestion')

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">Chargement...</div>
  }

  const totalDossiers = dossierStats.reduce((s, d) => s + d.count, 0)
  const totalMontant = dossierStats.reduce((s, d) => s + d.total_montant, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catalogue Produits</h1>
          <p className="text-gray-600 mt-1">
            {produits.length} produit(s) · {compagnies.length} compagnie(s) · {totalDossiers} dossiers finalisés
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Package size={16} className="text-indigo-500" /> Produits</div>
          <p className="text-2xl font-bold mt-1">{produits.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Building size={16} className="text-blue-500" /> Compagnies</div>
          <p className="text-2xl font-bold mt-1">{compagnies.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><FileText size={16} className="text-green-500" /> Dossiers finalisés</div>
          <p className="text-2xl font-bold mt-1">{totalDossiers}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><TrendingUp size={16} className="text-amber-500" /> Volume total</div>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalMontant)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCompagnie} onChange={e => setFilterCompagnie(e.target.value)} className="max-w-xs">
          <option value="">Toutes les compagnies</option>
          {compagnies.map(c => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </Select>
      </div>

      {/* Product cards */}
      <div className="space-y-4">
        {productCards.map(p => {
          const isExpanded = expandedProduct === p.id
          return (
            <Card key={p.id}>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <Package size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{p.nom}</CardTitle>
                      {p.categorie && <p className="text-xs text-gray-400">{p.categorie}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    {p.stats ? (
                      <>
                        <span className="text-gray-500">{p.stats.count} dossier(s)</span>
                        <span className="font-semibold text-gray-700">{formatCurrency(p.stats.total_montant)}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">Aucun dossier</span>
                    )}
                    <span className="text-gray-400">{p.taux.length} taux</span>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent>
                  {p.taux.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucun taux configuré pour ce produit</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="py-2 pr-4 font-medium">Compagnie</th>
                            <th className="py-2 px-2 font-medium text-right">Taux commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.taux.map(t => (
                            <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 pr-4 text-gray-900">{t.compagnie_nom}</td>
                              <td className="py-2 px-2 text-right font-medium text-indigo-700">{formatPercentage(t.taux_commission)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
        {productCards.length === 0 && (
          <Card><CardContent className="py-12 text-center text-gray-400">Aucun produit trouvé</CardContent></Card>
        )}
      </div>

      {/* Grilles de frais */}
      {(grillesEntree.length > 0 || grillesGestion.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp size={20} className="text-green-600" />
              Grilles de frais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {grillesEntree.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Frais d'entrée</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2 pr-4 font-medium">Encours min</th>
                        <th className="py-2 px-2 font-medium">Encours max</th>
                        <th className="py-2 px-2 font-medium text-right">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grillesEntree.map(g => (
                        <tr key={g.id} className="border-b border-gray-100">
                          <td className="py-2 pr-4">{formatCurrency(g.encours_min)}</td>
                          <td className="py-2 px-2">{g.encours_max ? formatCurrency(g.encours_max) : '∞'}</td>
                          <td className="py-2 px-2 text-right font-medium text-green-700">{formatPercentage(g.taux)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {grillesGestion.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Frais de gestion</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2 pr-4 font-medium">Encours min</th>
                        <th className="py-2 px-2 font-medium">Encours max</th>
                        <th className="py-2 px-2 font-medium text-right">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grillesGestion.map(g => (
                        <tr key={g.id} className="border-b border-gray-100">
                          <td className="py-2 pr-4">{formatCurrency(g.encours_min)}</td>
                          <td className="py-2 px-2">{g.encours_max ? formatCurrency(g.encours_max) : '∞'}</td>
                          <td className="py-2 px-2 text-right font-medium text-green-700">{formatPercentage(g.taux)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
