import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Globe, Monitor, Upload, Plus, Play,
  ChevronRight, History, Settings2, Trash2, FileText, ExternalLink
} from 'lucide-react';
import { projectsApi, plansApi, runsApi } from '../api/client.js';
import { Badge, Spinner, EmptyState, SkeletonCard, PageHeader, Alert, StatCard } from '../components/ui.jsx';

const TYPE_ICONS = { url: Globe, local_url: Monitor, zip_upload: Upload };
const TYPE_LABELS = { url: 'Deployed URL', local_url: 'Local Dev Server', zip_upload: 'ZIP Archive' };

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
  const passedPct = Math.round(((run.passed_steps || 0) / total) * 100);
  const failedPct = Math.round(((run.failed_steps || 0) / total) * 100);
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--bg-elevated)', gap: 1, minWidth: 60 }}>
      {passedPct > 0 && <div style={{ width: `${passedPct}%`, background: 'var(--success)' }} />}
      {failedPct > 0 && <div style={{ width: `${failedPct}%`, background: 'var(--failure)' }} />}
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
    if (!window.confirm(`Permanently delete project "${project?.name}"? All test plans and run records will be deleted.`)) return;
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

  if (loading) {
    return (
      <div className="main-area">
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="stat-grid">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="main-area">
        <div className="page-content">
          <Alert type="error">{error}</Alert>
        </div>
      </div>
    );
  }

  const TypeIcon = TYPE_ICONS[project?.project_type] || Globe;
  const approvedPlans = plans.filter(p => p.status === 'approved');
  const totalRuns = runs.length;
  const passedRuns = runs.filter(r => r.status === 'passed').length;
  const passRate = totalRuns ? Math.round((passedRuns / totalRuns) * 100) : 0;

  return (
    <div className="main-area">
      <PageHeader
        title={project?.name || 'Project'}
        subtitle={
          <span className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5"
              style={{
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-elevated)',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <TypeIcon size={12} style={{ color: 'var(--accent)' }} />
              {TYPE_LABELS[project?.project_type]}
            </span>
            {project?.target_url && (
              <a
                href={project.target_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs flex items-center gap-1"
                style={{ color: 'var(--accent)' }}
              >
                {project.target_url}
                <ExternalLink size={10} />
              </a>
            )}
          </span>
        }
        back={() => navigate('/projects')}
        actions={
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/projects/${id}/plans/new`)}
            >
              <Plus size={13} /> New Plan
            </button>
            {approvedPlans.length > 0 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleRun(approvedPlans[0].id)}
              >
                <Play size={12} /> Run Tests
              </button>
            )}
          </div>
        }
      />

      <div className="page-content">
        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        {/* Stats Strip */}
        <div className="stat-grid mb-6">
          <StatCard
            label="Total Runs"
            value={totalRuns}
            subtext="Recorded executions"
          />
          <StatCard
            label="Pass Rate"
            value={totalRuns ? `${passRate}%` : '—'}
            subtext={totalRuns ? `${passedRuns} passed` : 'No runs recorded'}
            color={totalRuns ? (passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red') : ''}
          />
          <StatCard
            label="Test Plans"
            value={plans.length}
            subtext={`${approvedPlans.length} approved for run`}
            color="indigo"
          />
          <StatCard
            label="Framework"
            value={project?.framework || 'Custom'}
            subtext={project?.package_manager ? `PM: ${project.package_manager}` : 'Runtime environment'}
          />
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="tabs">
          {[
            { id: 'runs', label: `Test Runs (${runs.length})`, icon: History },
            { id: 'plans', label: `Test Plans (${plans.length})`, icon: FileText },
            { id: 'settings', label: 'Configuration & Danger Zone', icon: Settings2 },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`tab-item ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Runs Table */}
        {tab === 'runs' && (
          runs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No automated test runs yet"
              description="Create a test plan, approve the steps, and launch a test execution."
              action={
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/projects/${id}/plans/new`)}
                >
                  <Plus size={13} /> Create Test Plan
                </button>
              }
            />
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th>Step Distribution</th>
                    <th>Steps</th>
                    <th>Duration</th>
                    <th>Executed</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr
                      key={run.id}
                      className="clickable"
                      onClick={() => navigate(`/runs/${run.id}`)}
                    >
                      <td>
                        <span className="font-mono text-xs" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {run.id.slice(0, 8)}…
                        </span>
                      </td>
                      <td>
                        <Badge status={run.status} />
                      </td>
                      <td style={{ minWidth: 80 }}>
                        <RunPassBar run={run} />
                      </td>
                      <td className="font-mono text-xs">
                        <span style={{ color: 'var(--success)', fontWeight: 500 }}>{run.passed_steps || 0}</span>
                        {' / '}
                        <span style={{ color: run.failed_steps > 0 ? 'var(--failure)' : 'var(--text-muted)' }}>
                          {run.failed_steps || 0}
                        </span>
                        {' / '}
                        <span className="text-muted">{run.total_steps || 0}</span>
                      </td>
                      <td className="font-mono text-xs text-muted">
                        {msToHuman(run.duration_ms)}
                      </td>
                      <td className="text-xs text-muted">
                        {timeAgo(run.started_at || run.created_at)}
                      </td>
                      <td>
                        <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Tab 2: Test Plans List */}
        {tab === 'plans' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs text-muted">
                {plans.length} plan{plans.length !== 1 ? 's' : ''} configured
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/projects/${id}/plans/new`)}
              >
                <Plus size={13} /> New Plan
              </button>
            </div>

            {plans.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No test plans defined"
                description="Generate a structured test plan from plain-language requirements or compose steps manually."
                action={
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/projects/${id}/plans/new`)}
                  >
                    <Plus size={13} /> Create Test Plan
                  </button>
                }
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    className="card"
                    style={{ cursor: 'pointer', padding: '16px' }}
                    onClick={() => navigate(`/plans/${plan.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {plan.name}
                        </div>
                        <div className="text-xs text-muted mt-1">
                          {plan.steps?.length || 0} steps · Version {plan.version} · Updated {timeAgo(plan.updated_at || plan.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge status={plan.status} />
                        {plan.status === 'approved' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRun(plan.id);
                            }}
                          >
                            <Play size={11} /> Run
                          </button>
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>

                    {plan.requirements && (
                      <p
                        className="text-xs text-muted mt-2 truncate"
                        style={{ maxWidth: '85%' }}
                      >
                        {plan.requirements}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab 3: Configuration & Danger Zone */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 600 }}>
            <div className="card mb-4" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
                Project Metadata
              </h3>
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}
              >
                {[
                  ['Project ID', project?.id],
                  ['Name', project?.name],
                  ['Type', TYPE_LABELS[project?.project_type]],
                  ['Status', project?.status],
                  ['Created', new Date(project?.created_at).toLocaleString()],
                  project?.target_url && ['Target URL', project.target_url],
                  project?.framework && ['Framework', project.framework],
                  project?.package_manager && ['Package Manager', project.package_manager],
                  project?.build_command && ['Build Command', project.build_command],
                  project?.start_command && ['Start Command', project.start_command],
                ].filter(Boolean).map(([label, val], idx) => (
                  <div
                    key={label}
                    className="flex items-start gap-4"
                    style={{
                      padding: '9px 12px',
                      borderBottom: idx < 9 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span className="text-xs text-muted" style={{ minWidth: 120 }}>{label}</span>
                    <span className="text-xs font-mono text-primary" style={{ wordBreak: 'break-all' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="card"
              style={{
                border: '1px solid var(--failure-border)',
                background: 'var(--failure-bg)',
                padding: '18px 20px',
              }}
            >
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--failure)', marginBottom: 4 }}>
                Danger Zone
              </h3>
              <p className="text-xs text-muted mb-4">
                Deleting this project permanently removes all test plans, execution runs, screenshots, and artifacts.
              </p>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Spinner size="sm" /> : <><Trash2 size={13} /> Delete Project Permanently</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
