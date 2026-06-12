import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Proposals from './pages/Proposals'
import ProposalDetail from './pages/ProposalDetail'
import Properties from './pages/Properties'
import CompDatabase from './pages/CompDatabase'
import MarketSnapshot from './pages/MarketSnapshot'
import ApShell from './components/ApShell'
import Login from './components/Login'
import { supabase } from './supabase'
import './App.css'

/* Wraps not-yet-remodeled screens in the padded, scrollable container they
   were built against. Remodeled screens (Properties) render full-bleed. */
function Legacy({ children }) {
  return <div className="legacy-main">{children}</div>
}

export default function App() {
  // undefined = session not yet resolved (avoid flashing the login screen on
  // refresh), null = signed out, object = signed in.
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <BrowserRouter>
      <ApShell>
        <Routes>
          <Route path="/" element={<Navigate to="/proposals" replace />} />
          <Route path="/proposals" element={<Proposals />} />
          <Route path="/proposals/:id" element={<ProposalDetail />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<Properties />} />
          <Route path="/comps" element={<CompDatabase />} />
          <Route path="/snapshot" element={<MarketSnapshot />} />
        </Routes>
      </ApShell>
    </BrowserRouter>
  )
}