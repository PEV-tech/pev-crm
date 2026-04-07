'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  FileText,
  Wallet,
  DollarSign,
  Shield,
  Trophy,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  userName?: string
  userRole?: 'manager' | 'consultant' | 'back_office'
  onLogout?: () => void
}

const navigationItems = [
  {
    label: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Dossiers',
    href: '/dashboard/dossiers',
    icon: FolderOpen,
  },
  {
    label: 'Ma Clientèle',
    href: '/dashboard/ma-clientele',
    icon: Users,
  },
  {
    label: 'Facturation',
    href: '/dashboard/facturation',
    icon: FileText,
  },
  {
    label: 'Encaissements',
    href: '/dashboard/encaissements',
    icon: Wallet,
  },
  {
    label: 'Rémunérations',
    href: '/dashboard/remunerations',
    icon: DollarSign,
  },
  {
    label: 'Réglementaire',
    href: '/dashboard/reglementaire',
    icon: Shield,
  },
  {
    label: 'Classement',
    href: '/dashboard/challenges',
    icon: Trophy,
  },
  {
    label: 'Relances',
    href: '/dashboard/relances',
    icon: Bell,
  },
]

export function Sidebar({ userName = 'Utilisateur', userRole = 'consultant', onLogout }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const getRoleBadgeColor = () => {
    switch (userRole) {
      case 'manager':
        return 'bg-accent-blue text-white'
      case 'back_office':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getRoleLabel = () => {
    switch (userRole) {
      case 'manager':
        return 'Gestionnaire'
      case 'back_office':
        return 'Back Office'
      default:
        return 'Consultant'
    }
  }

  const managerOnlyLabels = ['Dossiers', 'Facturation', 'Encaissements', 'Réglementaire', 'Relances']
  const isManagerOrBO = userRole === 'manager' || userRole === 'back_office'

  const visibleItems = navigationItems.filter((item) => {
    if (managerOnlyLabels.includes(item.label)) {
      return isManagerOrBO
    }
    return true
  })

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-navy-600 text-white hover:bg-navy-700"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-60 bg-navy-600 text-white flex flex-col transition-all duration-300 z-40',
          'lg:relative lg:z-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-navy-light">
          <h1 className="text-2xl font-bold text-white">PEV CRM</h1>
          <p className="text-xs text-gray-300 mt-1">Gestion de dossiers</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all duration-200',
                  active
                    ? 'bg-accent-blue text-white shadow-lg'
                    : 'text-gray-200 hover:bg-navy-light hover:text-white'
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {/* Settings - Only for managers and back office */}
          {isManagerOrBO && (
            <Link
              href="/dashboard/parametres"
              onClick={() => setIsOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-all duration-200',
                isActive('/dashboard/parametres')
                  ? 'bg-accent-blue text-white shadow-lg'
                  : 'text-gray-200 hover:bg-navy-light hover:text-white'
              )}
            >
              <Settings size={18} />
              <span>Paramètres</span>
            </Link>
          )}
        </nav>

        {/* User Section */}
        <div className="border-t border-navy-light p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <span className={cn('inline-block text-xs font-medium px-2.5 py-1 rounded-full mt-1', getRoleBadgeColor())}>
              {getRoleLabel()}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-navy-light rounded-md transition-colors duration-200"
          >
            <LogOut size={16} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}
