import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Proposals from './pages/Proposals'
import ProposalDetail from './pages/ProposalDetail'
import Properties from './pages/Properties'
import CompDatabase from './pages/CompDatabase'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">CRE App</div>
          <NavLink to="/proposals" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Proposals
          </NavLink>
          <NavLink to="/properties" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Properties
          </NavLink>
          <NavLink to="/comps" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Comp Database
          </NavLink>
          <a href="/om" target="_blank" rel="noopener" className="nav-item">
            Offering Memo
          </a>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/proposals" replace />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/properties/:id" element={<Properties />} />
            <Route path="/comps" element={<CompDatabase />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}