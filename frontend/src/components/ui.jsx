/** Shared UI primitives — Developer Dark Theme */
import { useEffect } from 'react';
import {
  AlertCircle, CheckCircle2, Info, AlertTriangle, ArrowLeft,
  X, Search,
} from 'lucide-react';

// ── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ status, children, className = '' }) {
  const raw = (status || children || '').toString().toLowerCase().replace(/\s+/g, '_');
  return (
    <span className={`badge badge-${raw} ${className}`}>
      {children || status}
    </span>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = '' }) {
  return (
    <div
      className={`spinner ${size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : ''}`}
      aria-label="Loading"
      role="status"
    />
  );
}

// ── Alert ────────────────────────────────────────────────────────────────────
const alertIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

export function Alert({ type = 'info', children, style, className = '' }) {
  const Icon = alertIcons[type] || Info;
  return (
    <div className={`alert alert-${type} ${className}`} style={style} role="alert">
      <Icon />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ width, height, className = '', style }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width || '100%',
        height: height || 14,
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton width="35%" height={14} />
      <Skeleton width="75%" height={11} />
      <Skeleton width="50%" height={11} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state-icon">
          <Icon />
        </div>
      )}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = '' }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className="progress-bar">
      <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, subtext, color = '', icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-card-label">{label}</span>
        {Icon && <Icon size={14} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <span className={`stat-card-value ${color}`}>{value}</span>
      {subtext && <span className="stat-card-sub">{subtext}</span>}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, back, breadcrumbs }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {back && (
          <button
            className="btn-icon"
            onClick={back}
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          {breadcrumbs && (
            <div className="breadcrumbs" style={{ marginBottom: 2 }}>
              {breadcrumbs}
            </div>
          )}
          <h1 className="page-header-title">{title}</h1>
          {subtitle && (
            <div className="page-header-subtitle">{subtitle}</div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ── Search Input ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…', maxWidth = 320 }) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth }}>
      <Search
        size={13}
        style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        className="input"
        style={{ paddingLeft: 30, paddingRight: value ? 28 : 10, height: 32 }}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } })}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Clear search"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── Modal Dialog ──────────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, footer, maxWidth = 520 }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth,
          boxShadow: 'var(--shadow-lg)',
          background: 'var(--bg-elevated)',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={14} />
          </button>
        </div>
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border-primary)',
              background: 'var(--bg-card)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Confirm dialog hook ───────────────────────────────────────────────────────
export function useConfirm() {
  return (message) => window.confirm(message);
}
