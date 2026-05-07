import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Radio, Mail, Settings, LogOut } from 'lucide-react'

/* ─── Background Beams (Resend-style) ──────── */
function BackgroundBeams() {
  return (
    <div className="bg-canvas">
      <div className="beam beam-1" />
      <div className="beam beam-2" />
      <div className="beam beam-3" />
    </div>
  )
}

/* ─── Scroll Progress Indicator ────────────── */
function ScrollProgress({ containerRef }) {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const scrollable = el.scrollHeight - el.clientHeight
      if (scrollable <= 0) { setPct(0); return }
      setPct(Math.round((el.scrollTop / scrollable) * 100))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef])

  if (pct === 0) return null
  return (
    <div className="scroll-progress">
      <div className="scroll-bar-mini">
        <div className="scroll-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  )
}

/* ─── Blostem Logo SVG ─────────────────────── */
function BlostemLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#0A7A60" />
          <stop offset="100%" stopColor="#00D4A4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      <path d="M10 10h5l3 4-3 4h-5l-3-4 3-4z" fill="rgba(255,255,255,0.9)" />
      <path d="M17 14h5l3 4-3 4h-5l-3-4 3-4z" fill="rgba(255,255,255,0.6)" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/app/radar', icon: Radio, label: 'Prospect Radar', badge: true },
  { to: '/app/outreach', icon: Mail, label: 'Outreach' },
  { to: '/app/settings', icon: Settings, label: 'Settings' },
]

export default function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const mainRef = useRef(null)

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'BP'

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      <BackgroundBeams />
      <div className="grain-overlay" />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%', height: '100vh' }}>
        {/* Labeled sidebar — 220px */}
        <nav className="sidebar">
          <div className="sb-logo-wrap">
            <BlostemLogo />
            <div className="sb-brand">
              <span className="sb-brand-name">blostem</span>
              <span className="sb-brand-sub">Pulse</span>
            </div>
          </div>

          <div className="sb-nav">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sb-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <item.icon size={18} />
                <span className="sb-item-label">{item.label}</span>
                {item.badge && <div className="sb-badge" />}
              </NavLink>
            ))}
          </div>

          <div className="sb-bottom">
            <button onClick={handleLogout} className="sb-item" title="Logout">
              <LogOut size={18} />
              <span className="sb-item-label">Log out</span>
            </button>
            <div className="sb-user">
              <div className="sb-user-avatar">{initials}</div>
              <span className="sb-user-email">{user?.email}</span>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <main ref={mainRef} style={{ flex: 1, height: '100%', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>

      <ScrollProgress containerRef={mainRef} />
    </>
  )
}
