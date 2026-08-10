import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setAuthenticated(!!session)
      setLoading(false)
    }

    checkSession()
  }, [])

  if (loading) {
    return <p>Loading...</p>
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute