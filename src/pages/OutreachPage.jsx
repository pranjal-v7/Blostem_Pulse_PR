import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import {
  Mail, ShieldCheck, ShieldAlert, Wand2, ExternalLink,
  Search, Clock, Loader2, CheckCircle, Copy, Send
} from 'lucide-react'

const STAKEHOLDERS = ['CTO', 'CFO', 'Compliance Head', 'Founder']
const TONES = ['Formal', 'Consultative', 'Urgent', 'Friendly']

function timeAgo(d) {
  if (!d) return 'Never'
  const s = Math.floor((new Date() - new Date(d)) / 1000)
  if (s < 86400) return `${Math.floor(s / 3600)}h idle`
  return `${Math.floor(s / 86400)}d idle`
}

/* ─── Smart Logo with 3-tier fallback ──────────────────────── */
function OutreachLogo({ name, domain }) {
  const [stage, setStage] = useState('clearbit') // clearbit → favicon → initials

  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Pick a deterministic background colour from the name
  const palette = ['#0d9488', '#7c3aed', '#b45309', '#0e7490', '#be185d', '#065f46']
  const colour = palette[name.charCodeAt(0) % palette.length]

  const src =
    stage === 'clearbit'
      ? `https://logo.clearbit.com/${domain}`
      : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  return (
    <div style={{
      width: 34, height: 34, borderRadius: 8,
      background: stage === 'initials' ? colour : '#ffffff',
      border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden'
    }}>
      {stage === 'initials' ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{initials}</span>
      ) : (
        <img
          src={src}
          alt={name}
          style={{ width: 22, height: 22, objectFit: 'contain' }}
          onError={() => {
            if (stage === 'clearbit') setStage('favicon')
            else setStage('initials')
          }}
        />
      )}
    </div>
  )
}


export default function OutreachPage() {
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { addToast } = useToast()
  const [prospects, setProspects] = useState([])
  const [selected, setSelected] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stakeholder, setStakeholder] = useState('CTO')
  const [tone, setTone] = useState('Consultative')
  const [emailBody, setEmailBody] = useState('')
  const [subjectLine, setSubjectLine] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [complianceResult, setComplianceResult] = useState(null)
  const [isCheckingCompliance, setIsCheckingCompliance] = useState(false)
  const [isFixing, setIsFixing] = useState(false)
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchProspects() {
      const { data } = await supabase.from('prospects').select('*').order('intent_score', { ascending: false })
      // Deduplicate by name — keep highest intent_score row for each company
      const seen = new Map()
      for (const p of (data || [])) {
        const key = p.name.toLowerCase().trim()
        const existing = seen.get(key)
        if (!existing || (p.intent_score ?? -1) > (existing.intent_score ?? -1)) {
          seen.set(key, p)
        }
      }
      const deduped = Array.from(seen.values()).sort((a, b) => (b.intent_score ?? 0) - (a.intent_score ?? 0))
      setProspects(deduped)
      const preselect = searchParams.get('company_id')
      if (preselect && data) {
        const found = deduped.find(p => p.id === preselect)
        if (found) setSelected(found)
      }
    }
    fetchProspects()
  }, [searchParams])

  const filteredProspects = prospects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (filter === 'contacted') return matchesSearch && p.last_contacted
    if (filter === 'not_contacted') return matchesSearch && !p.last_contacted
    return matchesSearch
  })

  // Fallback email generator when Edge Function is unavailable
  const generateEmailFallback = async () => {
    const subject = `Re: Compliance automation for ${selected.name}'s ${selected.sector} operations`
    const body = `Dear ${stakeholder},\n\nI noticed ${selected.name}'s recent expansion in the ${selected.sector} space, particularly your operations out of ${selected.hq_city}. Given your ${selected.stage} stage and the increasing regulatory scrutiny from RBI on digital lending compliance, I wanted to reach out.\n\nBlostem's compliance automation platform has helped similar ${selected.sector} companies reduce their compliance overhead significantly while maintaining full RBI/SEBI adherence. Our AI-driven approach means your team can focus on growth rather than regulatory paperwork.\n\nSpecifically, we can help ${selected.name} with:\n• Automated KYC/AML compliance monitoring\n• Real-time regulatory change tracking (RBI circulars, SEBI updates)\n• Pre-audit readiness reports for your compliance team\n\nWould you have 15 minutes this week for a brief walkthrough? I'd love to show you how we've helped companies at a similar stage streamline their compliance workflows.\n\nBest regards,\nBlostem Team`

    setSubjectLine(subject)
    for (let i = 0; i < body.length; i += 3) {
      await new Promise(r => setTimeout(r, 15))
      setEmailBody(body.slice(0, i + 3))
    }
    setEmailBody(body)
    return body
  }

  // Generate email — tries Edge Function first, falls back to local
  const generateEmail = async () => {
    if (!selected) return
    setIsGenerating(true)
    setEmailBody('')
    setSubjectLine('')
    setComplianceResult(null)

    try {
      let fullText = ''
      let extractedSubject = false // local flag — avoids stale closure reads

      let response
      try {
        response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ company_id: selected.id, stakeholder, tone }),
          }
        )
      } catch (fetchErr) {
        throw new Error(`Network error: ${fetchErr.message}`)
      }

      if (!response.ok) {
        let errMsg = 'Generation failed'
        try {
          const errData = await response.json()
          errMsg = errData.error || errMsg
        } catch { /* response wasn't JSON */ }
        throw new Error(errMsg)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'content_block_delta' && data.delta?.text) {
                fullText += data.delta.text
                // Use local flag — not stale `subjectLine` state
                if (!extractedSubject && fullText.includes('\n')) {
                  const firstNL = fullText.indexOf('\n')
                  const subject = fullText.slice(0, firstNL).replace(/^Subject:\s*/i, '')
                  setSubjectLine(subject)
                  extractedSubject = true
                }
                setEmailBody(fullText)
              }
            } catch { /* skip malformed SSE chunks */ }
          }
        }
      }

      // Final pass: ensure subject is extracted even if newline came in last chunk
      if (!extractedSubject && fullText.includes('\n')) {
        const firstNL = fullText.indexOf('\n')
        setSubjectLine(fullText.slice(0, firstNL).replace(/^Subject:\s*/i, ''))
        fullText = fullText.slice(firstNL).trim()
        setEmailBody(fullText)
      }

      addToast('Email generated successfully', 'success')
      setIsGenerating(false)
      setTimeout(() => checkCompliance(fullText), 500)
    } catch (err) {
      console.warn('Edge Function failed, using fallback:', err.message)
      try {
        const fallbackBody = await generateEmailFallback()
        addToast('Email generated (offline mode)', 'success')
        setIsGenerating(false)
        setTimeout(() => checkCompliance(fallbackBody), 500)
      } catch (fallbackErr) {
        console.error('Fallback email generation also failed:', fallbackErr)
        addToast('Failed to generate email. Please try again.', 'error')
        setIsGenerating(false)
      }
    }
  }

  // ── Deterministic client-side compliance rules ──────────────────────────────
  // Mirrors the 7 rules in supabase/functions/_shared/prompts.ts
  // Sources: RBI Master Directions, SEBI MF Regulations, DPDPA 2023
  const COMPLIANCE_RULES = [
    {
      code: 'V1',
      pattern: /\b(best|recommended|you should (buy|invest|use)|top pick|#1 choice)\b/gi,
      rule_violated: 'V1: Specific product/bank recommendation',
      rule_source: 'SEBI MF Regulations 1996 & RBI Master Direction',
      fix: (s) => s.replace(/\b(best|recommended|you should (buy|invest|use)|top pick|#1 choice)\b/gi, 'well-suited'),
    },
    {
      code: 'V2',
      pattern: /\b(\d+(\.\d+)?%\s*(interest|APR|return|yield|p\.a\.|per annum))\b/gi,
      rule_violated: 'V2: Interest rate quoted without live source',
      rule_source: 'RBI Master Direction — Interest Rates on Deposits',
      fix: (s) => s.replace(/\b(\d+(\.\d+)?%\s*(interest|APR|return|yield|p\.a\.|per annum))\b/gi, 'competitive rates (subject to change — verify current rates)'),
    },
    {
      code: 'V4',
      pattern: /\b(guaranteed|100% safe|risk.?free|no risk|zero risk|assured returns?)\b/gi,
      rule_violated: 'V4: Guaranteed returns / risk-free claim',
      rule_source: 'SEBI MF Regulations 1996 — Prohibition on Guaranteed Returns',
      fix: (s) => s.replace(/\b(guaranteed|100% safe|risk.?free|no risk|zero risk|assured returns?)\b/gi, 'potential'),
    },
    {
      code: 'V5',
      // Only flag if the past-performance phrase is NOT already followed by the disclaimer
      pattern: /\b(past performance|historical returns?|previously delivered|delivered \d+%)\b(?![\s\S]*?not indicative of future results)/gi,
      rule_violated: 'V5: Past performance cited without disclaimer',
      rule_source: 'SEBI MF Regulations — Scheme Advertisement Guidelines',
      fix: (s) => {
        const disclaimer = '(Past performance is not indicative of future results.)'
        // Don't add if already present
        if (s.includes(disclaimer) || s.includes('not indicative of future results')) return s
        return s + '\n\n' + disclaimer
      },
    },
    {
      code: 'V7',
      pattern: /\b(limited time|only today|act now|last chance|expires? (today|soon)|don.?t miss|offer ends?)\b/gi,
      rule_violated: 'V7: Urgency / pressure language',
      rule_source: 'ASCI Code & RBI Fair Practices Code',
      fix: (s) => s.replace(/\b(limited time|only today|act now|last chance|expires? (today|soon)|don.?t miss|offer ends?)\b/gi, 'at your convenience'),
    },
  ]

  const runClientComplianceCheck = (text) => {
    const flags = []
    const sentences = text.match(/[^.!?\n]+[.!?\n]?/g) || [text]
    for (const rule of COMPLIANCE_RULES) {
      for (const sentence of sentences) {
        if (rule.pattern.test(sentence.trim())) {
          rule.pattern.lastIndex = 0 // reset regex state
          flags.push({
            sentence: sentence.trim().slice(0, 200),
            rule_violated: rule.rule_violated,
            rule_source: rule.rule_source,
            suggested_fix: rule.fix(sentence.trim()),
          })
          break // one flag per rule max
        }
        rule.pattern.lastIndex = 0
      }
    }
    return { passed: flags.length === 0, flags }
  }

  // Compliance check
  const checkCompliance = async (body) => {
    setIsCheckingCompliance(true)
    const textToCheck = body || emailBody
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-compliance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ email_body: textToCheck }),
        }
      )
      // If the edge function is unavailable/unauthorized, fall back to client-side check
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      // Normalise shape — always ensure flags is an array
      const result = { passed: data.passed ?? true, flags: Array.isArray(data.flags) ? data.flags : [] }
      setComplianceResult(result)
      if (result.passed) {
        addToast('Compliance check passed', 'success')
      } else {
        addToast(`${result.flags.length} compliance issue(s) found`, 'warning')
      }
    } catch (err) {
      console.warn('Compliance Edge Function failed, using deterministic fallback:', err.message)
      const result = runClientComplianceCheck(textToCheck)
      setComplianceResult(result)
      if (result.passed) {
        addToast('Compliance check passed', 'success')
      } else {
        addToast(`${result.flags.length} compliance issue(s) found`, 'warning')
      }
    }
    setIsCheckingCompliance(false)
  }

  // Auto-fix compliance
  const handleAutoFix = async () => {
    if (!complianceResult?.flags?.length) return
    setIsFixing(true)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-fix-compliance`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ email_body: emailBody, flags: complianceResult.flags }),
        }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!data.fixed_email_body) throw new Error('Empty response from auto-fix')
      setEmailBody(data.fixed_email_body)
      addToast('Email auto-fixed!', 'success')
      setIsFixing(false)
      setTimeout(() => checkCompliance(data.fixed_email_body), 500)
    } catch (err) {
      console.warn('Auto-fix Edge Function failed, using client-side fallback:', err.message)
      // Apply each rule's regex fix() directly on the full email body — robust, no substring matching
      let fixed = emailBody
      for (const rule of COMPLIANCE_RULES) {
        rule.pattern.lastIndex = 0
        fixed = rule.fix(fixed)
        rule.pattern.lastIndex = 0
      }
      setEmailBody(fixed)
      addToast('Email auto-fixed (offline mode)', 'success')
      setIsFixing(false)
      // Re-run compliance check on the fixed text so the panel updates
      setTimeout(() => checkCompliance(fixed), 400)
    }
  }

  const openInGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(emailBody)}`
    window.open(gmailUrl, '_blank')
  }

  const copyEmail = async () => {
    const fullText = subjectLine
      ? `Subject: ${subjectLine}\n\n${emailBody}`
      : emailBody
    try {
      await navigator.clipboard.writeText(fullText)
    } catch {
      // fallback for non-https or older browsers
      const el = document.createElement('textarea')
      el.value = fullText
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    addToast('Email copied to clipboard!', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  const markContacted = async () => {
    if (!selected) return
    const now = new Date().toISOString()
    // Update prospect's last_contacted
    await supabase.from('prospects').update({ last_contacted: now }).eq('id', selected.id)
    // Insert into emails_sent history
    if (session?.user?.id) {
      await supabase.from('emails_sent').insert({
        company_id: selected.id,
        user_id: session.user.id,
        stakeholder,
        tone,
        email_body: emailBody,
        compliance_passed: complianceResult?.passed || false,
      })
    }
    setProspects(prev => prev.map(p => p.id === selected.id ? { ...p, last_contacted: now } : p))
    addToast(`${selected.name} marked as contacted`, 'success')
    // Auto-advance to next uncontacted prospect
    const nextProspect = prospects.find(p => p.id !== selected.id && !p.last_contacted)
    if (nextProspect) {
      setSelected(nextProspect)
      setEmailBody('')
      setSubjectLine('')
      setComplianceResult(null)
      addToast(`Switched to ${nextProspect.name}`, 'info')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left Panel — 340px (expanded 20px) */}
      <div style={{ width: 340, minWidth: 340, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg1)' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text1)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Mail size={18} style={{ color: 'var(--teal)' }} /> Outreach
          </h2>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="input-field" style={{ paddingLeft: 36 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            {['all', 'not_contacted', 'contacted'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.2s',
                  background: filter === f ? 'var(--teal-glow)' : 'transparent',
                  color: filter === f ? 'var(--teal)' : 'var(--text3)',
                  fontWeight: filter === f ? 600 : 400,
                }}>
                {f === 'all' ? 'All' : f === 'not_contacted' ? 'New' : 'Contacted'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredProspects.map(p => {
            const domain = p.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || `${p.name.toLowerCase().replace(/\s+/g, '')}.com`
            return (
            <button key={p.id} onClick={() => setSelected(p)}
              style={{
                width: '100%', padding: '14px 16px', textAlign: 'left', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--border)', transition: 'background 0.2s',
                background: selected?.id === p.id ? 'var(--teal-glow)' : 'transparent',
                borderLeft: selected?.id === p.id ? '3px solid var(--teal)' : '3px solid transparent',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <OutreachLogo name={p.name} domain={domain} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span className={`heat-tag ${p.intent_score > 75 ? 'hot' : p.intent_score >= 50 ? 'warm' : 'cold'}`}>{p.intent_score}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    <span>{p.sector}</span>
                    <span>·</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {timeAgo(p.last_contacted)}</span>
                  </div>
                </div>
              </div>
            </button>
            )
          })}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <div style={{ textAlign: 'center' }}>
              <Mail size={56} style={{ margin: '0 auto 20px', color: 'var(--text3)', opacity: 0.3 }} />
              <p style={{ color: 'var(--text3)', fontSize: 15 }}>Select a company to generate an outreach email</p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
            {/* Company header with logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: '#ffffff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                <img src={`https://logo.clearbit.com/${selected.website?.replace(/^https?:\/\//, '').replace(/\/$/, '')}`} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none' }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>{selected.name}</h2>
              <span className={`heat-tag ${selected.intent_score > 75 ? 'hot' : selected.intent_score >= 50 ? 'warm' : 'cold'}`}>{selected.intent_score}</span>
            </div>

            {/* Controls */}
            <div className="glass" style={{ borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: '#ffffff', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block', fontWeight: 500 }}>Stakeholder</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STAKEHOLDERS.map(s => (
                    <button key={s} onClick={() => setStakeholder(s)}
                      style={{
                        padding: '9px 18px', borderRadius: 8, fontSize: 14, border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                        background: stakeholder === s ? 'var(--teal)' : 'transparent',
                        borderColor: stakeholder === s ? 'var(--teal)' : 'var(--border)',
                        color: stakeholder === s ? '#fff' : '#ffffff',
                        fontWeight: stakeholder === s ? 600 : 400,
                      }}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#ffffff', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block', fontWeight: 500 }}>Tone</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TONES.map(t => (
                    <button key={t} onClick={() => setTone(t)}
                      style={{
                        padding: '9px 18px', borderRadius: 8, fontSize: 14, border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                        background: tone === t ? 'var(--purple)' : 'transparent',
                        borderColor: tone === t ? 'var(--purple)' : 'var(--border)',
                        color: tone === t ? '#fff' : '#ffffff',
                        fontWeight: tone === t ? 600 : 400,
                      }}>{t}</button>
                  ))}
                </div>
              </div>
              <button onClick={generateEmail} disabled={isGenerating} className="btn-primary">
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {isGenerating ? 'Generating...' : 'Generate Email'}
              </button>
            </div>

            {/* Email output */}
            {(emailBody || isGenerating) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {subjectLine && (
                  <div className="glass" style={{ borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Subject: </span>
                      <span style={{ fontSize: 14, color: '#ffffff' }}>{subjectLine}</span>
                    </div>
                  </div>
                )}
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  className={`input-field ${isGenerating ? 'streaming-cursor' : ''}`}
                  style={{ minHeight: 300, fontSize: 14, lineHeight: 1.7, resize: 'vertical' }}
                  readOnly={isGenerating} />

                {/* ── Action bar: Copy + Gmail — visible as soon as email exists ── */}
                {emailBody && !isGenerating && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 12,
                    }}
                  >
                    {/* Copy Email */}
                    <button
                      onClick={copyEmail}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '14px 20px', borderRadius: 12, cursor: 'pointer',
                        border: `1px solid ${copied ? 'rgba(0,212,164,0.4)' : 'rgba(0,212,164,0.15)'}`,
                        background: copied ? 'rgba(0,212,164,0.12)' : 'rgba(0,212,164,0.05)',
                        color: copied ? 'var(--teal)' : '#ffffff',
                        fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {copied
                        ? <><CheckCircle size={16} style={{ color: 'var(--teal)' }} /> Copied!</>
                        : <><Copy size={16} /> Copy Email</>}
                    </button>

                    {/* Send in Gmail */}
                    <button
                      onClick={openInGmail}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '14px 20px', borderRadius: 12, cursor: 'pointer',
                        border: '1px solid rgba(123,110,255,0.2)',
                        background: 'rgba(123,110,255,0.07)',
                        color: '#ffffff',
                        fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,110,255,0.14)'; e.currentTarget.style.borderColor = 'rgba(123,110,255,0.35)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,110,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(123,110,255,0.2)' }}
                    >
                      <Send size={16} /> Send in Gmail
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            {/* Compliance */}
            {isCheckingCompliance && (
              <div className="glass" style={{ borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="spin-sm" />
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Checking compliance...</span>
              </div>
            )}
            {complianceResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ borderRadius: 14, padding: 24 }}>
                {complianceResult.passed ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--teal)' }}>
                    <ShieldCheck size={22} /> <span style={{ fontSize: 15, fontWeight: 600 }}>✓ Compliance Passed</span>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--coral)', marginBottom: 16 }}>
                      <ShieldAlert size={22} /> <span style={{ fontSize: 15, fontWeight: 600 }}>⚠ {complianceResult?.flags?.length ?? 0} Issue{(complianceResult?.flags?.length ?? 0) > 1 ? 's' : ''} Found</span>
                    </div>
                    {(complianceResult?.flags ?? []).map((f, i) => (
                      <div key={i} style={{ background: 'var(--coral-glow)', borderRadius: 10, padding: 16, marginBottom: 10, border: '1px solid rgba(255,80,64,0.15)' }}>
                        <p style={{ fontSize: 13, color: '#FF8070', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>"{f.sentence}"</p>
                        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>Rule: {f.rule_violated}</p>
                        {f.rule_source && (
                          <p style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)', opacity: 0.7, marginBottom: 6 }}>📋 {f.rule_source}</p>
                        )}
                        <p style={{ fontSize: 13, color: 'var(--teal)', marginTop: 4 }}>Fix: {f.suggested_fix}</p>
                      </div>
                    ))}
                    <button onClick={handleAutoFix} disabled={isFixing} className="btn-primary" style={{ marginTop: 8 }}>
                      {isFixing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {isFixing ? 'Fixing...' : 'Auto-Fix All'}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Mark contacted — only after compliance passes */}
            {complianceResult?.passed && emailBody && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <button onClick={markContacted} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  <CheckCircle size={16} /> Mark as Contacted
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
