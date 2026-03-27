'use client'

import { ReactNode } from 'react'
import { UserContext, UserContextType } from '@/hooks/use-user'

interface UserProviderProps {
  children: ReactNode
  value: UserContextType
}

export function UserProvider({ children, value }: UserProviderProps) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}
