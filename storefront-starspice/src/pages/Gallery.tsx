import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/site';

/**
 * Replaces "Our story" at the client's request. There are no official photos yet, so the
 * page says so plainly; the photo grid goes here once the client's own photography arrives.
 */
export default function Gallery() {
  usePageTitle('Gallery');
  return (
    <>
      <div className="wrap page-intro">
        <p className="eyebrow">GALLERY</p>
        <h1>Photos coming soon.</h1>
        <p>A look at our food, our kitchen and our place in Tumble.</p>
      </div>
      <section className="paper">
        <div className="wrap gallery-empty">
          <div className="gallery-placeholder" aria-hidden="true">
            <span /><span /><span /><span /><span /><span />
          </div>
          <div className="gallery-notice" role="status">
            <p className="eyebrow">NO OFFICIAL PHOTOS YET</p>
            <h2>We haven’t added any official images yet.</h2>
            <p>Our own photos of the food and restaurant are on their way and will appear here as soon as they’re ready. Any pictures elsewhere on the site are illustrative only.</p>
            <Link className="text-link" to="/menu">See the menu in the meantime <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
