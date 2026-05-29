import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Proposals from './pages/Proposals'
import ProposalDetail from './pages/ProposalDetail'
import Properties from './pages/Properties'
import CompDatabase from './pages/CompDatabase'
import MarketSnapshot from './pages/MarketSnapshot'
import ApShell from './components/ApShell'
import './App.css'

/* Wraps not-yet-remodeled screens in the padded, scrollable container they
   were built against. Remodeled screens (Properties) render full-bleed. */
function Legacy({ children }) {
  return <div className="legacy-main">{children}</div>
}

export default function App() {
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