import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Play, ChevronRight } from 'lucide-react';
import { projectsApi, plansApi, runsApi } from '../api/client.js';
import { Badge, EmptyState, SkeletonCard, PageHeader, SearchInput } from '../components/ui.jsx';

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

export default function TestPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | approved | pending_review | draft

  useEffect(() => {
    (async () => {
      try {
        const projs = await projectsApi.list();
        setProjects(projs);
        const allPlans = (
          await Promise.allSettled(
            projs.map(p =>
              plansApi.listForProject(p.id).then(list =>
                list.map(plan => ({ ...plan, _projectName: p.name, _projectType: p.project_type }))
              )
            )
          )
        )
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value)
          .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        setPlans(allPlans);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRun = async (e, plan) => {
    e.stopPropagation();
    try {
      const run = await runsApi.create({ project_id: plan.project_id, test_plan_id: plan.id });
      navigate(`/runs/${run.id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const filtered = plans.filter(p => {
    const matchesSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p._projectName?.toLowerCase().includes(search.toLowerCase()) ||
      p.requirements?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const approvedCount = plans.filter(p => p.status === 'approved').length;
  const pendingCount = plans.filter(p => p.status === 'pending_review' || p.status === 'draft').length;

  return (
    <div className="main-area">
      <PageHeader
        title="Test Plans"
        subtitle={`${plans.length} plan${plans.length !== 1 ? 's' : ''} across ${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          projects.length > 0 ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/projects/${projects[0].id}/plans/new`)}
            >
              <Plus size={13} /> New Test Plan
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/projects/new')}
            >
              <Plus size={13} /> New Project
            </button>
          )
        }
      />

      <div className="page-content">
        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter plans by name, requirements, or project…"
            maxWidth={360}
          />

          {/* Status Tabs */}
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {[
              { id: 'all', label: `All (${plans.length})` },
              { id: 'approved', label: `Approved (${approvedCount})` },
              { id: 'pending_review', label: `Pending (${pendingCount})` },
            ].map(t => (
              <button
                key={t.id}
                className={`tab-item ${statusFilter === t.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search || statusFilter !== 'all' ? 'No matching test plans' : 'No test plans created yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or filter tabs.'
                : 'Test plans contain the structured, AI-generated or manual test steps for your applications.'
            }
            action={
              !search && projects.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/projects/${projects[0].id}/plans/new`)}
                >
                  <Plus size={13} /> Create Test Plan
                </button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Test Plan</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Steps</th>
                  <th>Version</th>
                  <th>Updated</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(plan => (
                  <tr
                    key={plan.id}
                    className="clickable"
                    onClick={() => navigate(`/plans/${plan.id}`)}
                  >
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{plan.name}</div>
                      {plan.requirements && (
                        <div
                          className="text-xs text-muted truncate"
                          style={{ maxWidth: 380, marginTop: 2 }}
                        >
                          {plan.requirements}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-primary)',
                          fontSize: '0.6875rem',
                        }}
                      >
                        {plan._projectName}
                      </span>
                    </td>
                    <td>
                      <Badge status={plan.status} />
                    </td>
                    <td>
                      <span className="font-mono text-xs">{plan.steps?.length || 0} steps</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-muted">v{plan.version}</span>
                    </td>
                    <td className="text-xs text-muted">
                      {timeAgo(plan.updated_at || plan.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center gap-2 justify-end">
                        {plan.status === 'approved' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={(e) => handleRun(e, plan)}
                            title="Execute this test plan immediately"
                          >
                            <Play size={11} /> Run
                          </button>
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </div>
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
