# Restaurant POS: UAT sign-off checklist

Run this on the UAT stack with real hardware before each release to live:
- a Windows PC as the main till
- an Android tablet on the same Wi-Fi
- the receipt printer, plus a kitchen and a bar network printer if the shop has them

Tick each line. Anything that fails goes back for fixing before sign-off.

**UAT addresses:**
- Admin: `adminuat.porttennanttandoori.co.uk`
- Super-admin: `superadminuat.porttennanttandoori.co.uk`
- API: `apiuat.porttennanttandoori.co.uk`

## 1. Install and pair the till
- [ ] Run `RestaurantPOS-Setup-2.0.0.exe`. It installs (or upgrades My POS) and starts the till.
- [ ] Register the till in the admin (POS settings → Register till), or ask the platform owner to.
- [ ] Pair it on the till: Server = Test (UAT), then the device ID and secret. The menu, tables and staff appear.
- [ ] The licence banner is clear (the subscription is active).

## 2. Set up from the till (no admin site needed)
Sign in as an Owner or Manager, then open **Manage**.
- [ ] Add a category, rename it, hide it, then show it again. Drag it to a new place in the list.
- [ ] Add a dish with a price and set its ticket to Bar. Edit the price.
- [ ] Mark a dish **Sold out**. It greys out on the order screen and on the tablet.
- [ ] Add an option group (e.g. Rice, must pick 1) with two choices, one costing extra.
- [ ] Add a table, then edit its seats.
- [ ] Add a Waiter with a PIN, and add a Cashier with a PIN.
- [ ] Add the kitchen and bar printers by IP address.
- [ ] In the admin site, every change above shows up, and an edit made in the admin reaches the till within a minute.

## 3. Taking orders at the till
- [ ] Sign in with a cashier PIN; a wrong PIN is refused.
- [ ] Table → guests → dishes → options and a note → **Send**. One kitchen ticket and one bar ticket print.
- [ ] Void a sent dish (cashier: a manager PIN is asked for). A VOID ticket prints.
- [ ] Turn the kitchen printer off and send a dish. The red banner appears; turn the printer on, then Retry. The ticket prints.
- [ ] Discount (cashier: manager PIN), then **Bill**, then pay part by card and the rest by cash. The change is shown, the drawer opens and the receipt prints.
- [ ] A takeaway order works the same way, without a table.
- [ ] Orders → reprint a receipt. Refund part of it (manager); it can't exceed what was paid.
- [ ] Day report shows these sales; print it.

## 4. Waiter tablet
- [ ] Install the APK on the tablet. It opens as a waiter tablet.
- [ ] On the till: Settings → Waiter tablets → Pair a tablet. Type the address and code on the tablet. It connects.
- [ ] Sign in with the waiter PIN on the tablet. Tables match the till.
- [ ] Order for a table with options and a note, then Send. Tickets print, and the order appears on the till straight away.
- [ ] Mark the dish Ready on the till. The tablet shows "1 ready" within a few seconds. Mark it Served on the tablet.
- [ ] Turn the tablet's Wi-Fi off and on. It reconnects by itself, and the basket is kept if sending failed.
- [ ] Pay the table on the till. It turns free on the tablet.
- [ ] Unpair the tablet on the till. The tablet goes back to its pairing screen.

## 5. Offline
- [ ] Unplug the till's internet. The status shows Offline; take three orders, pay them and print receipts.
- [ ] Tablets keep working (they only need the shop Wi-Fi).
- [ ] Plug the internet back in. Within a minute the outbox is empty and the orders are in admin Reports, each once.

## 6. Subscription and devices (super-admin)
- [ ] Set the restaurant's subscription to end yesterday with 0 grace days, then Sync on the till. New orders are paused and open orders can still be paid.
- [ ] Record a payment. After a sync, selling works again.
- [ ] Switch off **Waiter tablets** for the restaurant. Pairing a new tablet is refused.
- [ ] Devices lists the till and the tablet, with last-seen times.

## 7. Recovery
- [ ] Close the till mid-order and reopen it. The open order, the queued tickets and the outbox are all still there.
- [ ] `%APPDATA%\…\backups` (the app's support folder) holds today's `pos-YYYY-MM-DD.db`.

**Signed off by:** ______________________  **Date:** __________
