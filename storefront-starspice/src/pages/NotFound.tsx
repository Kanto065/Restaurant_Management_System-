import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/site';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <div className="wrap not-found">
      <p className="eyebrow">PAGE NOT FOUND</p>
      <h1>Let’s head back.</h1>
      <p>This page isn’t on the menu.</p>
      <Link className="button" to="/">Back to Star Spice <span aria-hidden="true">→</span></Link>
    </div>
  );
}
