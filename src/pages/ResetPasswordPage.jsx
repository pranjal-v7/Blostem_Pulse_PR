import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { ArrowRight, Loader2, Eye, EyeOff, Lock, CheckCircle } from 'lucide-react'

function BlostemLogoBig() {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#0A7A60" />
          <stop offset="100%" stopColor="#00D4A4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-g)" />
      <path d="M10 10h5l3 4-3 4h-5l-3-4 3-4z" fill="rgba(255,255,255,0.9)" />
      <path d="M17 14h5l3 4-3 4h-5l-3-4 3-4z" fill="rgba(255,255,255,0.6)" />
    </svg>
  )
}

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { addToast } = useToast()
  const navigate = useNavigate()

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword
  const passwordLong = newPassword.length >= 6

  const handleReset = async (e) => {
    e.preventDefault()
    if (!passwordLong) {
      addToast('Password must be at least 6 characters', 'warning')
      return
    }
    if (!passwordsMatch) {
      addToast('Passwords do not match', 'error')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setSuccess(true)
      addToast('Password updated successfully!', 'success')
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      addToast(err.message, 'error')
    }
    setLoading(false)
  }

  const eyeBtnStyle = {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
    padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.2s',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Background */}
      <div className="bg-canvas">
        <div className="beam beam-1" />
        <div className="beam beam-2" />
        <div className="beam beam-3" />
      </div>
      <div className="grain-overlay" />

      <div className="login-card" style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <BlostemLogoBig />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text1)', letterSpacing: '-0.02em' }}>blostem</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--teal)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>PULSE</span>
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={48} style={{ color: 'var(--teal)', marginBottom: 16 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>Password Updated!</h2>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>Your password has been changed successfully. Redirecting to login...</p>
            <div style={{ width: '100%', height: 3, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: 'var(--teal)', borderRadius: 4,
                animation: 'progressBar 2.5s ease forwards',
              }} />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Lock size={20} style={{ color: 'var(--teal)' }} />
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>Reset Password</h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>
              Enter your new password below. Make sure it's at least 6 characters.
            </p>

            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* New Password */}
              <div>
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} style={eyeBtnStyle}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {newPassword && !passwordLong && (
                  <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>Must be at least 6 characters</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeBtnStyle}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>Passwords do not match</p>
                )}
                {passwordsMatch && (
                  <p style={{ fontSize: 12, color: 'var(--teal)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} /> Passwords match
                  </p>
                )}
              </div>

              <button type="submit" disabled={loading || !passwordsMatch || !passwordLong} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: (!passwordsMatch || !passwordLong) ? 0.5 : 1 }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Updating...' : 'Update Password'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <button onClick={() => navigate('/login')} style={{
              background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer',
              fontSize: 13, textAlign: 'center', width: '100%', marginTop: 20,
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--teal)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
              ← Back to Sign in
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  )
}
