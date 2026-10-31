import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Plus, ChevronRight, Activity, ArrowUpRight,
  Clock, Zap, CheckCircle2, XCircle
} from 'lucide-react';
import { projectsApi } from '../api/client.js';
import { Badge, EmptyState, SkeletonCard, PageHeader, StatCard } from '../components/ui.jsx';

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

function RunProgressMini({ passed, failed, total }) {
  const t = total || 1;
  const pPct = Math.round(((passed || 0) / t) * 100);
  const fPct = Math.round(((failed || 0) / t) * 100);
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--bg-elevated)', minWidth: 60, gap: 1 }}>
      {pPct > 0 && <div style={{ width: `${pPct}%`, background: 'var(--success)' }} />}
      {fPct > 0 && <div style={{ width: `${fPct}%`, background: 'var(--failure)' }} />}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([
      projectsApi.dashboard(),
      projectsApi.list(),
    ])
      .then(([dashRes, projRes]) => {
        if (dashRes.status === 'fulfilled') setStats(dashRes.value);
        else setError(dashRes.reason?.message || 'Failed to load dashboard metrics');

        if (projRes.status === 'fulfilled') setProjects(projRes.value.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="main-area">
      <PageHeader
        title="Dashboard"
        subtitle="Autonomous testing overview and execution health"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
            <Plus size={13} />
            <span>New Project</span>
          </button>
        }
      />

      <div className="page-content">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="stat-grid">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : stats ? (
          <>
            {/* Metric Cards Row */}
            <div className="stat-grid mb-6">
              <StatCard
                label="Total Projects"
                value={stats.total_projects}
                subtext="Active test targets"
                color="indigo"
                icon={FolderOpen}
              />
              <StatCard
                label="Total Runs"
                value={stats.total_runs}
                subtext="Playwright executions"
                color=""
                icon={Activity}
              />
              <StatCard
                label="Pass Rate"
                value={`${stats.pass_rate}%`}
                subtext={stats.total_runs > 0 ? `${stats.pass_rate >= 80 ? 'Optimal' : 'Needs attention'}` : 'No runs yet'}
                color={stats.pass_rate >= 80 ? 'green' : stats.pass_rate >= 50 ? 'amber' : 'red'}
                icon={CheckCircle2}
              />
              <StatCard
                label="Failed Runs"
                value={stats.total_failed}
                subtext={stats.total_failed === 0 ? 'Zero failures' : 'Requires review'}
                color={stats.total_failed > 0 ? 'red' : 'green'}
                icon={XCircle}
              />
              <StatCard
                label="Avg Duration"
                value={msToHuman(stats.avg_duration_ms)}
                subtext="Execution latency"
                color=""
                icon={Clock}
              />
              <StatCard
                label="Self-Healed"
                value={stats.healed_steps}
                subtext="Automated selector fixes"
                color="amber"
                icon={Zap}
              />
            </div>

            {/* Split layout: Recent Runs (Main) + Recent Projects (Sidebar) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
              {/* Recent Runs Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Recent Test Runs</h2>
                    <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                      {stats.recent_runs.length}
                    </span>
                  </div>
                  {stats.recent_runs.length > 0 && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate('/runs')}
                      style={{ fontSize: '0.75rem', color: 'var(--accent)' }}
                    >
                      View all runs <ArrowUpRight size={12} />
                    </button>
                  )}
                </div>

                {stats.recent_runs.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title="No test runs executed yet"
                    description="Create a project, generate a test plan, and launch your first automated test run."
                    action={
                      <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
                        <Plus size={13} /> Create Project
                      </button>
                    }
                  />
                ) : (
                  <div className="table-container mb-6">
                    <table>
                      <thead>
                        <tr>
                          <th>Run Identifier</th>
                          <th>Status</th>
                          <th>Step Distribution</th>
                          <th>Duration</th>
                          <th>Executed</th>
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recent_runs.map(run => (
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
                            <td>
                              <div className="flex items-center gap-2">
                                <RunProgressMini
                                  passed={run.passed_steps}
                                  failed={run.failed_steps}
                                  total={run.total_steps}
                                />
                                <span className="font-mono text-xs">
                                  <span style={{ color: 'var(--success)', fontWeight: 500 }}>{run.passed_steps || 0}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                                  <span style={{ color: run.failed_steps > 0 ? 'var(--failure)' : 'var(--text-muted)', fontWeight: run.failed_steps > 0 ? 600 : 400 }}>
                                    {run.failed_steps || 0}
                                  </span>
                                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{run.total_steps || 0}</span>
                                </span>
                              </div>
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
                )}
              </div>

              {/* Recent Projects Section */}
              {projects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Active Projects</h2>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate('/projects')}
                      style={{ fontSize: '0.75rem', color: 'var(--accent)' }}
                    >
                      All projects <ArrowUpRight size={12} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {projects.map(p => (
                      <div
                        key={p.id}
                        className="card"
                        style={{ cursor: 'pointer', padding: '14px 16px' }}
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className="badge badge-neutral"
                            style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}
                          >
                            {p.project_type?.replace('_', ' ')}
                          </span>
                          <Badge status={p.status} />
                        </div>
                        <h3 style={{ fontSize: '0.875rem', marginBottom: 4, fontWeight: 600 }}>
                          {p.name}
                        </h3>
                        {p.target_url && (
                          <div className="font-mono text-xs text-muted truncate mb-2">
                            {p.target_url}
                          </div>
                        )}
                        <div
                          className="flex items-center justify-between mt-3"
                          style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}
                        >
                          <span className="text-xs text-muted">
                            {p.total_runs || 0} run{(p.total_runs || 0) !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-muted">{timeAgo(p.updated_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
