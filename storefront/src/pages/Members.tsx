import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, customerAuth, ApiError } from '../lib/api';

const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'];

export default function Members() {
  const navigate = useNavigate();

  // Register form state
  const [title, setTitle] = useState('Mr');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [dob, setDob] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [landline, setLandline] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [postcode, setPostcode] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [wantsEmail, setWantsEmail] = useState(false);
  const [wantsSms, setWantsSms] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // Sign-in form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState(false);

  function handleAutofillAddress() {
    // Real postcode -> address lookup needs a paid third-party API (e.g. getAddress.io /
    // Ideal Postcodes) and an API key, which isn't wired up yet - enter manually for now.
    setRegError(null);
    alert("Address autofill isn't set up yet - please enter your address manually below.");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);

    if (!acceptTerms) {
      setRegError('Please accept the terms and conditions to continue.');
      return;
    }

    setRegLoading(true);
    try {
      const result = await api.post<{ accessToken: string; refreshToken: string }>('/api/auth/customer/register', {
        title,
        fullName: `${firstName} ${surname}`.trim(),
        email: regEmail,
        phone: mobile || undefined,
        landlinePhone: landline || undefined,
        dateOfBirth: dob || undefined,
        password: regPassword,
        marketingEmailOptIn: wantsEmail,
        marketingSmsOptIn: wantsSms,
        deliveryAddress: addressLine1
          ? { line1: addressLine1, line2: addressLine2 || undefined, city, county: county || undefined, postcode }
          : undefined,
      });
      customerAuth.setTokens(result.accessToken, result.refreshToken);
      navigate('/account');
    } catch (err) {
      setRegError(err instanceof ApiError ? err.message : 'Could not register. Please try again.');
    } finally {
      setRegLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent, andOrder: boolean) {
    e.preventDefault();
    setSignInError(null);
    setSignInLoading(true);
    try {
      const result = await api.post<{ accessToken: string; refreshToken: string }>('/api/auth/customer/login', {
        email: signInEmail,
        password: signInPassword,
      });
      customerAuth.setTokens(result.accessToken, result.refreshToken);
      navigate(andOrder ? '/menu' : '/account');
    } catch (err) {
      setSignInError(err instanceof ApiError ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setSignInLoading(false);
    }
  }

  const inputClass = 'w-full rounded border border-brand-bg/20 px-3 py-2 text-sm';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-2 gap-6 items-start">
      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h1 className="font-display text-2xl mb-4">Register now, it&apos;s free!</h1>
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Title</label>
            <select value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass}>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">First Name</label>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={inputClass} />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Surname</label>
            <input required value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Last name" className={inputClass} />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Date of Birth</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
              <span className="text-xs text-brand-bg/50 shrink-0">Optional</span>
            </div>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Email</label>
            <input required type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="you@somewhere.com" className={inputClass} />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Mobile Number</label>
            <div className="flex items-center gap-2">
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="07123456789" className={inputClass} />
              <span className="text-xs text-brand-bg/50 shrink-0">No spaces please</span>
            </div>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Landline Number</label>
            <div className="flex items-center gap-2">
              <input value={landline} onChange={(e) => setLandline(e.target.value)} placeholder="01234568120" className={inputClass} />
              <span className="text-xs text-brand-bg/50 shrink-0">No spaces please</span>
            </div>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
            <label className="text-sm font-medium">Password</label>
            <div className="flex items-center gap-2">
              <input required minLength={8} type={showPassword ? 'text' : 'password'} value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)} placeholder="Password" className={inputClass} />
              <span className="text-xs text-brand-bg/50 shrink-0">Min 8 characters</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm pl-[112px]">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Show Password
          </label>

          <div className="border-t border-brand-bg/10 pt-3 mt-3 space-y-3">
            <div className="grid grid-cols-[100px_1fr_auto] gap-3 items-center">
              <label className="text-sm font-medium">Postcode</label>
              <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="SA8 4JN" className={inputClass} />
              <button type="button" onClick={handleAutofillAddress} className="bg-brand-mint text-brand-bg text-sm font-medium px-3 py-2 rounded whitespace-nowrap">
                Autofill Address
              </button>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
              <label className="text-sm font-medium">Address Line 1</label>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
              <label className="text-sm font-medium">Address Line 2</label>
              <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
              <label className="text-sm font-medium">Town/City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Swansea" className={inputClass} />
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3 items-center">
              <label className="text-sm font-medium">County</label>
              <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="West Glamorgan" className={inputClass} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" />
              <span>I accept the terms &amp; conditions</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={wantsEmail} onChange={(e) => setWantsEmail(e.target.checked)} className="mt-0.5" />
              <span>I want to receive promotional emails</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={wantsSms} onChange={(e) => setWantsSms(e.target.checked)} className="mt-0.5" />
              <span>I want to receive promotional SMS</span>
            </label>
          </div>

          {regError && <p className="text-red-600 text-sm">{regError}</p>}

          <button disabled={regLoading} className="bg-indigo-700 text-white rounded px-6 py-2.5 font-medium disabled:opacity-50">
            {regLoading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
          <h1 className="font-display text-2xl mb-4">Already a member? Sign in here</h1>
          <form onSubmit={(e) => handleSignIn(e, false)} className="space-y-3">
            <div className="grid grid-cols-[80px_1fr] gap-3 items-center">
              <label className="text-sm font-medium">Email</label>
              <input required type="email" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} placeholder="Email" className={inputClass} />
            </div>
            <div className="grid grid-cols-[80px_1fr_auto] gap-3 items-center">
              <label className="text-sm font-medium">Password</label>
              <input required type="password" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} placeholder="Password" className={inputClass} />
              <button type="button" className="text-sm text-brand-green underline whitespace-nowrap">Forgot?</button>
            </div>
            {signInError && <p className="text-red-600 text-sm">{signInError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={signInLoading} className="bg-brand-bg text-brand-cream rounded px-5 py-2.5 font-medium disabled:opacity-50">
                Sign In
              </button>
              <button type="button" onClick={(e) => handleSignIn(e, true)} disabled={signInLoading}
                className="bg-brand-green text-white rounded px-5 py-2.5 font-medium disabled:opacity-50">
                Sign In and Order Now
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-lg overflow-hidden aspect-video bg-brand-bg-light flex items-end p-6">
          <div>
            <p className="font-display text-2xl sm:text-3xl text-white">Sign Up For<br />Loyalty Points</p>
          </div>
        </div>
      </div>
    </div>
  );
}
