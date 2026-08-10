import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState('Checking Supabase connection...')

  useEffect(() => {
    async function testConnection() {
      const { error } = await supabase.rpc('member_directory')

      if (error) {
        setStatus(`Supabase connection failed: ${error.message}`)
        return
      }

      setStatus('Supabase connection successful')
    }

    testConnection()
  }, [])

  return (
    <main>
      <h1>Treasure</h1>
      <p>Chapter management portal</p>
      <p>{status}</p>
    </main>
  )
}

export default App