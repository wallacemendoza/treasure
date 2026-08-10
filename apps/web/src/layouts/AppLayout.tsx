import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function AppLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div>
      <aside>
        <h2>Treasure</h2>

        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/members">Members</NavLink>
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/discipline">Discipline</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>

        <button type="button" onClick={handleLogout}>
          Sign Out
        </button>
      </aside>

      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout