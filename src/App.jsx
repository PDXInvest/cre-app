import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Proposals from './pages/Proposals'
import CompDatabase from './pages/CompDatabase'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">CRE App</div>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Proposals
          </NavLink>
          <NavLink to="/comps" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Comp Database
          </NavLink>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Proposals />} />
            <Route path="/comps" element={<CompDatabase />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}