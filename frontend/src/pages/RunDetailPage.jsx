import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Clock, Loader2, SkipForward, Zap,
  ChevronDown, ChevronUp, Terminal, Image, Video, FileText,
  AlertCircle, Download, X, RefreshCw,
} from 'lucide-react';
import { runsApi, artifactsApi, connectRunSocket } from '../api/client.js';
import { Badge, Spinner, Alert, PageHeader, ProgressBar } from '../components/ui.jsx';

const STATUS_ICON = {
  pending:  <Clock size={14} color="var(--text-muted)" />,
  running:  <Loader2 size={14} color="var(--indigo-600)" style={{ animation: 'spin 1s linear infinite' }} />,
  passed:   <CheckCircle2 size={14} color="var(--green-600)" />,
  failed:   <XCircle size={14} color="var(--red-600)" />,
  skipped:  <SkipForward size={14} color="var(--text-muted)" />,
  healed:   <Zap size={14} color="var(--amber-600)" />,
};

const FAIL_KIND_LABEL = {
  locator: 'Locator failure',
  assertion: 'Assertion failure',
  network: 'Network error',
  timeout: 'Timeout',
  app_error: 'App error',
  environment: 'Environment',
  ai_generation: 'AI generation error',
};

function msToHuman(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StepResultRow({ step, index }) {
  const [open, setOpen] = useState(step.status === 'failed');

  const bgColor = {
    passed: 'var(--green-50)',
    failed: 'var(--red-50)',
    running: 'var(--indigo-50)',
    healed: 'var(--amber-50)',
  }[step.status] || 'var(--bg)';

  const borderColor = {
    passed: 'var(--green-100)',
    failed: 'var(--red-100)',
    running: 'var(--indigo-100)',
    healed: 'var(--amber-100)',
  }[step.status] || 'var(--border)';

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 'var(--radius)', marginBottom: 6, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', background: bgColor, border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {STATUS_ICON[step.status] || <Clock size={14} />}
        <span style={{ fontWeight: 500, fontSize: '0.8125rem', flex: 1 }}>
          <span className="text-muted text-xs" style={{ marginRight: 6 }}>#{step.order}</span>
          {step.title}
        </span>
        {step.failure_kind && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--red-600)', background: 'var(--red-50)', padding: '1px 6px', borderRadius: 20 }}>
            {FAIL_KIND_LABEL[step.failure_kind] || step.failure_kind}
          </span>
        )}
        {step.heal_attempts?.length > 0 && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--amber-700)', background: 'var(--amber-50)', padding: '1px 6px', borderRadius: 20 }}>
            🔧 {step.heal_attempts.length} heal attempt{step.heal_attempts.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs text-muted">{msToHuman(step.duration_ms)}</span>
        {open ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
      </button>

      {open && (
        <div style={{ padding: '12px', borderTop: `1px solid ${borderColor}`, background: 'var(--bg)' }}>
          {/* Error message */}
          {step.error_message && (
            <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--red-700)', marginBottom: 4 }}>Error</div>
              <code style={{ fontSize: '0.75rem', color: 'var(--red-700)', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {step.error_message}
              </code>
            </div>
          )}

          {/* AI explanation */}
          {step.ai_explanation && (
            <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-100)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--amber-700)', marginBottom: 4 }}>AI Explanation</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--amber-800)' }}>{step.ai_explanation}</p>
            </div>
          )}

          {/* Stack trace */}
          {step.stack_trace && (
            <details style={{ marginBottom: 12 }}>
              <summary className="text-xs text-muted" style={{ cursor: 'pointer', marginBottom: 4 }}>Stack Trace</summary>
              <pre style={{
                background: 'var(--gray-900)', color: '#e2e8f0', borderRadius: 'var(--radius-sm)',
                padding: '10px', fontSize: '0.7rem', overflow: 'auto', maxHeight: 200,
                fontFamily: 'var(--font-mono)',
              }}>
                {step.stack_trace}
              </pre>
            </details>
          )}

          {/* Heal attempts */}
          {step.heal_attempts?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                SELF-HEAL ATTEMPTS
              </div>
              {step.heal_attempts.map((h) => (
                <div key={h.id} style={{
                  display: 'flex', gap: 10, padding: '6px 10px',
                  background: h.validation_passed ? 'var(--green-50)' : 'var(--red-50)',
                  borderRadius: 'var(--radius-sm)', marginBottom: 4, fontSize: '0.75rem',
                }}>
                  {h.validation_passed
                    ? <CheckCircle2 size={12} color="var(--green-600)" style={{ flexShrink: 0, marginTop: 1 }} />
                    : <XCircle size={12} color="var(--red-600)" style={{ flexShrink: 0, marginTop: 1 }} />}
                  <div>
                    <span style={{ fontWeight: 600 }}>{h.strategy}</span>
                    {' · Confidence: '}<strong>{Math.round(h.confidence * 100)}%</strong>
                    <div className="font-mono" style={{ marginTop: 2, color: 'var(--text-muted)' }}>
                      {h.original_selector} → {h.proposed_selector}
                    </div>
                    {h.notes && <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{h.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Screenshots */}
          {step.artifacts?.filter(a => a.kind === 'screenshot').length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>SCREENSHOTS</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {step.artifacts.filter(a => a.kind === 'screenshot').map(art => (
                  <a key={art.id} href={artifactsApi.downloadUrl(art.id)} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem',
                      color: 'var(--accent)', background: 'var(--indigo-50)', padding: '3px 8px',
                      borderRadius: 4, textDecoration: 'none',
                    }}>
                    <Image size={11} /> {art.filename}
                    {art.is_on_failure && <span style={{ color: 'var(--red-500)' }}>⚡</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Console errors */}
          {step.console_errors?.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary className="text-xs text-muted" style={{ cursor: 'pointer' }}>
                Console errors ({step.console_errors.length})
              </summary>
              <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                {step.console_errors.map((e, i) => (
                  <li key={i} className="font-mono text-xs" style={{ color: 'var(--red-600)', marginBottom: 2 }}>{e}</li>
                ))}
              </ul>
            </details>
          )}

          {/* Logs */}
          {step.logs?.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary className="text-xs text-muted" style={{ cursor: 'pointer' }}>
                <Terminal size={11} style={{ display: 'inline', marginRight: 4 }} />
                Logs ({step.logs.length})
              </summary>
              <div style={{
                background: 'var(--gray-900)', borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                marginTop: 4, maxHeight: 160, overflow: 'auto',
              }}>
                {step.logs.map((log, i) => (
                  <div key={i} className="font-mono" style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>
                    {typeof log === 'string' ? log : JSON.stringify(log)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunDetailPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const wsRef = useRef(null);
  const pollRef = useRef(null);

  const fetchRun = useCallback(async () => {
    try {
      const r = await runsApi.get(runId);
      setRun(r);
      return r;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchRun().then(r => {
      if (!r) return;
      // Connect WebSocket for live updates
      const ws = connectRunSocket(runId, (msg) => {
        if (msg.type?.includes('update') || msg.type?.startsWith('run.') || msg.type?.startsWith('step.')) {
          fetchRun();
        }
      }, () => {
        // WS closed — poll every 3s if still running
        if (r?.status === 'running' || r?.status === 'queued') {
          pollRef.current = setInterval(() => {
            fetchRun().then(updated => {
              if (updated?.status !== 'running' && updated?.status !== 'queued') {
                clearInterval(pollRef.current);
              }
            });
          }, 3000);
        }
      });
      wsRef.current = ws;
    });
    return () => {
      wsRef.current?.close();
      clearInterval(pollRef.current);
    };
  }, [runId, fetchRun]);

  // Continue polling for active runs
  useEffect(() => {
    if (run?.status === 'queued' || run?.status === 'running') {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          fetchRun().then(updated => {
            if (updated?.status !== 'running' && updated?.status !== 'queued') {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          });
        }, 2000);
      }
    } else {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [run?.status, fetchRun]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const updated = await runsApi.cancel(runId);
      setRun(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return (
    <div className="main-area">
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 50, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  );

  if (!run && error) return (
    <div className="main-area">
      <div className="page-content"><Alert type="error">{error}</Alert></div>
    </div>
  );

  const total = run?.total_steps || 0;
  const passed = run?.passed_steps || 0;
  const failed = run?.failed_steps || 0;
  const healed = run?.healed_steps || 0;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const isActive = run?.status === 'running' || run?.status === 'queued';

  // Run-level artifacts
  const screenshots = run?.artifacts?.filter(a => a.kind === 'screenshot') || [];
  const videos = run?.artifacts?.filter(a => a.kind === 'video') || [];
  const traces = run?.artifacts?.filter(a => a.kind === 'trace') || [];
  const reports = run?.artifacts?.filter(a => ['report_html', 'report_junit', 'report_json'].includes(a.kind)) || [];

  return (
    <div className="main-area">
      <PageHeader
        title={`Run ${runId.slice(0, 8)}…`}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge status={run?.status} />
            <span className="text-xs text-muted">{run?.browser} · {run?.viewport_width}×{run?.viewport_height}</span>
          </span>
        }
        back={() => navigate(`/projects/${run?.project_id}`)}
        actions={
          <div className="flex gap-2">
            {isActive && (
              <button className="btn btn-sm" style={{ background: 'var(--red-500)', color: '#fff', border: 'none' }}
                onClick={handleCancel} disabled={cancelling}>
                {cancelling ? <Spinner size="sm" /> : <><X size={13} /> Cancel</>}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={fetchRun}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        }
      />

      <div className="page-content">
        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        {/* Status banner for active runs */}
        {isActive && (
          <div style={{
            background: 'var(--indigo-50)', border: '1px solid var(--indigo-100)',
            borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Loader2 size={16} color="var(--accent)" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--accent)' }}>
                {run.status === 'queued' ? 'Queued — waiting for worker…' : 'Running tests…'}
              </div>
              <div className="text-xs text-muted">Live updates via WebSocket · polling every 2s</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="stat-grid mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))' }}>
          <div className="stat-card">
            <span className="stat-card-label">Total Steps</span>
            <span className="stat-card-value">{total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Passed</span>
            <span className="stat-card-value green">{passed}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Failed</span>
            <span className={`stat-card-value ${failed > 0 ? 'red' : 'green'}`}>{failed}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Healed</span>
            <span className="stat-card-value amber">{healed}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Pass Rate</span>
            <span className={`stat-card-value ${passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'}`}>
              {total > 0 ? `${passRate}%` : '—'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Duration</span>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
              {msToHuman(run?.duration_ms)}
            </span>
          </div>
        </div>

        {/* Overall progress bar */}
        {total > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted">Progress</span>
              <span className="text-xs text-muted">{passed + failed}/{total} steps</span>
            </div>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-muted)' }}>
              {passed > 0 && (
                <div style={{ width: `${(passed / total) * 100}%`, background: 'var(--green-500)', transition: 'width 0.5s' }} />
              )}
              {failed > 0 && (
                <div style={{ width: `${(failed / total) * 100}%`, background: 'var(--red-500)', transition: 'width 0.5s' }} />
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {run?.error_message && (
          <Alert type="error" style={{ marginBottom: 16 }}>{run.error_message}</Alert>
        )}

        {/* Step results */}
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 12 }}>
          Step Results {run?.step_results?.length > 0 && `(${run.step_results.length})`}
        </h2>

        {(!run?.step_results || run.step_results.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            {isActive ? 'Waiting for steps to start…' : 'No step results recorded.'}
          </div>
        ) : (
          run.step_results.map((step, idx) => (
            <StepResultRow key={step.id} step={step} index={idx} />
          ))
        )}

        {/* Artifacts */}
        {(screenshots.length > 0 || videos.length > 0 || traces.length > 0 || reports.length > 0) && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 12 }}>Evidence &amp; Artifacts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10 }}>
              {[...screenshots, ...videos, ...traces, ...reports].map(art => {
                const icons = { screenshot: Image, video: Video, trace: FileText, report_html: FileText, report_junit: FileText, report_json: FileText };
                const ArtIcon = icons[art.kind] || FileText;
                return (
                  <a
                    key={art.id}
                    href={artifactsApi.downloadUrl(art.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', textDecoration: 'none',
                      color: 'var(--text)', background: 'var(--bg)',
                      transition: 'background var(--transition)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}
                  >
                    <ArtIcon size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {art.filename}
                      </div>
                      <div className="text-xs text-muted">{art.kind} · {(art.file_size / 1024).toFixed(0)}KB</div>
                    </div>
                    <Download size={13} color="var(--text-muted)" style={{ flexShrink: 0, marginLeft: 'auto' }} />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
