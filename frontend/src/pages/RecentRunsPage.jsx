import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ChevronRight } from 'lucide-react';
import { runsApi, projectsApi } from '../api/client.js';
import { Badge, EmptyState, SkeletonCard, PageHeader, SearchInput } from '../components/ui.jsx';

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

export default function RecentRunsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | passed | failed | running

  useEffect(() => {
    (async () => {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);
        const allRuns = (
          await Promise.allSettled(
            projs.map(p =>
              runsApi.listForProject(p.id, 15, 0).then(list =>
                list.map(r => ({ ...r, _projectName: p.name, _projectType: p.project_type }))
              )
            )
          )
        )
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRuns(allRuns);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = runs.filter(r => {
    const matchesSearch =
      !search ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r._projectName?.toLowerCase().includes(search.toLowerCase()) ||
      r.status.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const passedCount = runs.filter(r => r.status === 'passed').length;
  const failedCount = runs.filter(r => r.status === 'failed').length;
  const activeCount = runs.filter(r => r.status === 'running' || r.status === 'queued').length;

  return (
    <div className="main-area">
      <PageHeader
        title="Recent Runs"
        subtitle={`${runs.length} test execution${runs.length !== 1 ? 's' : ''} across ${projects.length} target${projects.length !== 1 ? 's' : ''}`}
      />

      <div className="page-content">
        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by run ID, project name, or status…"
            maxWidth={360}
          />

          {/* Status Tabs */}
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {[
              { id: 'all', label: `All (${runs.length})` },
              { id: 'passed', label: `Passed (${passedCount})` },
              { id: 'failed', label: `Failed (${failedCount})` },
              { id: 'running', label: `Active (${activeCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-item ${statusFilter === tab.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title={search || statusFilter !== 'all' ? 'No test runs match your filter' : 'No test runs yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try clearing your search query or selecting a different status filter.'
                : 'Configure a project and launch a test plan to see execution records here.'
            }
            action={
              !search && projects.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/projects')}
                >
                  Go to Projects
                </button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Run Identifier</th>
                  <th>Target Project</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Steps (P / F / Total)</th>
                  <th>Duration</th>
                  <th>Executed</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(run => (
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
                      <span
                        className="badge"
                        style={{
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-primary)',
                          fontSize: '0.6875rem',
                        }}
                      >
                        {run._projectName}
                      </span>
                    </td>
                    <td>
                      <Badge status={run.status} />
                    </td>
                    <td style={{ minWidth: 70 }}>
                      <RunPassBar run={run} />
                    </td>
                    <td className="font-mono text-xs">
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                        {run.passed_steps || 0}
                      </span>
                      <span className="text-muted"> / </span>
                      <span
                        style={{
                          color: run.failed_steps > 0 ? 'var(--failure)' : 'var(--text-muted)',
                          fontWeight: run.failed_steps > 0 ? 600 : 400,
                        }}
                      >
                        {run.failed_steps || 0}
                      </span>
                      <span className="text-muted"> / </span>
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
        )}
      </div>
    </div>
  );
}
