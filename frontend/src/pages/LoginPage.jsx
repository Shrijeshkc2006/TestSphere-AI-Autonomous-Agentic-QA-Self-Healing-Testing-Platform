import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TestTube2, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Spinner } from '../components/ui.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <TestTube2 size={16} />
          </div>
          <span className="auth-logo-text">Test<span>Sphere</span></span>
        </div>

        <h2 className="auth-title">Sign In</h2>
        <p className="auth-subtitle">
          Access your autonomous QA dashboard and test runs
        </p>

        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="developer@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ marginTop: 6 }}
          >
            {loading ? <Spinner size="sm" /> : <>Sign In <ArrowRight size={13} /></>}
          </button>
        </form>

        <p className="text-xs text-muted" style={{ marginTop: 22, textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
