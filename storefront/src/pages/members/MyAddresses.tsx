import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useCreateAddress, useDeleteAddress } from '../../lib/queries';

export default function MyAddresses() {
  const { data: profile } = useProfile();
  const createAddress = useCreateAddress();
  const deleteAddress = useDeleteAddress();

  const [label, setLabel] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = () => {
    setLabel(''); setLine1(''); setLine2(''); setCity(''); setCounty(''); setPostcode(''); setIsDefault(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAddress.mutateAsync({
      label: label.trim() || null, line1, line2: line2.trim() || null, city, county: county.trim() || null, postcode, isDefault,
    });
    resetForm();
  };

  return (
    <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
      <h1 className="font-display text-2xl mb-1">My Addresses</h1>
      <p className="text-sm text-brand-bg/70 mb-6">This page allows you to add and remove your saved addresses for ease of ordering next time!</p>

      <div className="divide-y divide-brand-bg/10 mb-6">
        {(profile?.addresses ?? []).map((address) => (
          <div key={address.id} className="py-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {address.label || address.line1}{' '}
                {address.isDefault && <span className="text-brand-green text-sm">Default Address</span>}
              </p>
              <p className="text-sm text-brand-bg/70">
                {[address.line1, address.line2, address.city, address.county, address.postcode].filter(Boolean).join(', ')}
              </p>
            </div>
            <button
              onClick={() => deleteAddress.mutate(address.id)}
              aria-label="Delete address"
              className="text-red-600 shrink-0 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        ))}
        {profile && profile.addresses.length === 0 && (
          <p className="text-sm text-brand-bg/60 py-2">No saved addresses yet.</p>
        )}
      </div>

      {profile && profile.addresses.length > 0 && (
        <p className="text-sm text-brand-bg/60 mb-6">
          To change your default address, visit the <Link to="/account/profile" className="underline text-brand-green">My Profile</Link> section.
        </p>
      )}

      <h2 className="font-display text-lg mb-3 border-t border-brand-bg/10 pt-4">Add A New Address</h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <label className="text-sm">Description</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "Home", "Work"' className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <label className="text-sm">Postcode *</label>
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} required placeholder="e.g. SA8 4JN" className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <label className="text-sm">Address Line 1 *</label>
          <input value={line1} onChange={(e) => setLine1(e.target.value)} required className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <label className="text-sm">Address Line 2</label>
          <input value={line2} onChange={(e) => setLine2(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <label className="text-sm">Town *</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} required className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3">
          <label className="text-sm">County</label>
          <input value={county} onChange={(e) => setCounty(e.target.value)} className="rounded border border-brand-bg/20 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Use as Default Address?
        </label>
        <button type="submit" disabled={createAddress.isPending} className="bg-brand-green text-white rounded px-5 py-2.5 text-sm font-medium disabled:opacity-50">
          {createAddress.isPending ? 'Saving...' : 'Save Address'}
        </button>
      </form>
    </div>
  );
}
