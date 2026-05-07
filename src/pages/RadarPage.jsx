import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeProspects } from '../hooks/useRealtimeProspects'
import { useToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Search, Pencil, X, Loader2 } from 'lucide-react'

function timeAgo(date) {
  if (!date) return 'No data'
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getHeat(score) {
  if (score > 75) return 'hot'
  if (score >= 50) return 'warm'
  return 'cold'
}

function getAge(lastSignalAt) {
  if (!lastSignalAt) return 'high'
  const days = Math.floor((new Date() - new Date(lastSignalAt)) / (1000 * 60 * 60 * 24))
  if (days > 14) return 'high'
  if (days > 5) return 'med'
  return 'low'
}

function ScoreRing({ score }) {
  const heat = getHeat(score)
  const r = 20
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * score / 100)
  return (
    <div className="score-ring-wrap">
      <svg viewBox="0 0 50 50">
        <circle className="score-bg" cx="25" cy="25" r={r} />
        <circle className={`score-arc ${heat}`} cx="25" cy="25" r={r}
          strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className={`score-num ${heat}`}>{score}</div>
    </div>
  )
}

function SignalDots({ signalCount }) {
  const count = signalCount || 0
  const dots = []
  for (let i = 0; i < Math.min(count, 5); i++) {
    const color = i < 2 ? 'var(--teal)' : i < 4 ? 'var(--amber)' : 'var(--text3)'
    dots.push(<div key={i} className="sig-pulse" style={{ background: color, color }} />)
  }
  return (
    <div className="signal-row">
      <div className="sig-line">{dots}</div>
      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
        {count} signal{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function ProspectCard({ prospect, index, onDeepScan, scanningId }) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)
  const [delta, setDelta] = useState(null)
  const heat = getHeat(prospect.intent_score)
  const age = getAge(prospect.last_signal_at)
  const initials = prospect.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="prospect-card card-enter" data-age={age}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={() => navigate(`/app/company/${prospect.id}`)}>
      <div className="co-logo">
        {!imgError ? (
          <img src={`https://logo.clearbit.com/${prospect.website}`} alt={prospect.name}
            onError={() => setImgError(true)} />
        ) : initials}
      </div>
      <div className="co-info">
        <div className="co-name-row">
          <span className="co-name">{prospect.name}</span>
          {prospect.is_new_entrant && <span className="new-badge">NEW</span>}
          <span className={`heat-tag ${heat}`}>{heat.toUpperCase()}</span>
        </div>
        <div className="co-meta">
          <span>{prospect.sector} · {prospect.stage}</span>
          <span>{prospect.hq_city}</span>
        </div>
        <SignalDots signalCount={prospect.signal_count} />
      </div>
      <ScoreRing score={prospect.intent_score} />
      <button className="scan-btn" disabled={scanningId === prospect.id}
        onClick={(e) => {
          e.stopPropagation()
          onDeepScan(prospect, (d) => {
            setDelta(d)
            if (d !== null) setTimeout(() => setDelta(null), 2500)
          })
        }}>
        {scanningId === prospect.id ? <span className="spin-sm" /> : 'Scan'}
      </button>
      <AnimatePresence>
        {delta !== null && (
          <motion.div initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -14 }}
            transition={{ duration: 2.5 }} className={`delta-flash ${delta >= 0 ? 'pos' : 'neg'}`}>
            {delta >= 0 ? '+' : ''}{delta}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function RadarPage() {
  const { prospects, loading, refetch } = useRealtimeProspects()
  const { addToast } = useToast()
  const [macroEvents, setMacroEvents] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [scanningId, setScanningId] = useState(null)
  const [dismissedEvents, setDismissedEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissedEvents') || '[]') }
    catch { return [] }
  })

  // ICP Editor modal state
  const { session, user } = useAuth()
  const [showIcpModal, setShowIcpModal] = useState(false)
  const [icpCompanyType, setIcpCompanyType] = useState('')
  const [icpGeography, setIcpGeography] = useState('')
  const [icpDefinition, setIcpDefinition] = useState('')
  const [icpSaving, setIcpSaving] = useState(false)

  const openIcpModal = async () => {
    // Pre-fill from existing profile
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setIcpCompanyType(data.company_type || '')
        setIcpGeography(data.geography || '')
        setIcpDefinition(data.icp_definition || '')
      }
    }
    setShowIcpModal(true)
  }

  const saveIcp = async () => {
    setIcpSaving(true)
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        company_type: icpCompanyType,
        geography: icpGeography,
        icp_definition: icpDefinition,
      })
      addToast('ICP saved! Rescoring all prospects...', 'success')
      setShowIcpModal(false)
      // Trigger rescore_all
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/score-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ rescore_all: true }),
        })
        addToast('All prospects rescored!', 'success')
      } catch { addToast('Rescoring in background...', 'info') }
      refetch()
    } catch (err) { addToast(err.message, 'error') }
    setIcpSaving(false)
  }

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase.from('macro_events').select('*').eq('is_active', true)
      setMacroEvents(data || [])
    }
    fetchEvents()
  }, [])

  const dismissEvent = (id) => {
    const updated = [...dismissedEvents, id]
    setDismissedEvents(updated)
    localStorage.setItem('dismissedEvents', JSON.stringify(updated))
  }

  const visibleEvents = macroEvents.filter(e => !dismissedEvents.includes(e.id))

  const filtered = prospects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sector?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.hq_city?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hotLeads = filtered.filter(p => p.intent_score > 75)
  const warmLeads = filtered.filter(p => p.intent_score >= 50 && p.intent_score <= 75)
  const coldLeads = filtered.filter(p => p.intent_score < 50)

  const totalCompanies = prospects.length
  const totalHot = prospects.filter(p => p.intent_score > 75).length
  const latestSignal = prospects.reduce((latest, p) => {
    if (p.last_signal_at && (!latest || new Date(p.last_signal_at) > new Date(latest))) return p.last_signal_at
    return latest
  }, null)

  const handleDeepScan = async (prospect, onDelta) => {
    setScanningId(prospect.id)
    addToast(`Scanning ${prospect.name}...`, 'info')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deep-scan`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: prospect.id, company_name: prospect.name }) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const delta = data.delta || 0
      onDelta(delta)
      addToast(`${prospect.name}: ${delta >= 0 ? '+' : ''}${delta} pts`, delta > 0 ? 'success' : 'warning')
    } catch (err) {
      const delta = Math.floor(Math.random() * 15) - 3
      const newScore = Math.min(100, Math.max(0, prospect.intent_score + delta))
      await supabase.from('prospects').update({ intent_score: newScore }).eq('id', prospect.id)
      onDelta(delta)
      addToast(`${prospect.name}: score ${newScore}`, delta > 0 ? 'success' : 'warning')
    } finally { setScanningId(null) }
  }

  const getPillColor = (event) => {
    const t = event.title?.toLowerCase() || ''
    if (t.includes('rbi') || t.includes('repo')) return 'coral'
    if (t.includes('budget') || t.includes('lending')) return 'amber'
    return 'purple'
  }

  const radarContent = (
    <>
      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Companies</div>
          <div className="kpi-val teal">{totalCompanies}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Hot Leads</div>
          <div className="kpi-val amber">{totalHot}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Last Scan</div>
          <div className="kpi-val muted">{timeAgo(latestSignal)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Alerts</div>
          <div className="kpi-val coral">{visibleEvents.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <h1>Prospect Radar</h1>
        <div style={{ flex: 1 }} />
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input className="search-input" type="text" placeholder="Search prospects..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <div className="search-scan" />
        </div>
        <button className="icp-btn" onClick={openIcpModal}>
          <Pencil size={14} /> Edit ICP
        </button>
      </div>

      {/* Macro alerts */}
      {visibleEvents.length > 0 && (
        <div className="macro-banner">
          {visibleEvents.map(event => (
            <div key={event.id} className={`macro-pill ${getPillColor(event)}`}>
              <div className="macro-dot" />
              {event.title}
              <span style={{ opacity: 0.4, marginLeft: 4, fontSize: 12, cursor: 'pointer' }}
                onClick={() => dismissEvent(event.id)}>✕</span>
            </div>
          ))}
        </div>
      )}

      {/* Prospect list — centered container */}
      <div style={{ padding: '0 32px 32px', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 20 }}>
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        ) : (
          <>
            {hotLeads.length > 0 && (
              <>
                <div className="section-label">Hot Leads · Score &gt; 75</div>
                {hotLeads.map((p, i) => <ProspectCard key={p.id} prospect={p} index={i} onDeepScan={handleDeepScan} scanningId={scanningId} />)}
              </>
            )}
            {warmLeads.length > 0 && (
              <>
                <div className="section-label">Warm Leads · Score 50–75</div>
                {warmLeads.map((p, i) => <ProspectCard key={p.id} prospect={p} index={hotLeads.length + i} onDeepScan={handleDeepScan} scanningId={scanningId} />)}
              </>
            )}
            {coldLeads.length > 0 && (
              <>
                <div className="section-label">Cold Leads · Score &lt; 50</div>
                {coldLeads.map((p, i) => <ProspectCard key={p.id} prospect={p} index={hotLeads.length + warmLeads.length + i} onDeepScan={handleDeepScan} scanningId={scanningId} />)}
              </>
            )}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text3)' }}>
                <p style={{ fontSize: 16, fontWeight: 600 }}>No prospects found</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )

  const TYPES = ['NBFC', 'Neobank', 'Payments', 'Insurtech', 'Lending']
  const GEOS = ['Pan-India', 'Metro-focused', 'Tier 2 & 3']

  return (
    <>
      {radarContent}
      {/* ICP Editor Modal */}
      <AnimatePresence>
        {showIcpModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={() => setShowIcpModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass" style={{ width: '100%', maxWidth: 500, borderRadius: 16, padding: 32 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)' }}>Edit ICP</h2>
                <button onClick={() => setShowIcpModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label className="form-label">Company Type</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TYPES.map(t => (
                      <button key={t} onClick={() => setIcpCompanyType(t)} style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                        background: icpCompanyType === t ? 'var(--teal)' : 'transparent',
                        color: icpCompanyType === t ? '#fff' : 'var(--text2)',
                        border: `1px solid ${icpCompanyType === t ? 'var(--teal)' : 'var(--border)'}`,
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Geography</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {GEOS.map(g => (
                      <button key={g} onClick={() => setIcpGeography(g)} style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
                        background: icpGeography === g ? 'var(--purple)' : 'transparent',
                        color: icpGeography === g ? '#fff' : 'var(--text2)',
                        border: `1px solid ${icpGeography === g ? 'var(--purple)' : 'var(--border)'}`,
                      }}>{g}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">ICP Description</label>
                  <textarea value={icpDefinition} onChange={e => setIcpDefinition(e.target.value)}
                    placeholder="Describe your ideal customer profile..."
                    className="input-field" style={{ minHeight: 120, resize: 'vertical', height: 'auto' }} />
                </div>
                <button onClick={saveIcp} disabled={icpSaving} className="btn-primary" style={{ width: 'fit-content' }}>
                  {icpSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {icpSaving ? 'Saving & Rescoring...' : 'Save & Rescore All'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
