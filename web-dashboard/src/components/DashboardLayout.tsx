import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../App'

const navItems = [
  { label: 'Overview', path: '/dashboard', icon: 'grid' },
  { label: 'Live Monitor', path: '/live', icon: 'activity', live: true },
  { label: 'Leads', path: '/leads', icon: 'users' },
]

const configItems = [
  { label: 'Knowledge Base', path: '/knowledge-base', icon: 'database' },
  { label: 'Widget', path: '/widget', icon: 'code' },
  { label: 'Integrations', path: '/integrations', icon: 'link' },
  { label: 'Team', path: '/team', icon: 'user-plus' },
]

function SvgIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    activity: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    database: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
    code: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    'user-plus': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  }
  return icons[name] || null
}

export default function DashboardLayout() {
  const { auth, logout } = useAuth()
  const location = useLocation()
  const initials = auth.fullName
    ? auth.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SG'

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">SG</div>
          <span className="sidebar-logo-text">SalesGen</span>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Dashboard</span>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <SvgIcon name={item.icon} />
              {item.label}
              {item.live && <span className="badge-live">LIVE</span>}
            </NavLink>
          ))}

          <span className="sidebar-section-label">Configure</span>
          {configItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <SvgIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{auth.fullName || 'User'}</div>
            <div className="sidebar-user-role">{auth.role || 'Admin'} · {auth.orgSlug}</div>
          </div>
          <button className="btn-icon btn-ghost" onClick={logout} title="Logout">
            <SvgIcon name="logout" />
          </button>
        </div>
      </aside>

      <main className="main-content animate-fade-in" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  )
}
