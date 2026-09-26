import { Link } from 'react-router-dom';
import { useRestaurant } from '@shared/lib/queries';
import { confirmed, isOrderingOpen, sortedOpeningHours, usePageTitle } from '../lib/site';

export default function FindUs() {
  usePageTitle('Find us');
  const { data: restaurant } = useRestaurant();
  const orderingOpen = isOrderingOpen(restaurant);

  const line1 = confirmed(restaurant?.addressLine1);
  const postcode = confirmed(restaurant?.postcode);
  const address = line1
    ? [line1, confirmed(restaurant?.addressLine2), restaurant?.city, postcode].filter(Boolean).join(', ')
    : null;
  const mapQuery = encodeURIComponent(address ?? 'Tumble, Carmarthenshire, Wales');
  const hours = sortedOpeningHours(restaurant?.openingHours ?? []);
  const phone = confirmed(restaurant?.phone);
  const email = confirmed(restaurant?.email);

  return (
    <>
      <div className="wrap page-intro">
        <p className="eyebrow">FIND US</p>
        <h1>Rooted in Tumble.</h1>
        <p>
          {orderingOpen
            ? 'Our next chapter starts here in Tumble, Carmarthenshire.'
            : 'Our next chapter starts here in Tumble, Carmarthenshire. We’re preparing to reopen and look forward to sharing the details.'}
        </p>
      </div>
      <section className="paper">
        <div className="wrap find-layout">
          <div className="place-panel">
            <div>
              <p className="eyebrow">CARMARTHENSHIRE · WALES</p>
              <h2>Tumble.</h2>
              <p>{address ?? 'The full takeaway address will be added once confirmed.'}</p>
            </div>
            <a className="text-link" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
              {address ? 'View on Google Maps' : 'View Tumble on Google Maps'} <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <dl className="details-list">
            {!orderingOpen && (
              <div><dt>Reopening</dt><dd>Date to be announced<span>We’re currently preparing to reopen.</span></dd></div>
            )}
            <div>
              <dt>Opening hours</dt>
              <dd>
                {hours.length === 0 ? 'To be confirmed' : (
                  <table className="hours">
                    <tbody>
                      {hours.map((h) => (
                        <tr key={h.dayOfWeek}>
                          <th scope="row">{h.dayOfWeek}</th>
                          <td>{h.isClosed || !h.openTime || !h.closeTime ? 'Closed' : `${h.openTime} – ${h.closeTime}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </dd>
            </div>
            <div>
              <dt>Contact</dt>
              {phone || email ? (
                <dd>
                  {phone && <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>}
                  {email && <span><a href={`mailto:${email}`}>{email}</a></span>}
                </dd>
              ) : (
                <dd>Phone &amp; email coming soon<span>Confirmed contact details will be listed here.</span></dd>
              )}
            </div>
            <div>
              <dt>Ordering</dt>
              {orderingOpen ? (
                <dd>
                  Order online for {[restaurant?.supportsCollection && 'collection', restaurant?.supportsDelivery && 'delivery'].filter(Boolean).join(' or ')}
                  <span><Link to="/menu" style={{ textDecoration: 'underline' }}>Start your order</Link></span>
                </dd>
              ) : (
                <dd>Not available yet<span>Ordering links and collection or delivery details will be added before launch.</span></dd>
              )}
            </div>
          </dl>
        </div>
      </section>
      <section className="wrap section">
        <div className="section-heading">
          <h2>In the meantime,<br />take a look around.</h2>
          <Link className="button" to="/menu">
            {orderingOpen ? 'Order online' : 'Explore the sample menu'} <span className="arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
        {!orderingOpen && <p className="small">We’re opening soon. Business details and the final menu are still being confirmed.</p>}
      </section>
    </>
  );
}
