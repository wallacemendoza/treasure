import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function Dashboard() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <main>
      <h1>Treasure Dashboard</h1>
      <p>Welcome to the chapter management portal.</p>

      <button type="button" onClick={handleLogout}>
        Sign Out
      </button>
    </main>
  )
}

export default Dashboard