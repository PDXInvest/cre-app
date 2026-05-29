import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const AP_ICONS = {
  properties: 'M3 9.5 L8 5.5 L13 9.5 M4.2 8.6 V13 H11.8 V8.6',
  proposals:  'M4 2.5 H10 L12.5 5 V13.5 H4 Z M9.5 2.5 V5.5 H12.5 M5.8 8 H10.2 M5.8 10.4 H10.2',
  comps:      'M2.5 13 V3 M6.2 13 V6 M9.8 13 V8 M13.5 13 V4 M2 13 H14',
  snapshot:   'M2.5 11 L6 7 L8.5 9 L13.5 3.5 M13.5 3.5 H10.5 M13.5 3.5 V6.5',
}

function ApNavIcon({ d }) {
  return (
    <span className="ap-navicon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  )
}

const NAV_ITEMS = [
  { to: '/properties', label: 'Properties',      key: 'properties' },
  { to: '/proposals',  label: 'Proposals',       key: 'proposals' },
  { to: '/comps',      label: 'Comp Database',    key: 'comps' },
  { to: '/snapshot',   label: 'Market Snapshot',  key: 'snapshot' },
]

export default function ApShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('ap-collapsed') === '1' } catch { return false }
  })
  const toggle = () => setCollapsed(v => {
    const next = !v
    try { localStorage.setItem('ap-collapsed', next ? '1' : '0') } catch { /* ignore */ }
    return next
  })

  return (
    <div className="ap">
      <aside className={`ap-side ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="ap-brand">
          <span className="ap-brand-mark"></span>
          <span className="ap-brand-txt">
            <span className="ap-brand-name">Method Multifamily</span>
            <span className="ap-brand-sub">Brokerage</span>
          </span>
        </div>

        <p className="ap-navlabel">Workspace</p>
        <nav className="ap-nav">
          {NAV_ITEMS.map(item => (
            <NavLink key={item.key} to={item.to} title={item.label}
              className={({ isActive }) => `ap-navitem ${isActive ? 'is-on' : ''}`}>
              <ApNavIcon d={AP_ICONS[item.key]} />
              <span className="ap-navtext">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ap-nav-spacer"></div>

        <button className="ap-collapse" onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <span className="ap-collapse-ic">{collapsed ? '»' : '«'}</span>
          <span className="ap-navtext">Collapse</span>
        </button>

        <div className="ap-user">
          <span className="avatar">BF</span>
          <span className="ap-user-txt">
            <span className="ap-user-name">Benjamin Ficker</span>
            <span className="ap-user-role">Principal Broker</span>
          </span>
        </div>
      </aside>

      <div className="ap-main">{children}</div>
    </div>
  )
}
