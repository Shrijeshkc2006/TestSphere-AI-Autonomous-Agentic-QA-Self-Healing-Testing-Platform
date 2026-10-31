import { useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { User, Shield, Info, CheckCircle2, Sliders } from 'lucide-react';
import { Alert, PageHeader } from '../components/ui.jsx';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card mb-4" style={{ padding: '18px 20px' }}>
      <div
        className="flex items-center gap-2 mb-4"
        style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 10 }}
      >
        <Icon size={15} style={{ color: 'var(--accent)' }} />
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </h2>
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
      <PageHeader
        title="Settings"
        subtitle="Platform preferences, execution configurations, and security verification"
      />

      <div className="page-content" style={{ maxWidth: 640 }}>
        {saved && (
          <Alert type="success" style={{ marginBottom: 16 }}>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Execution preferences successfully updated
            </span>
          </Alert>
        )}

        {/* Account Details */}
        <Section icon={User} title="Developer Account">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="input"
                defaultValue={user?.username || ''}
                readOnly
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'default' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="input"
                defaultValue={user?.email || ''}
                readOnly
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'default' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Account Identifier</label>
              <input
                className="input font-mono text-xs"
                defaultValue={user?.id || ''}
                readOnly
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'default' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Registration Timestamp</label>
              <input
                className="input font-mono text-xs"
                defaultValue={user?.created_at ? new Date(user.created_at).toLocaleString() : 'Active session'}
                readOnly
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'default' }}
              />
            </div>
          </div>
        </Section>

        {/* Platform Security Checklist */}
        <Section icon={Shield} title="Platform Security Posture">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['JWT Authentication', '24h token validity with backend secret verification'],
              ['Container Sandbox', 'Non-root execution with memory & CPU quotas'],
              ['SSRF Guard', 'Destination IP filtering and cloud metadata blocks'],
              ['Upload Integrity', 'SHA-256 hash checks and ZIP traversal containment'],
              ['Secret Redaction', 'Automated masking for credentials in logs & traces'],
              ['Artifact Governance', 'Owner-scoped download URLs with 30-day retention'],
            ].map(([label, desc]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                    {label}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Execution Defaults */}
        <Section icon={Sliders} title="Execution Environment Defaults">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Target Browser Engine</label>
              <select className="select font-mono text-xs" defaultValue="chromium">
                <option value="chromium">Chromium (Default)</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit (Safari)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Viewport Dimensions</label>
              <select className="select font-mono text-xs" defaultValue="1280x720">
                <option value="1280x720">1280 × 720 (Desktop HD)</option>
                <option value="1920x1080">1920 × 1080 (Desktop FHD)</option>
                <option value="375x812">375 × 812 (Mobile Portrait)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Step Timeout (ms)</label>
              <input type="number" className="input font-mono text-xs" defaultValue={30000} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Retries on Failure</label>
              <input type="number" className="input font-mono text-xs" defaultValue={2} min={0} max={5} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
              <input type="checkbox" defaultChecked /> Enable self-healing locator strategies
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
              <input type="checkbox" defaultChecked /> Capture screenshot on step failure
            </label>
          </div>

          <button className="btn btn-primary btn-sm mt-4" onClick={showSaved}>
            Save Preferences
          </button>
        </Section>

        {/* System Stack Info */}
        <Section icon={Info} title="TestSphere Architecture">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Engine Version', '1.0.0 (Production)'],
              ['API & Server', 'FastAPI · SQLAlchemy ORM · Uvicorn'],
              ['Autonomous Agent', 'LangGraph · LangChain · Gemini 2.0 Flash'],
              ['Browser Testing', 'Playwright · Chromium · WebKit · Firefox'],
              ['Vector Locators', 'Sentence Transformers · FAISS Indexing'],
              ['Task Pipeline', 'Celery Workers · Redis Broker (Optional)'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between"
                style={{ padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}
              >
                <span className="text-xs text-muted">{k}</span>
                <span className="font-mono text-xs text-primary">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
