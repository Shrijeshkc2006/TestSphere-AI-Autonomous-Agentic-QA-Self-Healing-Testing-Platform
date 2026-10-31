import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, History, Settings,
  LogOut, TestTube2, Plus, FileText, X
} from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',  icon: FolderOpen,       label: 'Projects'  },
  { to: '/plans',     icon: FileText,         label: 'Test Plans' },
  { to: '/runs',      icon: History,          label: 'Recent Runs' },
  { to: '/settings',  icon: Settings,         label: 'Settings'  },
];

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? (user.username || user.email || 'U').slice(0, 2).toUpperCase()
    : 'U';

  const handleNavClick = () => {
    if (window.innerWidth <= 840) {
      onClose();
    }
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <NavLink
            to="/dashboard"
            className="sidebar-logo"
            style={{ textDecoration: 'none', borderBottom: 'none', padding: '14px 16px', flex: 1 }}
            onClick={handleNavClick}
          >
            <div className="sidebar-logo-mark">
              <TestTube2 size={15} />
            </div>
            <div className="sidebar-logo-text">
              Test<span>Sphere</span>
            </div>
            <span className="sidebar-badge">v1.0</span>
          </NavLink>
          {isOpen && (
            <button
              className="btn-icon"
              onClick={onClose}
              style={{ marginRight: 10 }}
              aria-label="Close sidebar"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Quick action button */}
        <div className="sidebar-quick-action">
          <button
            className="btn btn-primary btn-sm w-full"
            onClick={() => {
              navigate('/projects/new');
              handleNavClick();
            }}
            style={{ justifyContent: 'center', width: '100%' }}
          >
            <Plus size={13} />
            <span>New Project</span>
          </button>
        </div>

        {/* Main Navigation */}
        <div className="sidebar-section">
          <div className="sidebar-section-label">Platform</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={handleNavClick}
              >
                <Icon size={15} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User profile & footer */}
        <div className="sidebar-footer">
          <button
            className="user-chip"
            onClick={handleLogout}
            title="Click to sign out"
            aria-label="User profile and logout"
          >
            <div className="avatar">{initials}</div>
            <div className="user-chip-info">
              <div className="user-chip-name">{user?.username || 'Developer'}</div>
              <div className="user-chip-email">{user?.email || 'authenticated'}</div>
            </div>
            <LogOut size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        </div>
      </aside>
    </>
  );
}
