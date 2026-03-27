import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardLayoutClient } from './layout-client'
import { UserContext } from '@/hooks/use-user'
import type { Consultant } from '@/types/database'

async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

async function getConsultantData(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consultants')
    .select('*')
    .eq('auth_user_id', userId)
    .single()

  if (error) {
    console.error('Error fetching consultant:', error)
    return null
  }

  return data as Consultant | null
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  const consultant = await getConsultantData(user.id)

  if (!consultant) {
    redirect('/login')
  }

  const userInitials = `${consultant.prenom[0]}${consultant.nom[0]}`.toUpperCase()
  const userName = `${consultant.prenom} ${consultant.nom}`

  const contextValue = {
    user: {
      id: user.id,
      email: user.email,
    },
    consultant,
    isLoading: false,
    error: null,
  }

  async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <UserContext.Provider value={contextValue}>
      <DashboardLayoutClient
        userName={userName}
        userInitials={userInitials}
        userRole={consultant.role}
        onLogout={handleLogout}
      >
        {children}
      </DashboardLayoutClient>
    </UserContext.Provider>
  )
}
