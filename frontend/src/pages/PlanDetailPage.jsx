import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Play, Pencil, Save, X, AlertTriangle, ChevronDown, ChevronUp,
  Code2, Clock, Hash, Target, Type, FileText, Zap
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

const STATUS_COLORS = {
  draft: 'var(--text-muted)',
  pending_review: 'var(--amber-600)',
  approved: 'var(--green-600)',
  generating: 'var(--indigo-600)',
};

function StepCard({ step, editMode, onChange }) {
  const [expanded, setExpanded] = useState(false);

  if (editMode) {
    return (
      <div style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        padding: '12px 14px', marginBottom: 8, background: 'var(--bg-subtle)',
      }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{
            minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--indigo-50)',
            color: 'var(--accent)', fontWeight: 700, fontSize: '0.7rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{step.order}</span>
          <input className="input flex-1" style={{ height: 32 }} value={step.title}
            onChange={e => onChange({ ...step, title: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form-group">
            <label className="form-label">Selector</label>
            <input className="input font-mono text-xs" value={step.selector || ''}
              onChange={e => onChange({ ...step, selector: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Value</label>
            <input className="input text-xs" value={step.value || ''}
              onChange={e => onChange({ ...step, value: e.target.value })} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      marginBottom: 8, overflow: 'hidden', background: 'var(--bg)',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--indigo-50)',
          color: 'var(--accent)', fontWeight: 700, fontSize: '0.7rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{step.order}</span>
        <span style={{
          width: 28, height: 20, background: 'var(--bg-muted)', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0,
        }}>
          {ACTION_ICONS[step.action_type] || step.action_type[0].toUpperCase()}
        </span>
        <span style={{ fontWeight: 500, fontSize: '0.875rem', flex: 1 }}>{step.title}</span>
        <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-muted)', padding: '2px 6px', borderRadius: 4 }}>
          {step.action_type}
        </code>
        {expanded ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12 }}>
            {step.description && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="text-xs text-muted mb-1">Description</div>
                <p style={{ fontSize: '0.8125rem' }}>{step.description}</p>
              </div>
            )}
            {step.selector && (
              <div>
                <div className="text-xs text-muted mb-1">Selector</div>
                <code style={{ fontSize: '0.75rem', background: 'var(--bg-muted)', padding: '3px 6px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>
                  {step.selector}
                </code>
              </div>
            )}
            {step.value && (
              <div>
                <div className="text-xs text-muted mb-1">Value</div>
                <code style={{ fontSize: '0.75rem', background: 'var(--bg-muted)', padding: '3px 6px', borderRadius: 4, display: 'block' }}>
                  {step.is_sensitive ? '••••••••' : step.value}
                </code>
              </div>
            )}
            {step.assertion && (
              <div>
                <div className="text-xs text-muted mb-1">Assertion</div>
                <code style={{ fontSize: '0.75rem', background: 'var(--bg-muted)', padding: '3px 6px', borderRadius: 4, display: 'block' }}>
                  {step.assertion}
                </code>
              </div>
            )}
            <div>
              <div className="text-xs text-muted mb-1">Timeout</div>
              <span style={{ fontSize: '0.8125rem' }}>{step.timeout_ms}ms</span>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">Max Retries</div>
              <span style={{ fontSize: '0.8125rem' }}>{step.retry_count}</span>
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
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await plansApi.get(planId);
      setPlan(p);
      setSteps(p.steps.map(s => ({ ...s })));
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
            order: step.order, title: step.title,
            action_type: step.action_type, selector: step.selector,
            value: step.value, assertion: step.assertion,
            timeout_ms: step.timeout_ms, retry_count: step.retry_count, is_sensitive: step.is_sensitive,
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

  if (loading) return (
    <div className="main-area">
      <div className="page-content">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
    </div>
  );

  const canRun = plan?.status === 'approved';

  return (
    <div className="main-area">
      <PageHeader
        title={plan?.name || '…'}
        subtitle={
          <span className="flex items-center gap-2">
            <span style={{ fontSize: '0.75rem', color: STATUS_COLORS[plan?.status] || 'var(--text-muted)', fontWeight: 500 }}>
              ● {plan?.status?.replace('_', ' ')}
            </span>
            <span className="text-muted">·</span>
            <span className="text-xs text-muted">{plan?.steps?.length} steps · v{plan?.version}</span>
          </span>
        }
        back={() => navigate(`/projects/${plan?.project_id}`)}
        actions={
          <div className="flex gap-2">
            {!editMode ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(true)}>
                  <Pencil size={13} /> Edit Steps
                </button>
                {plan?.status !== 'approved' && (
                  <button className="btn btn-sm" style={{ background: 'var(--green-500)', color: '#fff', border: 'none' }}
                    onClick={handleApprove} disabled={approving}>
                    {approving ? <Spinner size="sm" /> : <><CheckCircle2 size={13} /> Approve</>}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={handleGenerateCode} disabled={generating}>
                  {generating ? <Spinner size="sm" /> : <><Code2 size={13} /> Generate Code</>}
                </button>
                {canRun && (
                  <button className="btn btn-primary btn-sm" onClick={handleRun} disabled={running}>
                    {running ? <Spinner size="sm" /> : <><Play size={13} /> Run Tests</>}
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditMode(false); setSteps(plan.steps.map(s => ({ ...s }))); }}>
                  <X size={13} /> Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveSteps} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : <><Save size={13} /> Save</>}
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="page-content">
        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        {plan?.ai_assumptions?.length > 0 && (
          <div style={{ background: 'var(--blue-50)', border: '1px solid #bfdbfe', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1d4ed8', marginBottom: 6 }}>AI Assumptions</div>
            <ul style={{ paddingLeft: 16 }}>
              {plan.ai_assumptions.map((a, i) => (
                <li key={i} className="text-xs" style={{ color: '#1d4ed8', marginBottom: 2 }}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {plan?.ai_warnings?.length > 0 && (
          <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-100)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16 }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} color="var(--amber-600)" />
              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--amber-700)' }}>Warnings</span>
            </div>
            <ul style={{ paddingLeft: 16 }}>
              {plan.ai_warnings.map((w, i) => (
                <li key={i} className="text-xs" style={{ color: 'var(--amber-700)', marginBottom: 2 }}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {plan?.requirements && (
          <div className="card mb-4" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>REQUIREMENTS</div>
            <p style={{ fontSize: '0.875rem', whiteSpace: 'pre-line' }}>{plan.requirements}</p>
          </div>
        )}

        {/* Steps */}
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
            Steps ({steps.length})
          </h2>
          {!canRun && plan?.status !== 'approved' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--amber-600)', background: 'var(--amber-50)', padding: '4px 10px', borderRadius: 20 }}>
              Approve this plan to enable test runs
            </div>
          )}
        </div>

        {steps.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No steps in this plan yet.
          </div>
        )}

        {steps.map((step, idx) => (
          <StepCard
            key={step.id || idx}
            step={step}
            editMode={editMode}
            onChange={updated => setSteps(prev => prev.map((s, i) => i === idx ? updated : s))}
          />
        ))}

        {/* Generated code */}
        {generatedCode && (
          <div style={{ marginTop: 24 }}>
            <div className="flex items-center justify-between mb-2">
              <h3 style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                <Code2 size={15} style={{ display: 'inline', marginRight: 6 }} />
                Generated: {generatedCode.filename}
              </h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const blob = new Blob([generatedCode.content], { type: 'text/javascript' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = generatedCode.filename; a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download
              </button>
            </div>
            <pre style={{
              background: 'var(--gray-900)', color: '#e2e8f0', borderRadius: 'var(--radius-lg)',
              padding: '16px 20px', fontSize: '0.75rem', overflow: 'auto', maxHeight: 400,
              fontFamily: 'var(--font-mono)', lineHeight: 1.6,
            }}>
              {generatedCode.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
