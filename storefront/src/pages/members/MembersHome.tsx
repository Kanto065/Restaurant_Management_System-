import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useProfile } from '../../lib/queries';

export default function MembersHome() {
  const { data: profile } = useProfile();
  const firstName = profile?.fullName?.split(' ')[0] ?? '';

  return (
    <div className="space-y-4">
      <div className="bg-brand-mint/20 rounded-lg p-6">
        <h1 className="font-display text-3xl mb-2">Hello{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="text-sm text-brand-cream/80">
          Welcome to the members section. Here you will find all of your orders with us. Feel free to{' '}
          <Link to="/contact-us" className="underline">contact us</Link> if you need some help.
        </p>
      </div>

      <div className="bg-brand-cream text-brand-bg rounded-lg p-6">
        <h2 className="font-display text-xl mb-2 flex items-center gap-2"><Trophy className="w-5 h-5" />Loyalty Points</h2>
        <p className="text-sm text-brand-bg/70 mb-4">
          Earn points when you order online. You can redeem these points for discounts on future orders. Visit your
          loyalty area to read more about the scheme.
        </p>
        <Link to="/account/loyalty" className="inline-flex items-center gap-2 bg-brand-green text-white rounded px-4 py-2 text-sm font-medium">
          <Trophy className="w-4 h-4" />Access Loyalty Area »
        </Link>
      </div>
    </div>
  );
}
