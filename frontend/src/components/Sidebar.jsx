import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, History, Settings,
  LogOut, TestTube2, Plus,
} from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',   icon: FolderOpen,       label: 'Projects'  },
  { to: '/runs',       icon: History,           label: 'Recent Runs' },
  { to: '/settings',   icon: Settings,          label: 'Settings'  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? (user.username || user.email || 'U').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <NavLink to="/dashboard" className="sidebar-logo" style={{ textDecoration: 'none' }}>
        <div className="sidebar-logo-mark">
          <TestTube2 size={16} color="#fff" />
        </div>
        <span className="sidebar-logo-text">Test<span>Sphere</span></span>
      </NavLink>

      {/* Quick action */}
      <div style={{ padding: '0 12px', marginBottom: 4 }}>
        <button
          className="btn btn-primary btn-sm w-full"
          onClick={() => navigate('/projects/new')}
          style={{ justifyContent: 'center', width: '100%' }}
        >
          <Plus size={13} /> New Project
        </button>
      </div>

      {/* Nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Footer / user */}
      <div className="sidebar-footer">
        <button className="user-chip" onClick={handleLogout} title="Sign out" style={{ width: '100%' }}>
          <div className="avatar">{initials}</div>
          <div className="user-chip-info">
            <div className="user-chip-name">{user?.username || 'User'}</div>
            <div className="user-chip-email">{user?.email || ''}</div>
          </div>
          <LogOut size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>
      </div>
    </aside>
  );
}
