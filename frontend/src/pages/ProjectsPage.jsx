import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Search, Plus } from 'lucide-react';
import { projectsApi } from '../api/client.js';
import { Badge, Spinner, EmptyState, SkeletonCard, PageHeader } from '../components/ui.jsx';

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

const typeLabel = { url: 'URL', local_url: 'Local URL', zip_upload: 'ZIP Upload' };

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const navigate = useNavigate();

  const load = (q = '') => {
    setLoading(true);
    projectsApi.list(q)
      .then(setProjects)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  };

  return (
    <div className="main-area">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
            <Plus size={14} /> New Project
          </button>
        }
      />
      <div className="page-content">
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 320, marginBottom: 20 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            placeholder="Search projects…"
            value={search}
            onChange={handleSearch}
          />
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Create your first project to start AI-assisted testing."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
                <Plus size={15} /> Create Project
              </button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
            {projects.map(p => (
              <div
                key={p.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'box-shadow var(--transition)' }}
                onClick={() => navigate(`/projects/${p.id}`)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="badge" style={{ background: 'var(--indigo-50)', color: 'var(--accent)', border: '1px solid var(--indigo-100)', fontSize: '0.6875rem', fontWeight: 500, padding: '1px 8px', borderRadius: 20 }}>
                    {typeLabel[p.project_type] || p.project_type}
                  </span>
                  <Badge status={p.status} />
                </div>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: 4 }}>{p.name}</h3>
                {p.description && <p className="text-xs text-muted" style={{ marginBottom: 8 }}>{p.description}</p>}
                {p.target_url && <p className="font-mono text-xs text-muted truncate">{p.target_url}</p>}
                {p.framework && (
                  <div className="flex gap-2 mt-2">
                    <span className="badge" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{p.framework}</span>
                    {p.package_manager && <span className="badge" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>{p.package_manager}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <span className="text-xs text-muted">{p.total_runs || 0} runs</span>
                  <span className="text-xs text-muted">Updated {timeAgo(p.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
