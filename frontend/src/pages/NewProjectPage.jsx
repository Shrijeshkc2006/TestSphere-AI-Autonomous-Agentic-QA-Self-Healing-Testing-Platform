import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Monitor, Upload, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, X, FileArchive } from 'lucide-react';
import { projectsApi, uploadsApi } from '../api/client.js';
import { Alert, Spinner, ProgressBar, PageHeader } from '../components/ui.jsx';

const STEPS = ['Choose Type', 'Configure', 'Confirm'];

const typeCards = [
  {
    id: 'url',
    icon: Globe,
    label: 'Deployed URL',
    description: 'Test a publicly accessible website or web app at a remote URL.',
    example: 'https://your-app.com',
    color: 'var(--indigo-600)',
    bg: 'var(--indigo-50)',
  },
  {
    id: 'local_url',
    icon: Monitor,
    label: 'Local URL',
    description: 'Test an app running locally on your machine or within Docker.',
    example: 'http://localhost:3000',
    color: 'var(--green-600)',
    bg: 'var(--green-50)',
  },
  {
    id: 'zip_upload',
    icon: Upload,
    label: 'ZIP Upload',
    description: 'Upload your project source code. TestSphere will install, build, and start it.',
    example: 'my-react-app.zip',
    color: 'var(--amber-600)',
    bg: 'var(--amber-50)',
  },
];

function TypeStep({ selected, onSelect }) {
  return (
    <div>
      <p className="text-sm text-muted mb-6" style={{ maxWidth: 520 }}>
        Choose how you want to provide the application under test. Each mode is
        fully isolated and validated before testing begins.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16 }}>
        {typeCards.map(card => {
          const Icon = card.icon;
          const isActive = selected === card.id;
          return (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              style={{
                background: isActive ? card.bg : 'var(--bg)',
                border: `2px solid ${isActive ? card.color : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '20px 18px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all var(--transition)',
                boxShadow: isActive ? `0 0 0 3px ${card.bg}` : 'none',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isActive ? card.color : 'var(--bg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12, transition: 'background var(--transition)',
              }}>
                <Icon size={20} color={isActive ? '#fff' : 'var(--text-muted)'} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 4, color: isActive ? card.color : 'var(--text-strong)' }}>
                {card.label}
              </div>
              <p className="text-xs text-muted" style={{ marginBottom: 8 }}>{card.description}</p>
              <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', padding: '2px 6px', borderRadius: 4 }}>
                {card.example}
              </code>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DropZone({ onFile, file, progress, uploading, uploadResult, uploadError }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : file ? 'var(--green-500)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '36px 24px',
          textAlign: 'center',
          cursor: file ? 'default' : 'pointer',
          background: dragging ? 'var(--accent-bg)' : file ? 'var(--green-50)' : 'var(--bg-subtle)',
          transition: 'all var(--transition)',
        }}
      >
        <input ref={inputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => onFile(e.target.files[0])} />
        {file ? (
          <>
            <FileArchive size={36} color="var(--green-600)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, color: 'var(--green-700)' }}>{file.name}</div>
            <div className="text-xs text-muted mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </>
        ) : (
          <>
            <Upload size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 500 }}>Drop your ZIP archive here</div>
            <p className="text-xs text-muted mt-1">or click to browse — max 100 MB, .zip only</p>
          </>
        )}
      </div>

      {uploading && (
        <div style={{ marginTop: 12 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted">Uploading &amp; analysing…</span>
            <span className="text-xs text-muted">{progress}%</span>
          </div>
          <ProgressBar value={progress} max={100} color="indigo" />
        </div>
      )}

      {uploadError && <Alert type="error" style={{ marginTop: 12 }}>{uploadError}</Alert>}

      {uploadResult && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--radius)', display: 'flex', gap: 8 }}>
          <CheckCircle2 size={16} color="var(--green-600)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--green-700)' }}>Upload verified</div>
            <div className="text-xs text-muted mt-1">
              Framework: <strong>{uploadResult.framework || 'Unknown'}</strong>
              {uploadResult.package_manager && <> · PM: <strong>{uploadResult.package_manager}</strong></>}
            </div>
            {uploadResult.validation_errors?.length > 0 && (
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                {uploadResult.validation_errors.map((e, i) => (
                  <li key={i} className="text-xs" style={{ color: 'var(--amber-600)' }}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [type, setType] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    target_url: '',
    build_command: '',
    start_command: '',
    health_check_url: '',
    app_port: '',
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const typeInfo = typeCards.find(c => c.id === type);

  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.endsWith('.zip')) { setUploadError('Only .zip archives are supported.'); return; }
    if (f.size > 100 * 1024 * 1024) { setUploadError('File exceeds the 100 MB limit.'); return; }
    setFile(f);
    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadsApi.upload(f, pct => setUploadProgress(pct));
      setUploadResult(result);
      // Auto-fill detected info
      if (result.framework) setForm(prev => ({ ...prev, name: prev.name || f.name.replace('.zip', '') }));
    } catch (e) {
      setUploadError(e.message);
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const canNextStep1 = type !== null;
  const canNextStep2 = () => {
    if (!form.name.trim()) return false;
    if (type === 'url' || type === 'local_url') return !!form.target_url.trim();
    if (type === 'zip_upload') return !!uploadResult;
    return false;
  };

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        project_type: type,
      };
      if (type !== 'zip_upload') {
        payload.target_url = form.target_url;
      } else {
        payload.upload_id = uploadResult.id;
        if (uploadResult.framework) payload.framework = uploadResult.framework;
        if (uploadResult.package_manager) payload.package_manager = uploadResult.package_manager;
        if (form.build_command) payload.build_command = form.build_command;
        if (form.start_command) payload.start_command = form.start_command;
        if (form.health_check_url) payload.health_check_url = form.health_check_url;
        if (form.app_port) payload.app_port = parseInt(form.app_port);
      }
      const project = await projectsApi.create(payload);
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="main-area">
      <PageHeader
        title="New Project"
        subtitle="Set up a project to start AI-assisted testing"
        back={() => navigate('/projects')}
      />
      <div className="page-content" style={{ maxWidth: 680 }}>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600,
                background: i < step ? 'var(--green-500)' : i === step ? 'var(--accent)' : 'var(--bg-muted)',
                color: i <= step ? '#fff' : 'var(--text-muted)',
                transition: 'all var(--transition)',
              }}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: i === step ? 600 : 400, color: i === step ? 'var(--text-strong)' : 'var(--text-muted)' }}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div style={{ width: 32, height: 1, background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: '28px 24px' }}>
          {/* Step 0: Type */}
          {step === 0 && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>Choose your testing entry point</h2>
              <TypeStep selected={type} onSelect={setType} />
            </>
          )}

          {/* Step 1: Configure */}
          {step === 1 && typeInfo && (
            <>
              <div className="flex items-center gap-3 mb-6" style={{
                padding: '10px 14px', background: typeInfo.bg,
                borderRadius: 'var(--radius)', border: `1px solid ${typeInfo.color}20`,
              }}>
                <typeInfo.icon size={18} color={typeInfo.color} />
                <span style={{ fontWeight: 500, color: typeInfo.color }}>{typeInfo.label}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="proj-name">Project Name *</label>
                  <input id="proj-name" className="input" placeholder="My App Tests"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="proj-desc">Description</label>
                  <textarea id="proj-desc" className="input" rows={2} placeholder="Optional description"
                    style={{ resize: 'vertical' }}
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                {(type === 'url' || type === 'local_url') && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="proj-url">
                      {type === 'url' ? 'Target URL *' : 'Local URL *'}
                    </label>
                    {type === 'local_url' && (
                      <p className="text-xs text-muted mb-2">
                        The test runner must be able to reach this address. Use <code>http://host.docker.internal:PORT</code> if running in Docker.
                      </p>
                    )}
                    <input id="proj-url" className="input"
                      placeholder={type === 'url' ? 'https://your-app.com' : 'http://localhost:3000'}
                      value={form.target_url}
                      onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))} />
                  </div>
                )}

                {type === 'zip_upload' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">ZIP Archive *</label>
                      <DropZone
                        file={file}
                        onFile={handleFile}
                        progress={uploadProgress}
                        uploading={uploading}
                        uploadResult={uploadResult}
                        uploadError={uploadError}
                      />
                    </div>

                    {uploadResult && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group">
                          <label className="form-label" htmlFor="build-cmd">Build Command</label>
                          <input id="build-cmd" className="input font-mono text-xs"
                            placeholder={uploadResult.detected_scripts?.build || 'npm run build'}
                            value={form.build_command}
                            onChange={e => setForm(f => ({ ...f, build_command: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="start-cmd">Start Command</label>
                          <input id="start-cmd" className="input font-mono text-xs"
                            placeholder={uploadResult.detected_scripts?.start || 'npm start'}
                            value={form.start_command}
                            onChange={e => setForm(f => ({ ...f, start_command: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="health-url">Health Check URL</label>
                          <input id="health-url" className="input font-mono text-xs"
                            placeholder="http://localhost:3000"
                            value={form.health_check_url}
                            onChange={e => setForm(f => ({ ...f, health_check_url: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="app-port">App Port</label>
                          <input id="app-port" type="number" className="input"
                            placeholder="3000"
                            value={form.app_port}
                            onChange={e => setForm(f => ({ ...f, app_port: e.target.value }))} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Step 2: Confirm */}
          {step === 2 && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Review &amp; Create</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Project Name', form.name],
                  ['Type', typeInfo?.label],
                  ['Description', form.description || '—'],
                  type !== 'zip_upload' && ['Target URL', form.target_url],
                  type === 'zip_upload' && uploadResult && ['Archive', uploadResult.original_filename],
                  type === 'zip_upload' && uploadResult?.framework && ['Framework', uploadResult.framework],
                  type === 'zip_upload' && form.build_command && ['Build Command', form.build_command],
                  type === 'zip_upload' && form.start_command && ['Start Command', form.start_command],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} className="flex items-start gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span className="text-xs text-muted" style={{ minWidth: 120 }}>{label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>

              {error && <Alert type="error" style={{ marginTop: 16 }}>{error}</Alert>}
            </>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            className="btn btn-ghost"
            onClick={() => step === 0 ? navigate('/projects') : setStep(s => s - 1)}
          >
            <ArrowLeft size={14} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 2 ? (
            <button
              className="btn btn-primary"
              disabled={step === 0 ? !canNextStep1 : !canNextStep2()}
              onClick={() => setStep(s => s + 1)}
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={handleCreate}
            >
              {saving ? <><Spinner size="sm" /> Creating…</> : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
