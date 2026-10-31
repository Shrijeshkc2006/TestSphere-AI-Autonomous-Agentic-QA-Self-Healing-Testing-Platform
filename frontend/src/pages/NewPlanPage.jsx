import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Sparkles, FileText, AlertTriangle, CheckCircle2,
  Plus, Trash2, ArrowRight
} from 'lucide-react';
import { plansApi } from '../api/client.js';
import { Alert, Spinner, PageHeader } from '../components/ui.jsx';

const ACTION_TYPES = [
  'navigate', 'click', 'fill', 'select', 'check', 'uncheck',
  'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot',
];

function StepRow({ step, index, onChange, onDelete }) {
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
      <div className="flex items-center justify-between mb-2">
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--accent)',
            background: 'var(--accent-bg)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--accent-border)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Step {step.order}
        </span>
        <button
          className="btn-icon"
          onClick={() => onDelete(index)}
          title="Remove step"
          style={{ color: 'var(--failure)', width: 22, height: 22 }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">Step Title</label>
          <input
            className="input"
            value={step.title}
            onChange={e => onChange(index, 'title', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Action Type</label>
          <select
            className="select"
            value={step.action_type}
            onChange={e => onChange(index, 'action_type', e.target.value)}
          >
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Selector</label>
          <input
            className="input font-mono text-xs"
            placeholder="#id, [data-testid], button:has-text('Submit')"
            value={step.selector || ''}
            onChange={e => onChange(index, 'selector', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Value / Expected Assertion</label>
          <input
            className="input font-mono text-xs"
            placeholder="Text to fill or expected assertion value"
            value={step.value || ''}
            onChange={e => onChange(index, 'value', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewPlanPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState('ai'); // 'ai' | 'manual'
  const [name, setName] = useState('');
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [steps, setSteps] = useState([]);

  const handleGenerate = async () => {
    if (!requirements.trim()) {
      setError('Please provide natural language testing requirements.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const plan = await plansApi.generate({
        project_id: projectId,
        requirements,
        name: name || undefined,
      });
      setGeneratedPlan(plan);
      setSteps(plan.steps.map(s => ({ ...s })));
      setName(plan.name);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManual = async () => {
    if (!name.trim()) {
      setError('Plan name is required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const plan = await plansApi.create({
        project_id: projectId,
        name,
        requirements: requirements || undefined,
        steps: steps.map(s => ({
          order: s.order,
          title: s.title,
          action_type: s.action_type,
          selector: s.selector,
          value: s.value,
          timeout_ms: 30000,
          retry_count: 2,
          is_sensitive: false,
        })),
      });
      navigate(`/plans/${plan.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepChange = (idx, field, value) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleDeleteStep = (idx) => {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      {
        order: prev.length + 1,
        title: 'New test step',
        action_type: 'click',
        selector: '',
        value: '',
      },
    ]);
  };

  return (
    <div className="main-area">
      <PageHeader
        title="New Test Plan"
        subtitle="AI-synthesized or manually orchestrated Playwright verification workflow"
        back={() => navigate(`/projects/${projectId}`)}
      />

      <div className="page-content" style={{ maxWidth: 740 }}>
        {/* Generation Mode Selector */}
        <div className="flex gap-2 mb-5">
          {[
            { id: 'ai', icon: Sparkles, label: 'AI Synthesis' },
            { id: 'manual', icon: FileText, label: 'Manual Definition' },
          ].map(m => {
            const Icon = m.icon;
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Icon size={14} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="card" style={{ padding: '24px' }}>
          {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

          {/* Plan Name */}
          <div className="form-group mb-5">
            <label className="form-label" htmlFor="plan-name">
              Plan Title {mode === 'manual' && '*'}
            </label>
            <input
              id="plan-name"
              className="input"
              placeholder={mode === 'ai' ? 'Leave blank to let AI suggest a concise name' : 'e.g. User Authentication Flow'}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* AI Mode */}
          {mode === 'ai' && !generatedPlan && (
            <>
              <div className="form-group mb-4">
                <label className="form-label" htmlFor="requirements">
                  Testing Requirements *
                </label>
                <p className="text-xs text-muted mb-2">
                  Describe what you want to test in clear English. Mention targets, inputs, expectations, and error cases.
                </p>
                <textarea
                  id="requirements"
                  className="textarea font-mono"
                  rows={6}
                  placeholder={`1. Navigate to /login\n2. Fill email with test@example.com and password with Secret123\n3. Click "Sign In"\n4. Assert URL redirects to /dashboard\n5. Verify navbar displays user avatar and profile name`}
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                />
              </div>

              <div
                style={{
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--warning)' }}>
                    Safety &amp; Review Policy
                  </div>
                  <p className="text-xs text-muted mt-1" style={{ color: '#D4AF37' }}>
                    AI-generated plans cannot execute destructive actions without explicit user approval. Every generated step must be reviewed and approved before running.
                  </p>
                </div>
              </div>

              <button
                className="btn btn-primary"
                disabled={loading || !requirements.trim()}
                onClick={handleGenerate}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    <span>Synthesizing Test Plan…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Generate Test Plan</span>
                  </>
                )}
              </button>
            </>
          )}

          {/* AI Generated Plan Review */}
          {mode === 'ai' && generatedPlan && (
            <div>
              <div
                style={{
                  background: 'var(--success-bg)',
                  border: '1px solid var(--success-border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px 14px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--success)' }}>
                    Synthesized {generatedPlan.steps?.length || 0} Test Steps
                  </div>
                  {generatedPlan.ai_assumptions?.length > 0 && (
                    <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                      {generatedPlan.ai_assumptions.map((a, i) => (
                        <li key={i} className="text-xs text-muted">Assumption: {a}</li>
                      ))}
                    </ul>
                  )}
                  {generatedPlan.ai_warnings?.length > 0 && (
                    <ul style={{ marginTop: 4, paddingLeft: 16 }}>
                      {generatedPlan.ai_warnings.map((w, i) => (
                        <li key={i} className="text-xs" style={{ color: 'var(--warning)' }}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 10 }}>
                Synthesized Steps ({steps.length})
              </h3>

              <div style={{ marginBottom: 16 }}>
                {steps.map((step, idx) => (
                  <StepRow
                    key={idx}
                    step={step}
                    index={idx}
                    onChange={handleStepChange}
                    onDelete={handleDeleteStep}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button className="btn btn-secondary btn-sm" onClick={handleAddStep}>
                  <Plus size={13} /> Add Step
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/plans/${generatedPlan.id}`)}
                >
                  Inspect &amp; Approve Plan <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Manual Step Builder */}
          {mode === 'manual' && (
            <div>
              <div className="form-group mb-4">
                <label className="form-label" htmlFor="manual-req">
                  Description / Goal
                </label>
                <textarea
                  id="manual-req"
                  className="textarea"
                  rows={2}
                  placeholder="Optional context for this test plan"
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Test Steps ({steps.length})</h3>
                <button className="btn btn-secondary btn-sm" onClick={handleAddStep}>
                  <Plus size={13} /> Add Step
                </button>
              </div>

              {steps.length === 0 ? (
                <div
                  style={{
                    padding: '24px',
                    textAlign: 'center',
                    border: '1px dashed var(--border-primary)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-muted)',
                    fontSize: '0.8125rem',
                    marginBottom: 16,
                  }}
                >
                  Click "Add Step" to define ordered actions and assertions.
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {steps.map((step, idx) => (
                    <StepRow
                      key={idx}
                      step={step}
                      index={idx}
                      onChange={handleStepChange}
                      onDelete={handleDeleteStep}
                    />
                  ))}
                </div>
              )}

              <button
                className="btn btn-primary"
                disabled={loading || !name.trim() || steps.length === 0}
                onClick={handleCreateManual}
              >
                {loading ? <Spinner size="sm" /> : 'Create Test Plan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
