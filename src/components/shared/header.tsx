'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchModal } from './search-modal'

interface HeaderProps {
  title?: string
  userName?: string
  userInitials?: string
  onLogout?: () => void
}

export function Header({
  title = 'Tableau de bord',
  userName = 'Utilisateur',
  userInitials = 'U',
  onLogout,
}: HeaderProps) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
    <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left section - Title */}
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* Center section - Search trigger */}
        <button
          onClick={() => setShowSearch(true)}
          className="flex-1 max-w-md mx-8"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <div className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500 text-left flex items-center justify-between">
              <span>Rechercher un client, dossier...</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 rounded text-xs text-gray-600">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>
        </button>

        {/* Right section - User Avatar and Menu */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-blue text-white font-semibold text-sm">
                {userInitials}
              </div>
              <span className="hidden sm:inline text-sm font-medium text-gray-900">{userName}</span>
              <ChevronDown size={16} className={cn('text-gray-600 transition-transform', showUserMenu && 'rotate-180')} />
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-500 mt-1">Profil utilisateur</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    onLogout?.()
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <LogOut size={16} />
                  <span>Déconnexion</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  )
}
