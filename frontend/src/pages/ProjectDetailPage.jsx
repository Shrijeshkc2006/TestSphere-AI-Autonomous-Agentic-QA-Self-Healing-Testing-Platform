import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Globe, Monitor, Upload, Plus, Play, Clock, CheckCircle2, XCircle,
  ChevronRight, Zap, FileText, History, Settings2, Trash2, AlertCircle, Code2
} from 'lucide-react';
import { projectsApi, plansApi, runsApi } from '../api/client.js';
import { Badge, Spinner, EmptyState, SkeletonCard, PageHeader, Alert, ProgressBar } from '../components/ui.jsx';

const typeIcons = { url: Globe, local_url: Monitor, zip_upload: Upload };
const typeLabels = { url: 'Deployed URL', local_url: 'Local URL', zip_upload: 'ZIP Upload' };

function msToHuman(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function timeAgo(dt) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RunPassBar({ run }) {
  const total = run.total_steps || 1;
  const passedPct = Math.round((run.passed_steps / total) * 100);
  const failedPct = Math.round((run.failed_steps / total) * 100);
  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-muted)', gap: 1 }}>
      {passedPct > 0 && <div style={{ width: `${passedPct}%`, background: 'var(--green-500)', transition: 'width 0.3s' }} />}
      {failedPct > 0 && <div style={{ width: `${failedPct}%`, background: 'var(--red-500)', transition: 'width 0.3s' }} />}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [plans, setPlans] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState('runs'); // 'runs' | 'plans' | 'settings'

  const load = useCallback(async () => {
    try {
      const [proj, planList, runList] = await Promise.all([
        projectsApi.get(id),
        plansApi.listForProject(id),
        runsApi.listForProject(id, 20, 0),
      ]);
      setProject(proj);
      setPlans(planList);
      setRuns(runList);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete project "${project?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await projectsApi.delete(id);
      navigate('/projects');
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  const handleRun = async (planId) => {
    try {
      const run = await runsApi.create({ project_id: id, test_plan_id: planId });
      navigate(`/runs/${run.id}`);
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return (
    <div className="main-area">
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );

  if (error && !project) return (
    <div className="main-area">
      <div className="page-content">
        <Alert type="error">{error}</Alert>
      </div>
    </div>
  );

  const TypeIcon = typeIcons[project?.project_type] || Globe;

  // Stats from runs
  const totalRuns = runs.length;
  const passedRuns = runs.filter(r => r.status === 'passed').length;
  const passRate = totalRuns ? Math.round((passedRuns / totalRuns) * 100) : 0;
  const approvedPlans = plans.filter(p => p.status === 'approved');

  return (
    <div className="main-area">
      <PageHeader
        title={project?.name || '…'}
        subtitle={
          <span className="flex items-center gap-2">
            <TypeIcon size={13} />
            {typeLabels[project?.project_type]}
            {project?.target_url && (
              <a href={project.target_url} target="_blank" rel="noopener noreferrer"
                className="font-mono text-xs" style={{ color: 'var(--accent)' }}>
                {project.target_url}
              </a>
            )}
          </span>
        }
        back={() => navigate('/projects')}
        actions={
          <div className="flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/projects/${id}/plans/new`)}
            >
              <Plus size={13} /> New Test Plan
            </button>
            {approvedPlans.length > 0 && (
              <button
                className="btn btn-sm"
                style={{ background: 'var(--green-500)', color: '#fff', border: 'none' }}
                onClick={() => handleRun(approvedPlans[0].id)}
              >
                <Play size={13} /> Run Tests
              </button>
            )}
          </div>
        }
      />

      {error && <Alert type="error" style={{ margin: '0 24px 16px' }}>{error}</Alert>}

      <div className="page-content">
        {/* Stats row */}
        <div className="stat-grid mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))' }}>
          <div className="stat-card">
            <span className="stat-card-label">Total Runs</span>
            <span className="stat-card-value">{totalRuns}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Pass Rate</span>
            <span className={`stat-card-value ${passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'}`}>{passRate}%</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Test Plans</span>
            <span className="stat-card-value indigo">{plans.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Framework</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{project?.framework || '—'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
          {[
            { id: 'runs', label: 'Test Runs', icon: History },
            { id: 'plans', label: 'Test Plans', icon: FileText },
            { id: 'settings', label: 'Settings', icon: Settings2 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'all var(--transition)',
              }}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Runs tab */}
        {tab === 'runs' && (
          runs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No runs yet"
              description="Create and approve a test plan, then click Run Tests."
              action={
                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/projects/${id}/plans/new`)}>
                  <Plus size={14} /> Create Test Plan
                </button>
              }
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Steps</th>
                    <th>Duration</th>
                    <th>Started</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr key={run.id} className="clickable" onClick={() => navigate(`/runs/${run.id}`)}>
                      <td className="font-mono text-xs">{run.id.slice(0, 8)}…</td>
                      <td><Badge status={run.status} /></td>
                      <td style={{ minWidth: 100 }}><RunPassBar run={run} /></td>
                      <td className="text-xs">
                        <span style={{ color: 'var(--green-600)', fontWeight: 500 }}>{run.passed_steps}↑</span>
                        {' / '}
                        <span style={{ color: 'var(--red-600)', fontWeight: 500 }}>{run.failed_steps}↓</span>
                        {' / '}
                        <span className="text-muted">{run.total_steps}</span>
                      </td>
                      <td className="text-muted text-xs">{msToHuman(run.duration_ms)}</td>
                      <td className="text-muted text-xs">{timeAgo(run.started_at || run.created_at)}</td>
                      <td><ChevronRight size={14} color="var(--text-muted)" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Plans tab */}
        {tab === 'plans' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-muted">{plans.length} test plan{plans.length !== 1 ? 's' : ''}</span>
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/projects/${id}/plans/new`)}>
                <Plus size={13} /> New Plan
              </button>
            </div>
            {plans.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No test plans"
                description="Generate a test plan from your natural-language requirements."
                action={
                  <button className="btn btn-primary btn-sm" onClick={() => navigate(`/projects/${id}/plans/new`)}>
                    <Plus size={14} /> Create Test Plan
                  </button>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plans.map(plan => (
                  <div key={plan.id} className="card" style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/plans/${plan.id}`)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{plan.name}</div>
                        <div className="text-xs text-muted mt-1">
                          {plan.steps.length} steps · v{plan.version} · {timeAgo(plan.updated_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge status={plan.status} />
                        {plan.status === 'approved' && (
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--green-500)', color: '#fff', border: 'none' }}
                            onClick={e => { e.stopPropagation(); handleRun(plan.id); }}
                          >
                            <Play size={12} /> Run
                          </button>
                        )}
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                    {plan.requirements && (
                      <p className="text-xs text-muted mt-2" style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%'
                      }}>
                        {plan.requirements}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Settings tab */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 480 }}>
            <div className="card mb-4">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 16 }}>Project Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['ID', project?.id],
                  ['Name', project?.name],
                  ['Type', typeLabels[project?.project_type]],
                  ['Status', project?.status],
                  ['Created', new Date(project?.created_at).toLocaleString()],
                  project?.target_url && ['Target URL', project.target_url],
                  project?.framework && ['Framework', project.framework],
                  project?.package_manager && ['Package Manager', project.package_manager],
                  project?.build_command && ['Build Command', project.build_command],
                  project?.start_command && ['Start Command', project.start_command],
                ].filter(Boolean).map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: 16 }}>
                    <span className="text-xs text-muted" style={{ minWidth: 130 }}>{label}</span>
                    <span className="text-xs font-mono" style={{ wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ border: '1px solid var(--red-100)' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--red-600)', marginBottom: 8 }}>Danger Zone</h3>
              <p className="text-xs text-muted mb-4">Deleting a project permanently removes all test plans, runs, and artifacts.</p>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--red-500)', color: '#fff', border: 'none' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Spinner size="sm" /> : <><Trash2 size={13} /> Delete Project</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
