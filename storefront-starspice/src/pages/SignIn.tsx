import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, customerAuth } from '@shared/lib/api';
import { usePageTitle } from '../lib/site';

type Tokens = { accessToken: string; refreshToken: string };

/** Sign in or create a Star Spice account (accounts are separate from any other restaurant). */
export default function SignIn() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/account';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [reg, setReg] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '', marketingEmailOptIn: false, marketingSmsOptIn: false });
  const [regError, setRegError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  if (customerAuth.isLoggedIn()) return <Navigate to={next} replace />;

  function done(tokens: Tokens) {
    customerAuth.setTokens(tokens.accessToken, tokens.refreshToken);
    queryClient.invalidateQueries({ queryKey: ['account'] });
    navigate(next, { replace: true });
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setSigningIn(true);
    try {
      done(await api.post<Tokens>('/api/auth/customer/login', { email, password }));
    } catch (err) {
      setSignInError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
      setSigningIn(false);
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);
    if (reg.password !== reg.confirm) { setRegError('The two passwords don’t match.'); return; }
    setRegistering(true);
    try {
      done(await api.post<Tokens>('/api/auth/customer/register', {
        fullName: reg.fullName,
        email: reg.email,
        phone: reg.phone || undefined,
        password: reg.password,
        marketingEmailOptIn: reg.marketingEmailOptIn,
        marketingSmsOptIn: reg.marketingSmsOptIn,
      }));
    } catch (err) {
      setRegError(err instanceof ApiError ? err.message : 'Could not create your account. Please try again.');
      setRegistering(false);
    }
  }

  const set = (key: keyof typeof reg) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setReg((r) => ({ ...r, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <div className="wrap page-intro menu-intro">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Welcome back.</h1>
        <p>Sign in to order faster, keep your addresses and collect loyalty points on every order.</p>
      </div>
      <div className="paper">
        <div className="wrap auth-layout">
          <form className="stack" onSubmit={signIn}>
            <h2>Sign in</h2>
            <label className="field"><span>Email</span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field"><span>Password</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {signInError && <p className="form-error" role="alert">{signInError}</p>}
            <div><button type="submit" className="button" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span></button></div>
          </form>

          <form className="stack" onSubmit={register}>
            <h2>New here?</h2>
            <label className="field"><span>Full name</span>
              <input type="text" autoComplete="name" required value={reg.fullName} onChange={set('fullName')} /></label>
            <label className="field"><span>Email</span>
              <input type="email" autoComplete="email" required value={reg.email} onChange={set('email')} /></label>
            <label className="field"><span>Mobile number</span>
              <input type="tel" autoComplete="tel" value={reg.phone} onChange={set('phone')} /></label>
            <div className="form-grid">
              <label className="field"><span>Password</span>
                <input type="password" autoComplete="new-password" required minLength={8} value={reg.password} onChange={set('password')} /></label>
              <label className="field"><span>Confirm password</span>
                <input type="password" autoComplete="new-password" required minLength={8} value={reg.confirm} onChange={set('confirm')} /></label>
            </div>
            <p className="small" style={{ color: '#636456' }}>At least 8 characters, with upper and lower case letters, a number and a symbol.</p>
            <label className="check"><input type="checkbox" checked={reg.marketingEmailOptIn} onChange={set('marketingEmailOptIn')} /> Email me offers from Star Spice</label>
            <label className="check"><input type="checkbox" checked={reg.marketingSmsOptIn} onChange={set('marketingSmsOptIn')} /> Text me offers from Star Spice</label>
            {regError && <p className="form-error" role="alert">{regError}</p>}
            <div><button type="submit" className="button" disabled={registering}>{registering ? 'Creating account…' : 'Create account'} <span aria-hidden="true">→</span></button></div>
          </form>
        </div>
      </div>
    </>
  );
}
