import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Play, Pencil, Save, X, AlertTriangle, ChevronDown, ChevronUp,
  Code2, Copy, Check
} from 'lucide-react';
import { plansApi, runsApi } from '../api/client.js';
import { Badge, Spinner, Alert, PageHeader, SkeletonCard } from '../components/ui.jsx';

const ACTION_ICONS = {
  navigate: '→',
  click: '↓',
  fill: '✎',
  select: '▾',
  assert_text: '=',
  assert_visible: '◎',
  assert_url: '⊡',
  wait: '⏳',
  screenshot: '📸',
};

function StepCard({ step, editMode, onChange }) {
  const [expanded, setExpanded] = useState(false);

  if (editMode) {
    return (
      <div
        style={{
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: 8,
          background: 'var(--bg-elevated)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-bg)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-border)',
              fontWeight: 600,
              fontSize: '0.6875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {step.order}
          </span>
          <input
            className="input flex-1"
            style={{ height: 30 }}
            value={step.title}
            onChange={e => onChange({ ...step, title: e.target.value })}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Selector</label>
            <input
              className="input font-mono text-xs"
              value={step.selector || ''}
              onChange={e => onChange({ ...step, selector: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Expected Value / Input</label>
            <input
              className="input font-mono text-xs"
              value={step.value || ''}
              onChange={e => onChange({ ...step, value: e.target.value })}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius)',
        marginBottom: 6,
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.6875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {step.order}
        </span>
        <span
          style={{
            width: 24,
            height: 20,
            background: 'var(--bg-elevated)',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.6875rem',
            color: 'var(--text-secondary)',
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {ACTION_ICONS[step.action_type] || step.action_type[0]?.toUpperCase()}
        </span>
        <span style={{ fontWeight: 500, fontSize: '0.8125rem', flex: 1, color: 'var(--text-primary)' }}>
          {step.title}
        </span>
        <code style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {step.action_type}
        </code>
        {expanded ? (
          <ChevronUp size={13} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {expanded && (
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {step.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="text-xs text-muted mb-1">Description</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{step.description}</p>
              </div>
            )}
            {step.selector && (
              <div>
                <div className="text-xs text-muted mb-1">DOM Selector</div>
                <code style={{ fontSize: '0.75rem', display: 'block', wordBreak: 'break-all' }}>
                  {step.selector}
                </code>
              </div>
            )}
            {step.value && (
              <div>
                <div className="text-xs text-muted mb-1">Target Value</div>
                <code style={{ fontSize: '0.75rem', display: 'block' }}>
                  {step.is_sensitive ? '••••••••' : step.value}
                </code>
              </div>
            )}
            {step.assertion && (
              <div>
                <div className="text-xs text-muted mb-1">Assertion Rule</div>
                <code style={{ fontSize: '0.75rem', display: 'block' }}>
                  {step.assertion}
                </code>
              </div>
            )}
            <div>
              <div className="text-xs text-muted mb-1">Timeout</div>
              <span className="font-mono text-xs text-secondary">{step.timeout_ms || 30000}ms</span>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Max Retries</div>
              <span className="font-mono text-xs text-secondary">{step.retry_count ?? 2}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await plansApi.get(planId);
      setPlan(p);
      setSteps((p.steps || []).map(s => ({ ...s })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const updated = await plansApi.approve(planId);
      setPlan(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  const handleSaveSteps = async () => {
    setSaving(true);
    try {
      for (const step of steps) {
        if (step.id) {
          await plansApi.updateStep(planId, step.id, {
            order: step.order,
            title: step.title,
            action_type: step.action_type,
            selector: step.selector,
            value: step.value,
            assertion: step.assertion,
            timeout_ms: step.timeout_ms,
            retry_count: step.retry_count,
            is_sensitive: step.is_sensitive,
          });
        }
      }
      await load();
      setEditMode(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const result = await plansApi.generateCode(planId);
      setGeneratedCode(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode?.content) return;
    navigator.clipboard.writeText(generatedCode.content);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const run = await runsApi.create({ project_id: plan.project_id, test_plan_id: planId });
      navigate(`/runs/${run.id}`);
    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="main-area">
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const isApproved = plan?.status === 'approved';

  return (
    <div className="main-area">
      <PageHeader
        title={plan?.name || 'Test Plan'}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge status={plan?.status} />
            <span className="text-muted">·</span>
            <span className="text-xs text-muted font-mono">{plan?.steps?.length || 0} steps</span>
            <span className="text-muted">·</span>
            <span className="text-xs text-muted font-mono">v{plan?.version}</span>
          </span>
        }
        back={() => navigate(`/projects/${plan?.project_id}`)}
        actions={
          <div className="flex items-center gap-2">
            {!editMode ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>
                  <Pencil size={12} /> Edit Steps
                </button>
                {!isApproved && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={handleApprove}
                    disabled={approving}
                  >
                    {approving ? <Spinner size="sm" /> : <><CheckCircle2 size={13} /> Approve Plan</>}
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleGenerateCode}
                  disabled={generating}
                >
                  {generating ? <Spinner size="sm" /> : <><Code2 size={12} /> Generate Code</>}
                </button>
                {isApproved && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleRun}
                    disabled={running}
                  >
                    {running ? <Spinner size="sm" /> : <><Play size={12} /> Run Tests</>}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditMode(false);
                    setSteps((plan?.steps || []).map(s => ({ ...s })));
                  }}
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveSteps}
                  disabled={saving}
                >
                  {saving ? <Spinner size="sm" /> : <><Save size={12} /> Save</>}
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="page-content" style={{ maxWidth: 980 }}>
        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        {/* Readiness Notification Banner */}
        {!isApproved && (
          <div
            style={{
              background: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--warning)' }}>
                  Plan Pending Approval
                </div>
                <div className="text-xs text-muted">
                  Review the test steps below. Click "Approve Plan" to unlock automated execution.
                </div>
              </div>
            </div>
            <button
              className="btn btn-sm btn-success"
              onClick={handleApprove}
              disabled={approving}
              style={{ flexShrink: 0 }}
            >
              {approving ? <Spinner size="sm" /> : <><CheckCircle2 size={12} /> Approve Now</>}
            </button>
          </div>
        )}

        {/* Requirements Card */}
        {plan?.requirements && (
          <div className="card mb-4" style={{ padding: '14px 18px' }}>
            <div className="text-xs text-muted mb-1 font-mono" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              REQUIREMENTS SPECIFICATION
            </div>
            <p style={{ fontSize: '0.8125rem', whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>
              {plan.requirements}
            </p>
          </div>
        )}

        {/* Steps Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>
            Sequential Verification Steps ({steps.length})
          </h2>
          <span className="text-xs text-muted">
            {editMode ? 'Editing mode active' : 'Click any step to inspect details'}
          </span>
        </div>

        {/* Steps List */}
        {steps.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              border: '1px dashed var(--border-primary)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
            }}
          >
            No steps defined in this plan.
          </div>
        ) : (
          steps.map((step, idx) => (
            <StepCard
              key={step.id || idx}
              step={step}
              editMode={editMode}
              onChange={updated => setSteps(prev => prev.map((s, i) => i === idx ? updated : s))}
            />
          ))
        )}

        {/* Generated Playwright Code Preview */}
        {generatedCode && (
          <div style={{ marginTop: 24 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code2 size={15} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {generatedCode.filename}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary btn-sm" onClick={handleCopyCode}>
                  {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const blob = new Blob([generatedCode.content], { type: 'text/javascript' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = generatedCode.filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download .spec.js
                </button>
              </div>
            </div>
            <pre className="code-block" style={{ maxHeight: 380 }}>
              {generatedCode.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
