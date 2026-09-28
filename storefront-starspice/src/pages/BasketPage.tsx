import { Link, useNavigate } from 'react-router-dom';
import { useRestaurant } from '@shared/lib/queries';
import { useCartStore } from '@shared/store/cart';
import { BasketBody, useValidOrderType } from '../components/Basket';
import { isOrderingOpen, usePageTitle } from '../lib/site';

/** The header "Basket" button's page: the whole order on its own, then on to checkout. */
export default function BasketPage() {
  usePageTitle('Your basket');
  const navigate = useNavigate();
  const { data: restaurant } = useRestaurant();
  const count = useCartStore((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  useValidOrderType(restaurant);

  if (restaurant && !isOrderingOpen(restaurant)) {
    return (
      <div className="wrap not-found">
        <p className="eyebrow">BASKET</p>
        <h1>Not open for orders yet.</h1>
        <p>We’re preparing to reopen. Have a look at the menu in the meantime.</p>
        <Link className="button" to="/menu">View the menu <span aria-hidden="true">→</span></Link>
      </div>
    );
  }

  return (
    <>
      <div className="wrap page-intro menu-intro">
        <p className="eyebrow">YOUR BASKET</p>
        <h1>{count > 0 ? 'Ready when you are.' : 'Nothing here yet.'}</h1>
        <p>{count > 0 ? 'Check your dishes, choose collection or delivery, then head to checkout.' : 'Add a few dishes from the menu and they’ll appear here.'}</p>
      </div>
      <div className="paper">
        <div className="wrap basket-page">
          {restaurant && (
            <div className="basket basket-standalone">
              <BasketBody restaurant={restaurant} onCheckout={() => navigate('/checkout')} />
            </div>
          )}
          <p className="basket-page-back">
            <Link to="/menu" className="text-link">{count > 0 ? 'Add more from the menu' : 'Go to the menu'} <span aria-hidden="true">→</span></Link>
          </p>
        </div>
      </div>
    </>
  );
}
