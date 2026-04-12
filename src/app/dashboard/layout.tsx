'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DashboardLayoutClient } from './layout-client'
import { UserContext } from '@/hooks/use-user'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import type { Consultant } from '@/types/database'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [consultant, setConsultant] = useState<Consultant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserData() {
      const supabase = createClient()

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      setUser({ id: authUser.id, email: authUser.email })

      const { data: consultantData } = await supabase
        .from('consultants')
        .select('id, nom, prenom, role, taux_remuneration, zone, actif, auth_user_id')
        .eq('auth_user_id', authUser.id)
        .single()

      if (!consultantData) {
        router.push('/login')
        return
      }

      setConsultant(consultantData as Consultant)
      setLoading(false)
    }

    loadUserData()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (!consultant || !user) {
    return null
  }

  const userInitials = `${consultant.prenom[0]}${consultant.nom[0]}`.toUpperCase()
  const userName = `${consultant.prenom} ${consultant.nom}`

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const contextValue = {
    user,
    consultant,
    isLoading: false,
    error: null,
  }

  return (
    <UserContext.Provider value={contextValue}>
      <DashboardLayoutClient
        userName={userName}
        userInitials={userInitials}
        userRole={consultant.role}
        onLogout={handleLogout}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </DashboardLayoutClient>
    </UserContext.Provider>
  )
}
