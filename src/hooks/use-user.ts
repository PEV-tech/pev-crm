'use client'

import { useContext, createContext } from 'react'
import { Consultant, RoleType } from '@/types/database'

export interface UserContextType {
  user: {
    id: string
    email?: string
  } | null
  consultant: Consultant | null
  isLoading: boolean
  error: Error | null
}

export const UserContext = createContext<UserContextType | undefined>(undefined)

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

export function useRole() {
  const { consultant } = useUser()
  return consultant?.role as RoleType | null
}

export function useIsManager() {
  const role = useRole()
  return role === 'manager'
}

export function useConsultantInfo() {
  const { consultant } = useUser()
  if (!consultant) {
    return null
  }
  return {
    id: consultant.id,
    name: `${consultant.prenom} ${consultant.nom}`,
    firstName: consultant.prenom,
    lastName: consultant.nom,
    role: consultant.role,
    zone: consultant.zone,
  }
}
