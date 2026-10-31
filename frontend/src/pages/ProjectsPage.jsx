import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Plus, Globe, Monitor, Upload
} from 'lucide-react';
import { projectsApi } from '../api/client.js';
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

const TYPE_CONFIG = {
  url: { label: 'Deployed URL', icon: Globe },
  local_url: { label: 'Local URL', icon: Monitor },
  zip_upload: { label: 'ZIP Archive', icon: Upload },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
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
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  };

  const filtered = projects.filter(p => {
    if (typeFilter === 'all') return true;
    return p.project_type === typeFilter;
  });

  return (
    <div className="main-area">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} configured test application${projects.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
            <Plus size={13} />
            <span>New Project</span>
          </button>
        }
      />

      <div className="page-content">
        {/* Controls Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search projects by name or URL…"
            maxWidth={320}
          />

          {/* Type Filter Tabs */}
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {[
              { id: 'all', label: `All (${projects.length})` },
              { id: 'url', label: 'Deployed URLs' },
              { id: 'local_url', label: 'Local Dev' },
              { id: 'zip_upload', label: 'ZIP Archives' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-item ${typeFilter === tab.id ? 'active' : ''}`}
                onClick={() => setTypeFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={search || typeFilter !== 'all' ? 'No matching projects found' : 'No projects created yet'}
            description={
              search || typeFilter !== 'all'
                ? 'Try clearing your search term or selecting another project type filter.'
                : 'Create your first project to connect a target application and begin autonomous QA.'
            }
            action={
              !search && (
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects/new')}>
                  <Plus size={13} /> Create Project
                </button>
              )
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filtered.map(p => {
              const typeCfg = TYPE_CONFIG[p.project_type] || { label: p.project_type, icon: Globe };
              const Icon = typeCfg.icon;

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <div>
                    {/* Header: Type Pill & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="flex items-center gap-1.5"
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-elevated)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-primary)',
                        }}
                      >
                        <Icon size={12} style={{ color: 'var(--accent)' }} />
                        <span>{typeCfg.label}</span>
                      </div>
                      <Badge status={p.status} />
                    </div>

                    {/* Title & Description */}
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-xs text-muted mb-2" style={{ lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.description}
                      </p>
                    )}

                    {/* Target URL or build info */}
                    {p.target_url && (
                      <div
                        className="font-mono text-xs text-secondary truncate mb-2"
                        style={{
                          background: 'var(--bg-input)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {p.target_url}
                      </div>
                    )}

                    {/* Framework Tags */}
                    {(p.framework || p.package_manager) && (
                      <div className="flex gap-1.5 mt-2" style={{ flexWrap: 'wrap' }}>
                        {p.framework && (
                          <span
                            className="badge badge-neutral"
                            style={{ fontSize: '0.65rem' }}
                          >
                            {p.framework}
                          </span>
                        )}
                        {p.package_manager && (
                          <span
                            className="badge badge-neutral"
                            style={{ fontSize: '0.65rem' }}
                          >
                            {p.package_manager}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer Metadata */}
                  <div
                    className="flex items-center justify-between mt-4"
                    style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}
                  >
                    <span className="text-xs text-muted font-mono">
                      {p.total_runs || 0} run{(p.total_runs || 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-muted">
                      Updated {timeAgo(p.updated_at || p.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
