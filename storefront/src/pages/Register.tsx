import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, customerAuth, ApiError } from '../lib/api';

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<{ accessToken: string; refreshToken: string }>('/api/auth/customer/register', {
        fullName,
        email,
        phone: phone || undefined,
        password,
      });
      customerAuth.setTokens(result.accessToken, result.refreshToken);
      navigate('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h1 className="font-display text-2xl mb-4">Register now, it's free!</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name"
            className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number"
            className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)" minLength={8}
            className="w-full rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={loading} className="w-full bg-brand-bg text-brand-cream rounded py-2.5 font-medium disabled:opacity-50">
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="text-sm mt-4">
          Already a member? <Link to="/account/login" className="underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
