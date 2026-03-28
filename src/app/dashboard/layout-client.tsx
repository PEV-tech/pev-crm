'use client'

import { ReactNode } from 'react'
import { Sidebar } from '@/components/shared/sidebar'
import { Header } from '@/components/shared/header'
import type { RoleType } from '@/types/database'

interface DashboardLayoutClientProps {
  children: ReactNode
  userName: string
  userInitials: string
  userRole: RoleType
  onLogout: () => Promise<void>
}

export function DashboardLayoutClient({
  children,
  userName,
  userInitials,
  userRole,
  onLogout,
}: DashboardLayoutClientProps) {
  const handleLogout = async () => {
    try {
      await onLogout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        userName={userName}
        userRole={userRole}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <Header
          userName={userName}
          userInitials={userInitials}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto px-6 py-8 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
