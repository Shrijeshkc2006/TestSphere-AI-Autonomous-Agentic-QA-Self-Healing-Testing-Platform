import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, ChevronRight, FolderOpen } from 'lucide-react';
import { runsApi, projectsApi } from '../api/client.js';
import { Badge, Spinner, EmptyState, SkeletonCard, PageHeader } from '../components/ui.jsx';

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
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-muted)', gap: 1, minWidth: 80 }}>
      {passedPct > 0 && <div style={{ width: `${passedPct}%`, background: 'var(--green-500)' }} />}
      {failedPct > 0 && <div style={{ width: `${failedPct}%`, background: 'var(--red-500)' }} />}
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

  useEffect(() => {
    (async () => {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);
        // Gather runs from all projects (up to 10 each)
        const allRuns = (await Promise.allSettled(
          projs.map(p => runsApi.listForProject(p.id, 10, 0).then(runs => runs.map(r => ({ ...r, _projectName: p.name }))))
        ))
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

  const filtered = search
    ? runs.filter(r =>
        r.id.includes(search) ||
        r._projectName?.toLowerCase().includes(search.toLowerCase()) ||
        r.status.toLowerCase().includes(search.toLowerCase()))
    : runs;

  return (
    <div className="main-area">
      <PageHeader
        title="Recent Runs"
        subtitle={`${runs.length} run${runs.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}`}
      />
      <div className="page-content">
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 340, marginBottom: 20 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search by run ID, project, or status…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
            title={search ? 'No runs match your search' : 'No runs yet'}
            description={search ? 'Try a different search term.' : 'Create a project and approve a test plan to start running tests.'}
            action={!search && (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
                + New Project
              </button>
            )}
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Steps</th>
                  <th>Duration</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(run => (
                  <tr
                    key={run.id}
                    className="clickable"
                    onClick={() => navigate(`/runs/${run.id}`)}
                  >
                    <td className="font-mono text-xs">{run.id.slice(0, 8)}…</td>
                    <td style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{run._projectName}</td>
                    <td><Badge status={run.status} /></td>
                    <td><RunPassBar run={run} /></td>
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
        )}
      </div>
    </div>
  );
}
