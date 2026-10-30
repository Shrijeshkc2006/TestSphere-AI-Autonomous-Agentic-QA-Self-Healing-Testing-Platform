import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, FileText, ArrowLeft, AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { plansApi } from '../api/client.js';
import { Alert, Spinner, PageHeader } from '../components/ui.jsx';

const ACTION_TYPES = [
  'navigate', 'click', 'fill', 'select', 'check', 'uncheck',
  'assert_text', 'assert_visible', 'assert_url', 'wait', 'screenshot',
];

function StepRow({ step, index, onChange, onDelete }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px',
      marginBottom: 10, background: 'var(--bg)',
    }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)',
          background: 'var(--indigo-50)', padding: '2px 8px', borderRadius: 20
        }}>
          Step {step.order}
        </span>
        <button className="btn-icon" onClick={() => onDelete(index)} title="Remove step"
          style={{ color: 'var(--red-500)', width: 24, height: 24 }}>
          <Trash2 size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="input" value={step.title}
            onChange={e => onChange(index, 'title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Action Type</label>
          <select className="input" value={step.action_type}
            onChange={e => onChange(index, 'action_type', e.target.value)}>
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Selector</label>
          <input className="input font-mono text-xs" placeholder="#id, .class, role=button"
            value={step.selector || ''}
            onChange={e => onChange(index, 'selector', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Value / Assertion</label>
          <input className="input" placeholder="Text to fill or assertion"
            value={step.value || ''}
            onChange={e => onChange(index, 'value', e.target.value)} />
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
    if (!requirements.trim()) { setError('Enter your testing requirements.'); return; }
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
    if (!name.trim()) { setError('Plan name is required.'); return; }
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
    setSteps(prev => [...prev, {
      order: prev.length + 1,
      title: 'New step',
      action_type: 'click',
      selector: '',
      value: '',
    }]);
  };

  const handleSaveEdited = async () => {
    if (!generatedPlan) return;
    setLoading(true);
    setError('');
    try {
      navigate(`/plans/${generatedPlan.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-area">
      <PageHeader
        title="New Test Plan"
        subtitle="Describe what you want to test, or build steps manually"
        back={() => navigate(`/projects/${projectId}`)}
      />
      <div className="page-content" style={{ maxWidth: 740 }}>
        {/* Mode selector */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'ai', icon: Sparkles, label: 'AI-Assisted Generation' },
            { id: 'manual', icon: FileText, label: 'Manual Steps' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 'var(--radius)',
                border: `2px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
                background: mode === m.id ? 'var(--indigo-50)' : 'var(--bg)',
                color: mode === m.id ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: mode === m.id ? 600 : 400,
                fontSize: '0.875rem', transition: 'all var(--transition)',
              }}
            >
              <m.icon size={15} /> {m.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '24px 20px' }}>
          {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

          {/* Plan name */}
          <div className="form-group mb-5">
            <label className="form-label" htmlFor="plan-name">Plan Name {mode === 'manual' && '*'}</label>
            <input id="plan-name" className="input"
              placeholder={mode === 'ai' ? 'AI will suggest a name if left blank' : 'e.g. Login & Registration Flow'}
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* AI Mode */}
          {mode === 'ai' && !generatedPlan && (
            <>
              <div className="form-group mb-5">
                <label className="form-label" htmlFor="requirements">Testing Requirements *</label>
                <p className="text-xs text-muted mb-2">
                  Describe what you want to test in plain English. Be specific about flows, expectations, and any credentials needed.
                </p>
                <textarea
                  id="requirements"
                  className="input"
                  rows={6}
                  placeholder={`Example:\nTest the login flow:\n1. Navigate to the homepage\n2. Click "Sign In"\n3. Fill in email: user@example.com, password: TestPass123\n4. Verify redirect to dashboard\n5. Verify user name appears in the navbar`}
                  style={{ resize: 'vertical', fontFamily: 'var(--font-sans)' }}
                  value={requirements}
                  onChange={e => setRequirements(e.target.value)}
                />
              </div>
              <div style={{ background: 'var(--amber-50)', border: '1px solid var(--amber-100)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 20 }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} color="var(--amber-600)" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--amber-700)' }}>AI Safety Note</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--amber-700)' }}>
                  AI-generated plans avoid destructive operations by default. You will review and approve each step before execution.
                  Sensitive values like passwords are marked and redacted from logs.
                </p>
              </div>
              <button
                className="btn btn-primary"
                disabled={loading || !requirements.trim()}
                onClick={handleGenerate}
              >
                {loading ? <><Spinner size="sm" /> Generating…</> : <><Sparkles size={15} /> Generate Test Plan</>}
              </button>
            </>
          )}

          {/* Generated plan review */}
          {mode === 'ai' && generatedPlan && (
            <>
              <div style={{ background: 'var(--green-50)', border: '1px solid var(--green-100)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--green-600)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--green-700)' }}>
                    Plan generated: {generatedPlan.steps.length} steps
                  </div>
                  {generatedPlan.ai_assumptions?.length > 0 && (
                    <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                      {generatedPlan.ai_assumptions.map((a, i) => (
                        <li key={i} className="text-xs" style={{ color: 'var(--green-700)' }}>Assumption: {a}</li>
                      ))}
                    </ul>
                  )}
                  {generatedPlan.ai_warnings?.length > 0 && (
                    <ul style={{ paddingLeft: 16 }}>
                      {generatedPlan.ai_warnings.map((w, i) => (
                        <li key={i} className="text-xs" style={{ color: 'var(--amber-600)' }}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>Review &amp; Edit Steps</h3>
              {steps.map((step, idx) => (
                <StepRow
                  key={step.id || idx}
                  step={step}
                  index={idx}
                  onChange={handleStepChange}
                  onDelete={handleDeleteStep}
                />
              ))}
              <button className="btn btn-ghost btn-sm mb-4" onClick={handleAddStep}>
                <Plus size={13} /> Add Step
              </button>

              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={handleSaveEdited} disabled={loading}>
                  {loading ? <Spinner size="sm" /> : <>Review Plan</>}
                </button>
                <button className="btn btn-ghost" onClick={() => { setGeneratedPlan(null); setSteps([]); }}>
                  Regenerate
                </button>
              </div>
            </>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <>
              <div className="form-group mb-5">
                <label className="form-label" htmlFor="req-manual">Requirements / Notes</label>
                <textarea id="req-manual" className="input" rows={3}
                  placeholder="Optional description of what this plan covers"
                  style={{ resize: 'vertical' }}
                  value={requirements} onChange={e => setRequirements(e.target.value)} />
              </div>

              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12 }}>Steps</h3>
              {steps.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No steps yet. Click "Add Step" to start.
                </div>
              )}
              {steps.map((step, idx) => (
                <StepRow
                  key={idx}
                  step={step}
                  index={idx}
                  onChange={handleStepChange}
                  onDelete={handleDeleteStep}
                />
              ))}
              <button className="btn btn-ghost btn-sm mb-6" onClick={handleAddStep}>
                <Plus size={13} /> Add Step
              </button>

              <button
                className="btn btn-primary"
                disabled={loading || !name.trim() || steps.length === 0}
                onClick={handleCreateManual}
              >
                {loading ? <Spinner size="sm" /> : 'Create Test Plan'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
