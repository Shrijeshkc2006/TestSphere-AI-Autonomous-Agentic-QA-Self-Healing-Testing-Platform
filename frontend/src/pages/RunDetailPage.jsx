import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Clock, Loader2, SkipForward, Zap,
  ChevronDown, ChevronUp, Image, Video, FileText, Download, X, RefreshCw
} from 'lucide-react';
import { runsApi, artifactsApi, connectRunSocket } from '../api/client.js';
import { Badge, Spinner, Alert, PageHeader, StatCard } from '../components/ui.jsx';

const STATUS_ICONS = {
  pending:  <Clock size={13} style={{ color: 'var(--text-muted)' }} />,
  queued:   <Clock size={13} style={{ color: 'var(--warning)' }} />,
  running:  <Loader2 size={13} style={{ color: 'var(--info)', animation: 'spin 1s linear infinite' }} />,
  passed:   <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />,
  failed:   <XCircle size={13} style={{ color: 'var(--failure)' }} />,
  skipped:  <SkipForward size={13} style={{ color: 'var(--text-muted)' }} />,
  healed:   <Zap size={13} style={{ color: 'var(--healed)' }} />,
  cancelled: <X size={13} style={{ color: 'var(--text-muted)' }} />,
};

const FAIL_KIND_LABELS = {
  locator: 'Locator failure',
  assertion: 'Assertion failure',
  network: 'Network error',
  timeout: 'Timeout reached',
  app_error: 'Application exception',
  environment: 'Environment failure',
  ai_generation: 'AI generation error',
};

function msToHuman(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function StepResultRow({ step }) {
  const [open, setOpen] = useState(step.status === 'failed');

  const status = step.status || 'pending';
  const isFailed = status === 'failed';
  const isHealed = status === 'healed';

  return (
    <div
      style={{
        border: `1px solid ${isFailed ? 'var(--failure-border)' : isHealed ? 'var(--healed-border)' : 'var(--border-primary)'}`,
        borderRadius: 'var(--radius)',
        marginBottom: 6,
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: isFailed ? 'var(--failure-bg)' : isHealed ? 'var(--healed-bg)' : 'var(--bg-card)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background var(--transition-fast)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {STATUS_ICONS[status] || <Clock size={13} />}
        </span>

        <span
          className="font-mono text-xs text-muted"
          style={{ width: 22, flexShrink: 0 }}
        >
          #{step.order}
        </span>

        <span style={{ fontWeight: 500, fontSize: '0.8125rem', flex: 1, color: 'var(--text-primary)' }}>
          {step.title}
        </span>

        {step.failure_kind && (
          <span
            className="badge"
            style={{
              background: 'var(--failure-bg)',
              color: 'var(--failure)',
              borderColor: 'var(--failure-border)',
              fontSize: '0.65rem',
            }}
          >
            {FAIL_KIND_LABELS[step.failure_kind] || step.failure_kind}
          </span>
        )}

        {step.heal_attempts?.length > 0 && (
          <span
            className="badge"
            style={{
              background: 'var(--healed-bg)',
              color: 'var(--healed)',
              borderColor: 'var(--healed-border)',
              fontSize: '0.65rem',
            }}
          >
            <Zap size={10} /> {step.heal_attempts.length} healed
          </span>
        )}

        <span className="font-mono text-xs text-muted" style={{ flexShrink: 0 }}>
          {msToHuman(step.duration_ms)}
        </span>

        {open ? (
          <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {open && (
        <div
          style={{
            padding: '14px',
            borderTop: `1px solid ${isFailed ? 'var(--failure-border)' : 'var(--border-subtle)'}`,
            background: 'var(--bg-elevated)',
          }}
        >
          {/* Error Message */}
          {step.error_message && (
            <div
              style={{
                background: 'var(--failure-bg)',
                border: '1px solid var(--failure-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--failure)', marginBottom: 4 }}>
                FAILURE ERROR
              </div>
              <code
                style={{
                  fontSize: '0.75rem',
                  color: '#FFA5A5',
                  display: 'block',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
                {step.error_message}
              </code>
            </div>
          )}

          {/* AI Root-Cause Explanation */}
          {step.ai_explanation && (
            <div
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--warning)', marginBottom: 4 }}>
                AI ROOT CAUSE DIAGNOSIS
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#FCD34D', lineHeight: 1.5 }}>
                {step.ai_explanation}
              </p>
            </div>
          )}

          {/* Self-Heal Attempts */}
          {step.heal_attempts?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                SELF-HEALING LOG
              </div>
              {step.heal_attempts.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 10px',
                    background: h.validation_passed ? 'var(--success-bg)' : 'var(--failure-bg)',
                    border: `1px solid ${h.validation_passed ? 'var(--success-border)' : 'var(--failure-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 4,
                    fontSize: '0.75rem',
                  }}
                >
                  {h.validation_passed ? (
                    <CheckCircle2 size={13} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                  ) : (
                    <XCircle size={13} style={{ color: 'var(--failure)', flexShrink: 0, marginTop: 1 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.strategy}</span>
                      <span className="text-muted font-mono">· Confidence: {Math.round((h.confidence || 0) * 100)}%</span>
                    </div>
                    <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--failure)' }}>{h.original_selector}</span>
                      {' → '}
                      <span style={{ color: 'var(--success)' }}>{h.proposed_selector}</span>
                    </div>
                    {h.notes && (
                      <div className="text-xs text-muted mt-1">{h.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Screenshots Captured for this Step */}
          {step.artifacts?.filter(a => a.kind === 'screenshot').length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                SCREENSHOT EVIDENCE
              </div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {step.artifacts.filter(a => a.kind === 'screenshot').map(art => (
                  <a
                    key={art.id}
                    href={artifactsApi.downloadUrl(art.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <Image size={12} style={{ color: 'var(--accent)' }} />
                    <span>{art.filename}</span>
                    {art.is_on_failure && <span style={{ color: 'var(--failure)' }}>[FAIL]</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Stack Trace */}
          {step.stack_trace && (
            <details style={{ marginTop: 8 }}>
              <summary
                className="font-mono text-xs text-muted"
                style={{ cursor: 'pointer', padding: '4px 0' }}
              >
                View Stack Trace
              </summary>
              <pre className="code-block" style={{ maxHeight: 180, marginTop: 4 }}>
                {step.stack_trace}
              </pre>
            </details>
          )}

          {/* Step Execution Logs */}
          {step.logs?.length > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary
                className="font-mono text-xs text-muted"
                style={{ cursor: 'pointer', padding: '4px 0' }}
              >
                Execution Logs ({step.logs.length})
              </summary>
              <div
                style={{
                  background: '#090B0E',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  marginTop: 4,
                  maxHeight: 140,
                  overflow: 'auto',
                }}
              >
                {step.logs.map((log, i) => (
                  <div
                    key={i}
                    className="font-mono"
                    style={{ fontSize: '0.6875rem', color: '#9299A5', marginBottom: 2 }}
                  >
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
      const ws = connectRunSocket(
        runId,
        (msg) => {
          if (msg.type?.includes('update') || msg.type?.startsWith('run.') || msg.type?.startsWith('step.')) {
            fetchRun();
          }
        },
        () => {
          if (r?.status === 'running' || r?.status === 'queued') {
            pollRef.current = setInterval(() => {
              fetchRun().then(updated => {
                if (updated?.status !== 'running' && updated?.status !== 'queued') {
                  clearInterval(pollRef.current);
                }
              });
            }, 3000);
          }
        }
      );
      wsRef.current = ws;
    });

    return () => {
      wsRef.current?.close();
      clearInterval(pollRef.current);
    };
  }, [runId, fetchRun]);

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

  if (loading) {
    return (
      <div className="main-area">
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="stat-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 6 }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!run && error) {
    return (
      <div className="main-area">
        <div className="page-content">
          <Alert type="error">{error}</Alert>
        </div>
      </div>
    );
  }

  const total = run?.total_steps || 0;
  const passed = run?.passed_steps || 0;
  const failed = run?.failed_steps || 0;
  const healed = run?.healed_steps || 0;
  const skipped = total > (passed + failed) ? total - (passed + failed) : 0;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const isActive = run?.status === 'running' || run?.status === 'queued';

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
            <span className="text-muted">·</span>
            <span className="text-xs text-muted font-mono">{run?.browser || 'chromium'}</span>
            <span className="text-muted">·</span>
            <span className="text-xs text-muted font-mono">{run?.viewport_width}×{run?.viewport_height}</span>
          </span>
        }
        back={() => navigate(`/projects/${run?.project_id}`)}
        actions={
          <div className="flex gap-2">
            {isActive && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? <Spinner size="sm" /> : <><X size={12} /> Abort Execution</>}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={fetchRun}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        }
      />

      <div className="page-content">
        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        {/* Live Active Execution Banner */}
        {isActive && (
          <div
            style={{
              background: 'var(--info-bg)',
              border: '1px solid var(--info-border)',
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Loader2 size={16} style={{ color: 'var(--info)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--info)' }}>
                {run?.status === 'queued' ? 'Run Queued — Waiting for Worker Container' : 'Live Playwright Execution in Progress'}
              </div>
              <div className="text-xs text-muted mt-0.5">
                Streaming step status via WebSocket with real-time locator healing
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="stat-grid mb-6">
          <StatCard
            label="Total Steps"
            value={total}
            subtext="Target assertions"
          />
          <StatCard
            label="Passed"
            value={passed}
            subtext={total > 0 ? `${passRate}% of plan` : '—'}
            color="green"
          />
          <StatCard
            label="Failed"
            value={failed}
            subtext={failed === 0 ? 'Zero errors' : 'Action failed'}
            color={failed > 0 ? 'red' : 'green'}
          />
          <StatCard
            label="Skipped"
            value={skipped}
            subtext="Bypassed or remaining"
            color=""
          />
          <StatCard
            label="Healed"
            value={healed}
            subtext="Self-healing applied"
            color="amber"
          />
          <StatCard
            label="Pass Rate"
            value={total > 0 ? `${passRate}%` : '—'}
            color={total > 0 ? (passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red') : ''}
          />
          <StatCard
            label="Duration"
            value={msToHuman(run?.duration_ms)}
            subtext={run?.completed_at ? 'Completed' : 'Running'}
          />
        </div>

        {/* Visual Progress Breakdown Bar */}
        {total > 0 && (
          <div className="card mb-6" style={{ padding: '12px 16px' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted">
                EXECUTION PROGRESS: {passed + failed}/{total} STEPS
              </span>
              <span className="text-xs font-mono text-secondary">
                {Math.round(((passed + failed) / total) * 100)}%
              </span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-elevated)', gap: 1 }}>
              {passed > 0 && (
                <div style={{ width: `${(passed / total) * 100}%`, background: 'var(--success)', transition: 'width 0.4s' }} />
              )}
              {failed > 0 && (
                <div style={{ width: `${(failed / total) * 100}%`, background: 'var(--failure)', transition: 'width 0.4s' }} />
              )}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {run?.error_message && (
          <Alert type="error" style={{ marginBottom: 16 }}>
            {run.error_message}
          </Alert>
        )}

        {/* Ordered Step Results Section */}
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            Execution Step Results {run?.step_results?.length > 0 && `(${run.step_results.length})`}
          </h2>
          <span className="text-xs text-muted">
            Ordered sequence of user interactions and assertions
          </span>
        </div>

        {(!run?.step_results || run.step_results.length === 0) ? (
          <div
            style={{
              padding: '36px',
              textAlign: 'center',
              border: '1px dashed var(--border-primary)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            {isActive ? 'Waiting for Playwright worker to dispatch initial step…' : 'No step results recorded.'}
          </div>
        ) : (
          run.step_results.map((step, idx) => (
            <StepResultRow key={step.id || idx} step={step} index={idx} />
          ))
        )}

        {/* Artifacts & Evidence Gallery */}
        {(screenshots.length > 0 || videos.length > 0 || traces.length > 0 || reports.length > 0) && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>
              Execution Artifacts &amp; Test Reports
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {[...screenshots, ...videos, ...traces, ...reports].map(art => {
                const icons = {
                  screenshot: Image,
                  video: Video,
                  trace: FileText,
                  report_html: FileText,
                  report_junit: FileText,
                  report_json: FileText,
                };
                const ArtIcon = icons[art.kind] || FileText;

                return (
                  <a
                    key={art.id}
                    href={artifactsApi.downloadUrl(art.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      textDecoration: 'none',
                    }}
                  >
                    <ArtIcon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        className="truncate"
                        style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}
                      >
                        {art.filename}
                      </div>
                      <div className="font-mono text-xs text-muted" style={{ fontSize: '0.6875rem' }}>
                        {art.kind} · {(art.file_size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <Download size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
