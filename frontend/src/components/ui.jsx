/** Shared UI primitives */
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

// ── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ status, children, className = '' }) {
  const s = (status || children || '').toString().toLowerCase().replace(' ', '_');
  return <span className={`badge badge-${s} ${className}`}>{children || status}</span>;
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = '' }) {
  return <div className={`spinner ${size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : ''}`} />;
}

// ── Alert ────────────────────────────────────────────────────────────────────
const alertIcons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertCircle };
export function Alert({ type = 'info', children }) {
  const Icon = alertIcons[type] || Info;
  return (
    <div className={`alert alert-${type}`}>
      <Icon />
      <div>{children}</div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ width, height, className = '' }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: width || '100%', height: height || 14 }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton width="40%" height={16} />
      <Skeleton width="70%" height={12} />
      <Skeleton width="55%" height={12} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{Icon && <Icon />}</div>
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = '' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-bar">
      <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Confirm dialog (simple window.confirm wrapper styled) ─────────────────────
export function useConfirm() {
  return (message) => window.confirm(message);
}

// ── Page header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      {back && (
        <button className="btn-icon" onClick={back} title="Go back" style={{ color: 'var(--text-muted)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{title}</h1>
        {subtitle && <p className="text-muted text-xs" style={{ marginTop: 2 }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
