import { Link } from 'react-router-dom';
import { useMenu, useRestaurant } from '@shared/lib/queries';
import { categoryAnchor, isOrderingOpen, usePageTitle } from '../lib/site';

// The client's static index, shown until the live menu loads (or if it's empty).
const FALLBACK_INDEX = [
  { anchor: 'to-start', name: 'To start', sample: 'Onion bhaji · Samosa · Chicken tikka' },
  { anchor: 'bangladeshi-specialities', name: 'Bangladeshi specialities', sample: 'Shatkora · Bhuna · Jalfrezi' },
  { anchor: 'the-curry-classics', name: 'The curry classics', sample: 'Korma · Madras · Dhansak' },
  { anchor: 'from-the-tandoor', name: 'From the tandoor', sample: 'Tikka · Tandoori chicken · Mixed grill' },
  { anchor: 'biryani', name: 'Biryani', sample: 'Chicken · Lamb · Vegetable' },
  { anchor: 'on-the-side', name: 'On the side', sample: 'Rice · Naan · Vegetable sides' },
];

export default function Home() {
  usePageTitle(null);
  const { data: restaurant } = useRestaurant();
  const { data: menu } = useMenu();
  const orderingOpen = isOrderingOpen(restaurant);

  const liveIndex = (menu?.categories ?? [])
    .filter((c) => c.items.length > 0)
    .slice(0, 6)
    .map((c) => ({ anchor: categoryAnchor(c), name: c.name, sample: c.items.slice(0, 3).map((i) => i.name).join(' · ') }));
  const index = liveIndex.length > 0 ? liveIndex : FALLBACK_INDEX;

  return (
    <>
      <div className="wrap">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">STAR SPICE · TUMBLE, CARMARTHENSHIRE</p>
            <h1>Indian &amp;<br /> Bangladeshi<br /> takeaway <em>in Tumble.</em></h1>
            {orderingOpen ? (
              <p className="hero-desc">A new chapter for a familiar name.<br />Order online for collection{restaurant?.supportsDelivery ? ' or delivery' : ''}.</p>
            ) : (
              <p className="hero-desc">A new chapter for a familiar name.<br />Discover a first taste of Star Spice as we prepare to reopen.</p>
            )}
            <div className="actions">
              <Link className="button" to="/menu">
                {orderingOpen ? 'Order online' : 'Explore the menu'} <span className="arrow" aria-hidden="true">↗</span>
              </Link>
              <Link className="text-link" to="/story">Our story <span aria-hidden="true">→</span></Link>
            </div>
            {!orderingOpen && <p className="hero-note">Reopening date to be announced.</p>}
          </div>
          <figure className="hero-photo">
            <img src="/assets/feast.webp" srcSet="/assets/feast-small.webp 800w, /assets/feast.webp 1440w"
              sizes="(max-width:760px) 100vw, 50vw" alt="Illustrative spread of curries, basmati rice and naan"
              width={1440} height={960} fetchPriority="high" />
            <span className="photo-label">A taste of what’s to come</span>
            <figcaption>AI-generated illustrative image · Our own food photography is coming.</figcaption>
          </figure>
        </section>
        <div className="hero-meta">
          <span>Indian roots. Bangladeshi character.</span>
          <span>Looking ahead to our next chapter</span>
        </div>
      </div>

      <section className="paper">
        <div className="wrap intro">
          <div>
            <p className="eyebrow">FROM CYMRU BALTI TO STAR SPICE</p>
            <h2>A familiar place.<br />A fresh beginning.</h2>
          </div>
          <div className="prose">
            <p className="lead">You may know us as Cymru Balti. We’re preparing for our next chapter as Star Spice.</p>
            <p>Our plans bring Indian and Bangladeshi cooking together here in Tumble. The new menu is taking shape, and we’ll share our reopening details when they’re ready.</p>
            <Link className="text-link" to="/story">Get to know Star Spice <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A FIRST LOOK</p>
            <h2>Find your next favourite.</h2>
          </div>
          <p>From the first bite to the last piece of naan. Explore a sample of the menu we’re developing.</p>
        </div>
        <div className="menu-index">
          {index.map((c, i) => (
            <Link key={c.anchor} to={`/menu#${c.anchor}`}>
              <span className="number">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{c.name}</h3>
                <p>{c.sample}</p>
              </div>
              <span className="arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
        <div className="section-tail">
          <p className="small">
            {orderingOpen ? 'Prices and availability are shown on the full menu.' : 'Sample dishes only. Our final menu and prices are still being confirmed.'}
          </p>
          <Link className="text-link" to="/menu">
            {orderingOpen ? 'View the full menu' : 'View the sample menu'} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="relaunch">
        <div className="wrap relaunch-inner">
          <div>
            <p className="eyebrow">BACK TO TUMBLE</p>
            <h2>Good things take<br />a little preparation.</h2>
          </div>
          <div>
            <p>We’re getting ready for a fresh start. Opening hours, ordering details and our reopening date will be shared once confirmed.</p>
            <Link className="text-link" to="/find-us">Find us &amp; reopening information <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
