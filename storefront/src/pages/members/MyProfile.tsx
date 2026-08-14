import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Trash2 } from 'lucide-react';
import { useProfile, useUpdateProfile, useUpdateAddress, useDeleteAccount } from '../../lib/queries';
import { customerAuth } from '../../lib/api';

const TITLES = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'];

export default function MyProfile() {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const updateAddress = useUpdateAddress();
  const deleteAccount = useDeleteAccount();

  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [landlinePhone, setLandlinePhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [marketingSmsOptIn, setMarketingSmsOptIn] = useState(false);
  const [defaultAddressId, setDefaultAddressId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setTitle(profile.title ?? '');
    setFullName(profile.fullName);
    setDateOfBirth(profile.dateOfBirth ?? '');
    setPhone(profile.phone ?? '');
    setLandlinePhone(profile.landlinePhone ?? '');
    setMarketingEmailOptIn(profile.marketingEmailOptIn);
    setMarketingSmsOptIn(profile.marketingSmsOptIn);
    setDefaultAddressId(profile.defaultAddressId ?? '');
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    await updateProfile.mutateAsync({
      title: title || null,
      fullName,
      phone: phone || null,
      landlinePhone: landlinePhone || null,
      dateOfBirth: dateOfBirth || null,
      marketingEmailOptIn,
      marketingSmsOptIn,
      newPassword: newPassword.trim() || undefined,
    });
    setNewPassword('');
    setMessage('Profile updated.');
  };

  const handleDefaultAddressChange = (id: string) => {
    setDefaultAddressId(id);
    const address = profile?.addresses.find((a) => a.id === id);
    if (!address) return;
    updateAddress.mutate({
      id: address.id,
      req: {
        label: address.label, line1: address.line1, line2: address.line2,
        city: address.city, county: address.county, postcode: address.postcode, isDefault: true,
      },
    });
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('This will permanently delete your account and log you out. This cannot be undone. Continue?')) return;
    await deleteAccount.mutateAsync();
    customerAuth.clear();
    navigate('/');
  };

  if (!profile) return <p className="text-sm text-brand-cream/60">Loading your profile...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h1 className="font-display text-2xl mb-1 flex items-center gap-2"><User className="w-6 h-6" />My Profile</h1>
        <p className="text-sm text-brand-bg/70 mb-6">This page allows you to keep your account information up to date.</p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <h2 className="font-semibold border-b border-brand-bg/10 pb-2">Your Information</h2>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Title</label>
            <select value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm">
              <option value="">—</option>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Date of Birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Email</label>
            <input value={profile.email} disabled className="rounded border border-brand-bg/20 px-3 py-2 text-sm bg-brand-bg/5 text-brand-bg/50" />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              minLength={8}
              className="rounded border border-brand-bg/20 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-brand-bg/60">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Show Password
          </label>

          <h2 className="font-semibold border-b border-brand-bg/10 pb-2 pt-2">Default Contact &amp; Delivery Details</h2>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Default Address</label>
            <select value={defaultAddressId} onChange={(e) => handleDefaultAddressChange(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm">
              <option value="">No default address</option>
              {profile.addresses.map((a) => (
                <option key={a.id} value={a.id}>{a.label ? `${a.label}, ` : ''}{a.line1}, {a.postcode}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Mobile Number</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <label className="text-sm">Landline</label>
            <input value={landlinePhone} onChange={(e) => setLandlinePhone(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
          </div>

          <h2 className="font-semibold border-b border-brand-bg/10 pb-2 pt-2">Notification &amp; Marketing Preferences</h2>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={marketingEmailOptIn} onChange={(e) => setMarketingEmailOptIn(e.target.checked)} />
            I want to receive promotional emails
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={marketingSmsOptIn} onChange={(e) => setMarketingSmsOptIn(e.target.checked)} />
            I want to receive promotional SMS
          </label>

          {message && <p className="text-sm text-brand-green">{message}</p>}

          <button type="submit" disabled={updateProfile.isPending} className="bg-brand-green text-white rounded px-5 py-2.5 text-sm font-medium disabled:opacity-50">
            {updateProfile.isPending ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h2 className="font-display text-lg mb-2">Delete Your Account</h2>
        <p className="text-sm text-brand-bg/70 mb-2">
          If you'd like to completely delete your account, click the button below. Please note that:
        </p>
        <ul className="text-xs text-brand-bg/60 list-disc pl-5 space-y-1 mb-4">
          <li>This will take effect immediately and log you out straight away</li>
          <li>This action cannot be undone</li>
          <li>Any loyalty points will be lost</li>
          <li>You'll be able to register again if you change your mind</li>
          <li>Order transaction information is retained for financial and legal purposes</li>
        </ul>
        <button
          onClick={handleDeleteAccount}
          disabled={deleteAccount.isPending}
          className="inline-flex items-center gap-2 bg-red-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />Delete My Account
        </button>
      </div>
    </div>
  );
}
