import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          textAlign: 'center',
          maxWidth: 400,
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          marginBottom: 24
        }}>
          <AlertCircle size={32} style={{ color: 'var(--text3)' }} />
        </div>

        <h1 style={{ 
          fontSize: 32, 
          fontWeight: 600, 
          letterSpacing: '-0.02em',
          color: 'var(--text1)',
          marginBottom: 12
        }}>
          404 - Page Not Found
        </h1>
        
        <p style={{ 
          fontSize: 15, 
          color: 'var(--text2)', 
          lineHeight: 1.6,
          marginBottom: 32
        }}>
          We couldn't find the page you're looking for. It might have been moved, deleted, or perhaps the URL is incorrect.
        </p>

        <Link 
          to="/app/radar" 
          className="btn-primary" 
          style={{ 
            display: 'inline-flex', 
            height: 44,
            padding: '0 24px',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </motion.div>
    </div>
  )
}
