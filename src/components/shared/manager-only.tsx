'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/hooks/use-user'

interface ManagerOnlyProps {
  children: React.ReactNode
}

/**
 * Client-side role guard (defense-in-depth).
 * Primary protection is server-side in middleware.ts (MANAGER_ROUTES).
 * This component provides immediate UI feedback without showing protected content.
 */
export function ManagerOnly({ children }: ManagerOnlyProps) {
  const router = useRouter()
  const role = useRole()
  const [checked, setChecked] = useState(false)

  const isAuthorized = role === 'manager' || role === 'back_office'

  useEffect(() => {
    if (role !== null) {
      setChecked(true)
      if (!isAuthorized) {
        router.replace('/dashboard')
      }
    }
  }, [role, isAuthorized, router])

  // Never render children until role is confirmed
  if (!checked || !isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          {checked && !isAuthorized ? (
            <>
              <div className="text-red-600 text-lg font-semibold mb-2">Accès non autorisé</div>
              <p className="text-gray-600">Redirection en cours...</p>
            </>
          ) : (
            <p className="text-gray-500">Vérification des autorisations...</p>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
