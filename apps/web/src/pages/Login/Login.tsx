import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setLoading(false)
navigate('/dashboard')
  }

  return (
    <main>
      <h1>Treasure</h1>
      <h2>Chapter Portal Login</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="identifier">Email</label>
          <input
            id="identifier"
            type="email"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Enter email"
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}

export default Login