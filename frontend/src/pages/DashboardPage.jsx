import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, CheckCircle, XCircle, Clock, Zap, FolderOpen } from 'lucide-react';
import { projectsApi } from '../api/client.js';
import { Badge, Spinner, EmptyState, SkeletonCard } from '../components/ui.jsx';
import { PageHeader } from '../components/ui.jsx';

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

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    projectsApi.dashboard()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="main-area">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your testing activity"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
            + New Project
          </button>
        }
      />
      <div className="page-content">
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16 }}>
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="alert alert-error"><span>{error}</span></div>
        ) : stats ? (
          <>
            {/* Stat cards */}
            <div className="stat-grid mb-6">
              <div className="stat-card">
                <span className="stat-card-label">Total Projects</span>
                <span className="stat-card-value indigo">{stats.total_projects}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Total Runs</span>
                <span className="stat-card-value">{stats.total_runs}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Pass Rate</span>
                <span className={`stat-card-value ${stats.pass_rate >= 80 ? 'green' : stats.pass_rate >= 50 ? 'amber' : 'red'}`}>
                  {stats.pass_rate}%
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Failed Runs</span>
                <span className={`stat-card-value ${stats.total_failed > 0 ? 'red' : 'green'}`}>{stats.total_failed}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Avg Duration</span>
                <span className="stat-card-value" style={{ fontSize: '1.25rem' }}>{msToHuman(stats.avg_duration_ms)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Self-Healed Steps</span>
                <span className="stat-card-value amber">{stats.healed_steps}</span>
              </div>
            </div>

            {/* Recent runs */}
            <h2 className="mb-4" style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Recent Runs</h2>
            {stats.recent_runs.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No test runs yet"
                description="Create a project and run your first test to see results here."
                action={
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
                    Create Project
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
                      <th>Steps</th>
                      <th>Duration</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_runs.map(run => (
                      <tr
                        key={run.id}
                        className="clickable"
                        onClick={() => navigate(`/runs/${run.id}`)}
                      >
                        <td className="font-mono text-xs">{run.id.slice(0, 8)}…</td>
                        <td><Badge status={run.status} /></td>
                        <td>
                          <span style={{ color: 'var(--green-600)', fontWeight: 500 }}>{run.passed_steps}↑</span>
                          {' / '}
                          <span style={{ color: 'var(--red-600)', fontWeight: 500 }}>{run.failed_steps}↓</span>
                          {' / '}
                          <span className="text-muted">{run.total_steps}</span>
                        </td>
                        <td className="text-muted">{msToHuman(run.duration_ms)}</td>
                        <td className="text-muted">{timeAgo(run.started_at || run.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
