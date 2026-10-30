import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { User, Key, Bell, Shield, Info, CheckCircle2 } from 'lucide-react';
import { Alert, PageHeader } from '../components/ui.jsx';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card mb-4" style={{ padding: '20px 24px' }}>
      <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <Icon size={16} color="var(--accent)" />
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="main-area">
      <PageHeader title="Settings" subtitle="Account preferences and platform configuration" />
      <div className="page-content" style={{ maxWidth: 560 }}>

        {saved && (
          <Alert type="success" style={{ marginBottom: 16 }}>
            <CheckCircle2 size={14} /> Settings saved
          </Alert>
        )}

        {/* Account */}
        <Section icon={User} title="Account">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="input" defaultValue={user?.username || ''} readOnly
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" defaultValue={user?.email || ''} readOnly
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">User ID</label>
              <input className="input font-mono text-xs" defaultValue={user?.id || ''} readOnly
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Member Since</label>
              <input className="input" defaultValue={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''} readOnly
                style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)', cursor: 'not-allowed' }} />
            </div>
            <p className="text-xs text-muted">Profile editing will be available in a future update.</p>
          </div>
        </Section>

        {/* Platform */}
        <Section icon={Shield} title="Platform & Security">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Auth', 'JWT Bearer tokens · 24h expiry'],
              ['Transport', 'HTTPS enforced in production'],
              ['Secrets', 'Gemini keys & DB credentials — backend only'],
              ['Uploads', 'SHA-256 verified · ZIP path-traversal protected'],
              ['CORS', 'Origin allowlist enforced'],
              ['Test runs', 'Container-isolated · non-root · resource limits'],
              ['Artifacts', 'Access-controlled · 30-day retention'],
              ['SSRF', 'URL destination validation · metadata endpoint blocked'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <CheckCircle2 size={14} color="var(--green-600)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <span style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{label}</span>
                  <span className="text-xs text-muted" style={{ marginLeft: 8 }}>{val}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Execution defaults */}
        <Section icon={Key} title="Execution Defaults">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Default Browser</label>
              <select className="input" defaultValue="chromium">
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Viewport</label>
              <select className="input" defaultValue="1280x720">
                <option value="1280x720">1280 × 720</option>
                <option value="1920x1080">1920 × 1080</option>
                <option value="375x812">375 × 812 (Mobile)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Step Timeout</label>
              <input type="number" className="input" defaultValue={30000} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Retries</label>
              <input type="number" className="input" defaultValue={2} min={0} max={5} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" defaultChecked /> Self-healing enabled
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" defaultChecked /> Screenshot on failure
            </label>
          </div>
          <button className="btn btn-primary btn-sm mt-4" onClick={showSaved} style={{ marginTop: 16 }}>
            Save Preferences
          </button>
        </Section>

        {/* About */}
        <Section icon={Info} title="About TestSphere">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Version', '1.0.0'],
              ['Backend', 'FastAPI + SQLAlchemy + SQLite/PostgreSQL'],
              ['AI', 'LangGraph · LangChain · Gemini 2.0 Flash'],
              ['Testing', 'Playwright · Sentence Transformers · FAISS'],
              ['Queue', 'Celery + Redis (optional)'],
              ['Live updates', 'WebSockets + polling fallback'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 16 }}>
                <span className="text-xs text-muted" style={{ minWidth: 110 }}>{label}</span>
                <span className="text-xs font-mono">{val}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
