import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { motion } from 'framer-motion'
import { Settings, User, Database, Trash2, AlertTriangle, Loader2, Sparkles, RefreshCw } from 'lucide-react'

const DEMO_SIGNALS = [
  { name: 'KreditBee', headlines: ['KreditBee raises $200M Series D to expand BNPL portfolio', 'KreditBee partners with NBFC to launch co-lending product'] },
  { name: 'Razorpay', headlines: ['Razorpay launches PayrollCard for SME payroll compliance', 'Razorpay expands UPI autopay to subscription businesses'] },
  { name: 'Jupiter Money', headlines: ['Jupiter Money integrates RBI-mandated FLDG norms into lending stack'] },
  { name: 'Fibe', headlines: ['Fibe reports 3x growth in salary advance disbursals Q1 2026'] },
  { name: 'Slice', headlines: ['Slice completes merger with North East SFB, becomes full-stack bank'] },
  { name: 'Niyo Solutions', headlines: ['Niyo launches cross-border forex card with zero markup'] },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [profile, setProfile] = useState({ icp_definition: '', company_type: '', stage_filter: [], geography: '', scan_frequency: '2x_daily' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [showDangerConfirm, setShowDangerConfirm] = useState(null)

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        icp_definition: profile.icp_definition,
        company_type: profile.company_type,
        stage_filter: profile.stage_filter,
        geography: profile.geography,
        scan_frequency: profile.scan_frequency,
      })
      if (error) throw error
      addToast('Profile saved', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
    setSaving(false)
  }

  const loadDemoSignals = async () => {
    setLoadingDemo(true)
    try {
      const { data: prospects } = await supabase.from('prospects').select('id, name')
      let inserted = 0
      for (const demo of DEMO_SIGNALS) {
        const prospect = prospects?.find(p => p.name === demo.name)
        if (!prospect) continue
        for (const headline of demo.headlines) {
          const { error } = await supabase.from('signals').insert({
            company_id: prospect.id,
            headline,
            source: 'deep-scan',
            url: `https://inc42.com/buzz/${demo.name.toLowerCase().replace(/\s/g, '-')}`,
            score_contribution: Math.floor(Math.random() * 20) + 5,
          })
          if (!error) inserted++
        }
      }
      addToast(`Loaded ${inserted} demo signals`, 'success')
    } catch (err) {
      addToast('Failed to load demo signals', 'error')
    }
    setLoadingDemo(false)
  }

  const clearSignals = async () => {
    try {
      await supabase.from('signals').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      addToast('All signals cleared', 'success')
    } catch { addToast('Failed to clear signals', 'error') }
    setShowDangerConfirm(null)
  }

  const resetScores = async () => {
    try {
      await supabase.from('prospects').update({ intent_score: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
      addToast('All scores reset to 0', 'success')
    } catch { addToast('Failed to reset scores', 'error') }
    setShowDangerConfirm(null)
  }

  if (loading) return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12, marginBottom: 16 }} />)}
    </div>
  )

  return (
    <div style={{ padding: '28px 40px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, letterSpacing: '-0.02em' }}>
        <Settings size={24} style={{ color: 'var(--teal)' }} /> Settings
      </h1>

      {/* ICP Configuration */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass" style={{ borderRadius: 14, padding: 28, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text1)', marginBottom: 20 }}>ICP Configuration</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label className="form-label">Company Type</label>
            <input type="text" value={profile.company_type || ''} onChange={e => setProfile(p => ({ ...p, company_type: e.target.value }))} className="input-field" placeholder="e.g., NBFC" />
          </div>
          <div>
            <label className="form-label">Geography</label>
            <input type="text" value={profile.geography || ''} onChange={e => setProfile(p => ({ ...p, geography: e.target.value }))} className="input-field" placeholder="e.g., Pan-India" />
          </div>
          <div>
            <label className="form-label">ICP Description</label>
            <textarea value={profile.icp_definition || ''} onChange={e => setProfile(p => ({ ...p, icp_definition: e.target.value }))}
              className="input-field" style={{ minHeight: 110, resize: 'vertical', height: 'auto' }} placeholder="Describe your ideal customer..." />
          </div>
          <div>
            <label className="form-label">Scan Frequency</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['2x_daily', '4x_daily', 'manual'].map(f => (
                <button key={f} onClick={() => setProfile(p => ({ ...p, scan_frequency: f }))}
                  style={{
                    padding: '9px 18px', borderRadius: 8, fontSize: 14, border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                    background: profile.scan_frequency === f ? 'var(--teal)' : 'transparent',
                    borderColor: profile.scan_frequency === f ? 'var(--teal)' : 'var(--border)',
                    color: profile.scan_frequency === f ? '#fff' : 'var(--text2)',
                    fontWeight: profile.scan_frequency === f ? 600 : 400,
                  }}>
                  {f === '2x_daily' ? '2x / day' : f === '4x_daily' ? '4x / day' : 'Manual'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={saveProfile} disabled={saving} className="btn-primary" style={{ width: 'fit-content' }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </motion.div>

      {/* Account */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass" style={{ borderRadius: 14, padding: 28, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><User size={18} /> Account</h2>
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>Email: <span style={{ color: 'var(--text1)' }}>{user?.email}</span></p>
      </motion.div>

      {/* Demo Controls */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass" style={{ borderRadius: 14, padding: 28, marginBottom: 20, border: '1px solid rgba(0,212,164,0.2)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Sparkles size={18} style={{ color: 'var(--teal)' }} /> Demo Controls
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>Load realistic demo signals for the hackathon presentation</p>
        <button onClick={loadDemoSignals} disabled={loadingDemo} className="btn-primary" style={{ width: 'fit-content' }}>
          {loadingDemo ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
          {loadingDemo ? 'Loading...' : 'Load Demo Signals'}
        </button>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="glass" style={{ borderRadius: 14, padding: 28, border: '1px solid rgba(255,80,64,0.2)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}><AlertTriangle size={18} /> Danger Zone</h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {showDangerConfirm === 'signals' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--coral)' }}>Are you sure?</span>
              <button onClick={clearSignals} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }}>Yes, clear all</button>
              <button onClick={() => setShowDangerConfirm(null)} className="btn-secondary" style={{ fontSize: 13 }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowDangerConfirm('signals')} className="btn-secondary" style={{ color: 'var(--coral)', borderColor: 'rgba(255,80,64,0.2)' }}>
              <Trash2 size={16} /> Clear All Signals
            </button>
          )}
          {showDangerConfirm === 'scores' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--coral)' }}>Are you sure?</span>
              <button onClick={resetScores} style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer' }}>Yes, reset</button>
              <button onClick={() => setShowDangerConfirm(null)} className="btn-secondary" style={{ fontSize: 13 }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowDangerConfirm('scores')} className="btn-secondary" style={{ color: 'var(--coral)', borderColor: 'rgba(255,80,64,0.2)' }}>
              <RefreshCw size={16} /> Reset All Scores
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
