# Star Spice storefront

Customer website for Star Spice (starspicetumble.co.uk): the client's handed-over design
(charcoal/ivory/gold, Fraunces + Public Sans) with online ordering on the shared platform API.

- `src/styles.css` is the client's stylesheet, unchanged. `src/ordering.css` adds basket,
  checkout and account styles in the same visual language.
- The data layer (API client, React Query hooks, basket store, types) is shared with the
  Port Tennant storefront: imported from `../storefront/src` via the `@shared` alias.
- Ordering switches on when the restaurant enables Collection or Delivery in its admin;
  until then the menu is browsable with the client's "preparing to reopen" notices.

## Develop

    npm install
    npm run dev          # http://localhost:5180, proxies /api to the API on :5029

The API resolves the restaurant from the Host header, so for local dev add `localhost` as a
Storefront domain of the Star Spice restaurant (super admin panel -> Domains).

## Import the client's sample menu

    ADMIN_URL=https://admin.starspicetumble.co.uk STAFF_EMAIL=... STAFF_PASSWORD=... \
      node scripts/import-menu.mjs path/to/star-spice/content/menu.json

## Docker

Built from the repo root (`docker build -f storefront-starspice/Dockerfile .`).
