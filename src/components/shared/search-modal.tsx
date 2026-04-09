'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/use-user'
import { Search, X, User, Building, Package, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  type: 'client' | 'compagnie' | 'produit'
  title: string
  subtitle: string
  url: string
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter()
  const { consultant } = useUser()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Search function with debounce
  const searchData = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const searchTerm = `%${q.toLowerCase()}%`

      // Search clients directly from the clients table
      const [clientsRes, compagniesRes, produitsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, nom, prenom, pays, statut_kyc')
          .or(`nom.ilike.${searchTerm},prenom.ilike.${searchTerm}`)
          .limit(10),
        supabase
          .from('compagnies')
          .select('id, nom')
          .ilike('nom', searchTerm)
          .limit(4),
        supabase
          .from('produits')
          .select('id, nom, categorie')
          .ilike('nom', searchTerm)
          .limit(4),
      ])

      const searchResults: SearchResult[] = []

      // Add client results — navigate directly to client page
      if (clientsRes.data) {
        clientsRes.data.forEach((c: any) => {
          const fullName = `${c.prenom || ''} ${c.nom || ''}`.trim()
          if (fullName) {
            searchResults.push({
              id: `client-${c.id}`,
              type: 'client',
              title: fullName,
              subtitle: c.pays || '',
              url: `/dashboard/clients/${c.id}`,
            })
          }
        })
      }

      // Add compagnie results
      if (compagniesRes.data) {
        compagniesRes.data.forEach((c: any) => {
          searchResults.push({
            id: `compagnie-${c.id}`,
            type: 'compagnie',
            title: c.nom,
            subtitle: 'Compagnie',
            url: `/dashboard/dossiers?q=${encodeURIComponent(c.nom)}`,
          })
        })
      }

      // Add produit results
      if (produitsRes.data) {
        produitsRes.data.forEach((p: any) => {
          searchResults.push({
            id: `produit-${p.id}`,
            type: 'produit',
            title: p.nom,
            subtitle: p.categorie || 'Produit',
            url: `/dashboard/dossiers?q=${encodeURIComponent(p.nom)}`,
          })
        })
      }

      // Deduplicate and limit
      const unique = Array.from(new Map(searchResults.map(r => [r.id, r])).values()).slice(0, 12)
      setResults(unique)
      setSelectedIndex(0)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => searchData(query), 250)
    return () => clearTimeout(timer)
  }, [query, searchData])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      router.push(results[selectedIndex].url)
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'client': return <User size={16} className="text-blue-500" />
      case 'compagnie': return <Building size={16} className="text-green-500" />
      case 'produit': return <Package size={16} className="text-orange-500" />
      default: return <Search size={16} className="text-gray-400" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'client': return 'Client'
      case 'compagnie': return 'Compagnie'
      case 'produit': return 'Produit'
      default: return type
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un client, produit, compagnie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-gray-900 text-base placeholder-gray-400 outline-none"
          />
          {loading && <Loader2 size={18} className="animate-spin text-gray-400" />}
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => {
                    router.push(result.url)
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    index === selectedIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                    <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{getTypeLabel(result.type)}</span>
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              Aucun résultat pour « {query} »
            </div>
          ) : query.length < 2 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              Tapez au moins 2 caractères pour rechercher
            </div>
          ) : null}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <div className="flex gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">ââ</kbd> naviguer</span>
            <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">âµ</kbd> ouvrir</span>
            <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">esc</kbd> fermer</span>
          </div>
        </div>
      </div>
    </div>
  )
}
