import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'

const ToastContext = createContext({})

const TOAST_ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
}

const TOAST_CLASSES = {
  success: 'toast-success',
  warning: 'toast-warning',
  error: 'toast-error',
  info: 'toast-info',
}

const TOAST_ICON_COLORS = {
  success: 'var(--teal)',
  warning: 'var(--amber)',
  error: 'var(--coral)',
  info: 'var(--purple)',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => {
          const Icon = TOAST_ICONS[toast.type]
          return (
            <div key={toast.id} className={`toast ${TOAST_CLASSES[toast.type]}`}>
              <Icon size={18} style={{ color: TOAST_ICON_COLORS[toast.type], flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--text1)' }}>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
