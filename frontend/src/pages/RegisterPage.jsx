import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TestTube2, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Spinner } from '../components/ui.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check inputs.');
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

        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">
          Start autonomous agentic testing with self-healing locators
        </p>

        {error && <Alert type="error" style={{ marginBottom: 16 }}>{error}</Alert>}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">
              Work Email
            </label>
            <input
              id="reg-email"
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
            <label className="form-label" htmlFor="reg-username">
              Username
            </label>
            <input
              id="reg-username"
              type="text"
              className="input"
              placeholder="johndoe"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              autoComplete="username"
              pattern="[a-zA-Z0-9_-]+"
              minLength={3}
              maxLength={50}
            />
            <span className="form-hint">3–50 alphanumeric characters or hyphens</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              type="password"
              className="input"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ marginTop: 6 }}
          >
            {loading ? <Spinner size="sm" /> : <>Create Account <ArrowRight size={13} /></>}
          </button>
        </form>

        <p className="text-xs text-muted" style={{ marginTop: 22, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
