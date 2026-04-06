'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/hooks/use-user'

interface ManagerOnlyProps {
  children: React.ReactNode
}

export function ManagerOnly({ children }: ManagerOnlyProps) {
  const router = useRouter()
  const role = useRole()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [showMessage, setShowMessage] = useState(false)

  useEffect(() => {
    if (role === 'manager' || role === 'back_office') {
      setIsAuthorized(true)
    } else {
      setShowMessage(true)
      const timer = setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [role, router])

  if (showMessage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Accès non autorisé</div>
          <p className="text-gray-600">Redirection en cours...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
