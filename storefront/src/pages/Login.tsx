import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, customerAuth, ApiError } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<{ accessToken: string; refreshToken: string }>('/api/auth/customer/login', {
        email,
        password,
      });
      customerAuth.setTokens(result.accessToken, result.refreshToken);
      navigate('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h1 className="font-display text-2xl mb-4">Already a member? Sign in here</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={loading} className="w-full bg-brand-bg text-brand-cream rounded py-2.5 font-medium disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-sm mt-4">
          New here? <Link to="/account/register" className="underline font-medium">Register for free</Link>
        </p>
      </div>
    </div>
  );
}
