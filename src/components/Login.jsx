import { useState } from 'react'
import { supabase } from '../supabase'

/* Full-screen sign-in gate. Rendered by App.jsx whenever there is no
   Supabase Auth session; on success onAuthStateChange flips the app in. */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="login-brand-name">Method Multifamily</span>
          <span className="login-brand-sub">Brokerage</span>
        </div>

        <label className="login-label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className="login-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
        />

        <label className="login-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="login-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button className="login-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
