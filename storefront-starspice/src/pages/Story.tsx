import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/site';

export default function Story() {
  usePageTitle('Our story');
  return (
    <>
      <div className="wrap page-intro">
        <p className="eyebrow">OUR STORY</p>
        <h1>New name.<br />Same place in our hearts.</h1>
        <p>From Cymru Balti to Star Spice. We’re looking ahead to a fresh beginning here in Tumble.</p>
      </div>
      <section className="paper">
        <div className="wrap story-layout">
          <div className="story-marker">
            Cymru Balti<span>Star Spice</span>
            <p style={{ fontFamily: 'var(--body)', fontSize: '.8125rem', letterSpacing: 0, marginTop: 15 }}>Tumble, Carmarthenshire</p>
          </div>
          <div className="story-copy">
            <h2>The next chapter.</h2>
            <p>Star Spice is the planned next chapter for Cymru Balti, our family’s takeaway in Tumble. As we prepare to reopen, we’re bringing a new name and a fresh look to the business.</p>
            <p>There’s still preparation to do. Our menu is being developed, and we’ll share the reopening date, opening hours and ordering details when they’re confirmed.</p>
            <h2>Indian &amp; Bangladeshi.</h2>
            <p>Both belong at the heart of Star Spice. Our draft menu brings familiar curries, tandoori dishes and biryanis together with Bangladeshi specialities.</p>
            <p>For now, the menu gives you a first look at that direction. The dishes and prices are provisional, and the photography is illustrative while we prepare our own.</p>
            <Link className="text-link" to="/menu">Explore the sample menu <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
      <figure className="sub-hero-photo">
        <img src="/assets/feast.webp" alt="Illustrative Indian and Bangladeshi meal with curries, rice and naan" width={1440} height={960} loading="lazy" />
        <figcaption>AI-generated illustrative image · Not a photograph of our food.</figcaption>
      </figure>
      <section className="wrap story-quote">
        <p className="eyebrow">LOOKING AHEAD</p>
        <p>A fresh beginning,<br />right here in Tumble.</p>
        <Link className="text-link" to="/find-us" style={{ marginTop: 25 }}>Reopening information <span aria-hidden="true">→</span></Link>
      </section>
    </>
  );
}
