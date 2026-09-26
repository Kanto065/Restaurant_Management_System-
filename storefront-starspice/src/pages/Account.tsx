import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { customerAuth } from '@shared/lib/api';
import {
  useCreateAddress, useDeleteAddress, useLoyalty, useOrders, useProfile, useRestaurant, useUpdateProfile,
} from '@shared/lib/queries';
import type { CustomerProfile } from '@shared/types/api';
import { formatPrice, usePageTitle } from '../lib/site';

function Orders({ currency }: { currency: string | undefined }) {
  const { data: orders, isLoading } = useOrders();
  if (isLoading) return <p>Loading your orders…</p>;
  if (!orders || orders.length === 0) {
    return <p>No orders yet. <Link to="/menu" style={{ textDecoration: 'underline' }}>Start your first order</Link>.</p>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead><tr><th>Order</th><th>Date</th><th>Type</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link to={`/order/${o.id}/track`} style={{ textDecoration: 'underline' }}>#{o.orderNumber}</Link></td>
              <td>{new Date(o.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td>
              <td>{o.orderType === 'Delivery' ? 'Delivery' : 'Collection'}</td>
              <td>{o.status}</td>
              <td style={{ textAlign: 'right' }}>{formatPrice(o.totalAmount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Loyalty({ perPound }: { perPound: number }) {
  const { data: loyalty, isLoading } = useLoyalty();
  if (isLoading || !loyalty) return <p>Loading your points…</p>;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow" style={{ color: '#865817' }}>YOUR BALANCE</p>
        <p className="points-balance" style={{ marginTop: 10 }}>{loyalty.pointsBalance}</p>
        <p className="small" style={{ color: '#636456', marginTop: 8 }}>
          points · worth £{(loyalty.pointsBalance * 0.01).toFixed(2)} off a future order. You earn {perPound} point{perPound === 1 ? '' : 's'} for every £1 spent.
        </p>
      </div>
      {loyalty.recentTransactions.length > 0 && (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Details</th><th style={{ textAlign: 'right' }}>Points</th></tr></thead>
          <tbody>
            {loyalty.recentTransactions.map((t, i) => (
              <tr key={i}>
                <td>{new Date(t.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' })}</td>
                <td>{t.reason}</td>
                <td style={{ textAlign: 'right' }}>{t.pointsDelta > 0 ? `+${t.pointsDelta}` : t.pointsDelta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Details({ profile }: { profile: CustomerProfile }) {
  const update = useUpdateProfile();
  const [form, setForm] = useState({
    fullName: profile.fullName, phone: profile.phone ?? '',
    marketingEmailOptIn: profile.marketingEmailOptIn, marketingSmsOptIn: profile.marketingSmsOptIn, newPassword: '',
  });
  const [saved, setSaved] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      title: profile.title, fullName: form.fullName, phone: form.phone || null, landlinePhone: profile.landlinePhone,
      dateOfBirth: profile.dateOfBirth, marketingEmailOptIn: form.marketingEmailOptIn, marketingSmsOptIn: form.marketingSmsOptIn,
      newPassword: form.newPassword || null,
    });
    setForm((f) => ({ ...f, newPassword: '' }));
    setSaved(true);
  }

  return (
    <form className="stack" style={{ maxWidth: 560 }} onSubmit={save}>
      <label className="field"><span>Email (sign-in)</span><input type="email" value={profile.email} disabled /></label>
      <label className="field"><span>Full name</span><input type="text" required value={form.fullName} onChange={set('fullName')} /></label>
      <label className="field"><span>Mobile number</span><input type="tel" value={form.phone} onChange={set('phone')} /></label>
      <label className="field"><span>New password (leave blank to keep)</span>
        <input type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={set('newPassword')} /></label>
      <label className="check"><input type="checkbox" checked={form.marketingEmailOptIn} onChange={set('marketingEmailOptIn')} /> Email me offers</label>
      <label className="check"><input type="checkbox" checked={form.marketingSmsOptIn} onChange={set('marketingSmsOptIn')} /> Text me offers</label>
      {update.error && <p className="form-error">{(update.error as Error).message}</p>}
      {saved && <p className="form-success">Your details have been saved.</p>}
      <div><button type="submit" className="button" disabled={update.isPending}>Save details</button></div>
    </form>
  );
}

function Addresses({ profile }: { profile: CustomerProfile }) {
  const create = useCreateAddress();
  const remove = useDeleteAddress();
  const empty = { line1: '', line2: '', city: '', postcode: '' };
  const [form, setForm] = useState(empty);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      label: null, line1: form.line1, line2: form.line2 || null, city: form.city, county: null,
      postcode: form.postcode, isDefault: profile.addresses.length === 0,
    });
    setForm(empty);
  }

  return (
    <div className="stack" style={{ gap: 30 }}>
      {profile.addresses.length === 0 ? <p>No saved addresses yet.</p> : (
        <table className="data-table">
          <tbody>
            {profile.addresses.map((a) => (
              <tr key={a.id}>
                <td>{[a.line1, a.line2, a.city, a.postcode].filter(Boolean).join(', ')}{a.id === profile.defaultAddressId && ' · Default'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="link-button" disabled={remove.isPending}
                    onClick={() => { if (window.confirm('Remove this address?')) remove.mutate(a.id); }}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="form-grid" style={{ maxWidth: 640 }} onSubmit={add}>
        <label className="field span-2"><span>Address line 1</span><input type="text" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} /></label>
        <label className="field span-2"><span>Address line 2 (optional)</span><input type="text" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></label>
        <label className="field"><span>Town</span><input type="text" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        <label className="field"><span>Postcode</span><input type="text" required value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value.toUpperCase() })} /></label>
        {create.error && <p className="form-error span-2">{(create.error as Error).message}</p>}
        <div className="span-2"><button type="submit" className="button" disabled={create.isPending}>Add address</button></div>
      </form>
    </div>
  );
}

export default function Account() {
  usePageTitle('My account');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loggedIn = customerAuth.isLoggedIn();
  const { data: profile, error } = useProfile();
  const { data: restaurant } = useRestaurant();

  // Session expired / refresh failed - send them to sign in again.
  useEffect(() => {
    if (error) { customerAuth.clear(); navigate('/sign-in?next=/account', { replace: true }); }
  }, [error, navigate]);

  if (!loggedIn) return <Navigate to="/sign-in?next=/account" replace />;

  function signOut() {
    customerAuth.clear();
    queryClient.removeQueries({ queryKey: ['account'] });
    navigate('/', { replace: true });
  }

  const tab = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

  return (
    <>
      <div className="wrap page-intro menu-intro">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>{profile ? `Hello, ${profile.fullName.split(' ')[0]}.` : 'Your account.'}</h1>
        <p>
          {profile && `${profile.loyaltyPointsBalance} loyalty points · ${profile.orderCount} order${profile.orderCount === 1 ? '' : 's'}`}
          {' '}<button type="button" className="link-button" onClick={signOut} style={{ marginLeft: 12 }}>Sign out</button>
        </p>
      </div>
      <div className="paper">
        <div className="wrap" style={{ padding: '50px 0 85px' }}>
          <nav className="account-tabs" aria-label="Account sections">
            <NavLink to="/account" end className={tab}>Orders</NavLink>
            <NavLink to="/account/loyalty" className={tab}>Loyalty points</NavLink>
            <NavLink to="/account/addresses" className={tab}>Addresses</NavLink>
            <NavLink to="/account/details" className={tab}>My details</NavLink>
          </nav>
          {!profile ? <p>Loading…</p> : (
            <Routes>
              <Route index element={<Orders currency={restaurant?.currency} />} />
              <Route path="loyalty" element={<Loyalty perPound={restaurant?.loyaltyPointsPerCurrencyUnit ?? 1} />} />
              <Route path="addresses" element={<Addresses profile={profile} />} />
              <Route path="details" element={<Details key={profile.email} profile={profile} />} />
              <Route path="*" element={<Navigate to="/account" replace />} />
            </Routes>
          )}
        </div>
      </div>
    </>
  );
}
