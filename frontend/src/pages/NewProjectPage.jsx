import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Monitor, Upload, CheckCircle2, ArrowRight, ArrowLeft,
  FileArchive, Check
} from 'lucide-react';
import { projectsApi, uploadsApi } from '../api/client.js';
import { Alert, Spinner, ProgressBar, PageHeader } from '../components/ui.jsx';

const STEPS = ['Select Type', 'Configure', 'Confirm'];

const typeCards = [
  {
    id: 'url',
    icon: Globe,
    label: 'Deployed URL',
    description: 'Test a publicly accessible website, web application, or staging environment.',
    example: 'https://staging.example.com',
  },
  {
    id: 'local_url',
    icon: Monitor,
    label: 'Local Dev Server',
    description: 'Test a server running on your machine or inside a Docker container.',
    example: 'http://localhost:3000',
  },
  {
    id: 'zip_upload',
    icon: Upload,
    label: 'ZIP Archive Upload',
    description: 'Upload full project source code. TestSphere detects framework, installs dependencies, and tests.',
    example: 'my-project-source.zip',
  },
];

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
        onClick={() => !file && !uploading && inputRef.current?.click()}
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        style={{
          borderStyle: file ? 'solid' : 'dashed',
          borderColor: file ? 'var(--success-border)' : undefined,
          background: file ? 'var(--success-bg)' : undefined,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={e => onFile(e.target.files[0])}
        />
        {file ? (
          <div>
            <FileArchive size={32} style={{ color: 'var(--success)', margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
              {file.name}
            </div>
            <div className="text-xs text-muted mt-1 font-mono">
              {(file.size / 1024 / 1024).toFixed(2)} MB · Ready
            </div>
          </div>
        ) : (
          <div>
            <Upload size={32} className="drop-zone-icon" />
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Choose a ZIP archive or drag and drop
            </h3>
            <p className="text-xs text-muted mt-1">
              Maximum 100 MB (.zip only). Code will be analyzed in an isolated container.
            </p>
          </div>
        )}
      </div>

      {uploading && (
        <div style={{ marginTop: 12 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-secondary flex items-center gap-1.5">
              <Spinner size="sm" /> Uploading and detecting stack…
            </span>
            <span className="text-xs font-mono text-muted">{progress}%</span>
          </div>
          <ProgressBar value={progress} max={100} color="accent" />
        </div>
      )}

      {uploadError && (
        <Alert type="error" style={{ marginTop: 12 }}>
          {uploadError}
        </Alert>
      )}

      {uploadResult && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--success)' }}>
              Source Verified &amp; Detected
            </div>
            <div className="text-xs text-secondary mt-1">
              Framework: <strong style={{ color: 'var(--text-primary)' }}>{uploadResult.framework || 'Node.js'}</strong>
              {uploadResult.package_manager && (
                <> · Package Manager: <strong style={{ color: 'var(--text-primary)' }}>{uploadResult.package_manager}</strong></>
              )}
            </div>
            {uploadResult.validation_errors?.length > 0 && (
              <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                {uploadResult.validation_errors.map((e, i) => (
                  <li key={i} className="text-xs" style={{ color: 'var(--warning)' }}>{e}</li>
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
    if (!f.name.endsWith('.zip')) {
      setUploadError('Only .zip archives are supported.');
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setUploadError('File exceeds the 100 MB size limit.');
      return;
    }
    setFile(f);
    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadsApi.upload(f, pct => setUploadProgress(pct));
      setUploadResult(result);
      if (result.framework) {
        setForm(prev => ({
          ...prev,
          name: prev.name || f.name.replace('.zip', ''),
          build_command: result.detected_scripts?.build || '',
          start_command: result.detected_scripts?.start || '',
        }));
      }
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
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        project_type: type,
      };
      if (type !== 'zip_upload') {
        payload.target_url = form.target_url.trim();
      } else {
        payload.upload_id = uploadResult.id;
        if (uploadResult.framework) payload.framework = uploadResult.framework;
        if (uploadResult.package_manager) payload.package_manager = uploadResult.package_manager;
        if (form.build_command?.trim()) payload.build_command = form.build_command.trim();
        if (form.start_command?.trim()) payload.start_command = form.start_command.trim();
        if (form.health_check_url?.trim()) payload.health_check_url = form.health_check_url.trim();
        if (form.app_port) payload.app_port = parseInt(form.app_port, 10);
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
        subtitle="Connect an application under test for automated agentic QA"
        back={() => navigate('/projects')}
      />

      <div className="page-content" style={{ maxWidth: 680 }}>
        {/* Step Progression Bar */}
        <div className="flex items-center gap-2 mb-6" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: 16 }}>
          {STEPS.map((label, i) => {
            const isCompleted = i < step;
            const isCurrent = i === step;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono)',
                    background: isCompleted ? 'var(--success-bg)' : isCurrent ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                    border: `1px solid ${isCompleted ? 'var(--success-border)' : isCurrent ? 'var(--accent-border)' : 'var(--border-primary)'}`,
                    color: isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {isCompleted ? <Check size={13} /> : i + 1}
                </div>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: isCurrent ? 600 : 450,
                    color: isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div style={{ width: 28, height: 1, background: 'var(--border-primary)', margin: '0 4px' }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {/* Step 0: Type Selector */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Select Entry Point
                </h2>
                <p className="text-xs text-muted mt-1">
                  Choose how TestSphere accesses your application. Each entry point is isolated and validated before execution.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                {typeCards.map(card => {
                  const Icon = card.icon;
                  const isSelected = type === card.id;
                  return (
                    <button
                      key={card.id}
                      onClick={() => setType(card.id)}
                      style={{
                        background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-primary)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border-primary)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            marginBottom: 2,
                          }}
                        >
                          {card.label}
                        </div>
                        <p className="text-xs text-muted mb-2">
                          {card.description}
                        </p>
                        <code style={{ fontSize: '0.6875rem' }}>{card.example}</code>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Configuration Form */}
          {step === 1 && typeInfo && (
            <div>
              <div
                className="flex items-center gap-2 mb-5"
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <typeInfo.icon size={15} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  Configuring {typeInfo.label}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="proj-name">
                    Project Name *
                  </label>
                  <input
                    id="proj-name"
                    className="input"
                    placeholder="e.g. Production Web App"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="proj-desc">
                    Description
                  </label>
                  <textarea
                    id="proj-desc"
                    className="textarea"
                    rows={2}
                    placeholder="Optional scope or notes for this test target"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                {(type === 'url' || type === 'local_url') && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="proj-url">
                      {type === 'url' ? 'Target URL *' : 'Local Server Address *'}
                    </label>
                    {type === 'local_url' && (
                      <p className="text-xs text-muted mb-1">
                        Must be reachable by the test runner. If running within Docker, use <code>http://host.docker.internal:3000</code>.
                      </p>
                    )}
                    <input
                      id="proj-url"
                      className="input font-mono text-xs"
                      placeholder={type === 'url' ? 'https://example.com' : 'http://localhost:3000'}
                      value={form.target_url}
                      onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))}
                    />
                  </div>
                )}

                {type === 'zip_upload' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Source Code Archive (.zip) *</label>
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
                          <input
                            id="build-cmd"
                            className="input font-mono text-xs"
                            placeholder={uploadResult.detected_scripts?.build || 'npm run build'}
                            value={form.build_command}
                            onChange={e => setForm(f => ({ ...f, build_command: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="start-cmd">Start Command</label>
                          <input
                            id="start-cmd"
                            className="input font-mono text-xs"
                            placeholder={uploadResult.detected_scripts?.start || 'npm start'}
                            value={form.start_command}
                            onChange={e => setForm(f => ({ ...f, start_command: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="health-url">Health Check Path</label>
                          <input
                            id="health-url"
                            className="input font-mono text-xs"
                            placeholder="http://localhost:3000"
                            value={form.health_check_url}
                            onChange={e => setForm(f => ({ ...f, health_check_url: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="app-port">App Port</label>
                          <input
                            id="app-port"
                            type="number"
                            className="input font-mono text-xs"
                            placeholder="3000"
                            value={form.app_port}
                            onChange={e => setForm(f => ({ ...f, app_port: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Confirmation / Review */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Review Configuration
              </h2>
              <p className="text-xs text-muted mb-4">
                Confirm your settings before initializing this project.
              </p>

              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}
              >
                {[
                  ['Project Name', form.name],
                  ['Project Type', typeInfo?.label],
                  ['Description', form.description || '—'],
                  type !== 'zip_upload' && ['Target URL', form.target_url],
                  type === 'zip_upload' && uploadResult && ['Source Archive', uploadResult.original_filename],
                  type === 'zip_upload' && uploadResult?.framework && ['Framework', uploadResult.framework],
                  type === 'zip_upload' && uploadResult?.package_manager && ['Package Manager', uploadResult.package_manager],
                  type === 'zip_upload' && form.build_command && ['Build Command', form.build_command],
                  type === 'zip_upload' && form.start_command && ['Start Command', form.start_command],
                ].filter(Boolean).map(([label, val], idx) => (
                  <div
                    key={label}
                    className="flex items-start gap-4"
                    style={{
                      padding: '10px 14px',
                      borderBottom: idx < 8 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span className="text-xs text-muted" style={{ minWidth: 120 }}>{label}</span>
                    <span className="text-xs font-mono text-primary" style={{ wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>

              {error && (
                <Alert type="error" style={{ marginTop: 16 }}>
                  {error}
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex items-center justify-between mt-5">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => step === 0 ? navigate('/projects') : setStep(s => s - 1)}
          >
            <ArrowLeft size={13} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 2 ? (
            <button
              className="btn btn-primary btn-sm"
              disabled={step === 0 ? !canNextStep1 : !canNextStep2()}
              onClick={() => setStep(s => s + 1)}
            >
              Continue <ArrowRight size={13} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={handleCreate}
            >
              {saving ? <><Spinner size="sm" /> Initializing Project…</> : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
