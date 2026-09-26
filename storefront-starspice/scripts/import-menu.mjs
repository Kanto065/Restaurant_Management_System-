#!/usr/bin/env node
// Imports the client's provisional menu (star-spice/content/menu.json) into a restaurant via
// its admin API, so the owner starts with the sample dishes instead of an empty menu.
//
//   ADMIN_URL=https://admin.starspicetumble.co.uk \
//   STAFF_EMAIL=owner@... STAFF_PASSWORD=... \
//   node scripts/import-menu.mjs "../../star-spice/content/menu.json"
//
// Safe to re-run: categories/dishes that already exist by name are skipped. Imports names,
// descriptions, prices and category notes only - protein choices, dietary flags and allergens
// aren't confirmed by the client yet, so the owner adds those in the admin.

import fs from 'node:fs';

const adminUrl = (process.env.ADMIN_URL ?? '').replace(/\/$/, '');
const email = process.env.STAFF_EMAIL;
const password = process.env.STAFF_PASSWORD;
const menuPath = process.argv[2];
if (!adminUrl || !email || !password || !menuPath) {
  console.error('Usage: ADMIN_URL=... STAFF_EMAIL=... STAFF_PASSWORD=... node scripts/import-menu.mjs <menu.json>');
  process.exit(1);
}

const menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
let token;

async function call(method, path, body) {
  const res = await fetch(adminUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${json?.message ?? JSON.stringify(json?.errors ?? json)}`);
  return json?.data;
}

token = (await call('POST', '/api/auth/staff/login', { email, password })).accessToken;

const existingCategories = await call('GET', '/api/admin/menu-categories');
let createdCategories = 0, createdItems = 0, skipped = 0;

for (const [ci, category] of menu.categories.entries()) {
  let cat = existingCategories.find((c) => c.name.toLowerCase() === category.name.toLowerCase());
  if (!cat) {
    cat = await call('POST', '/api/admin/menu-categories', {
      name: category.name, description: category.note ?? null, imageUrl: null, displayOrder: ci, isActive: true,
    });
    createdCategories++;
  }

  const existingItems = (await call('GET', `/api/admin/menu-items?categoryId=${cat.id}`)) ?? [];
  for (const [di, dish] of category.dishes.entries()) {
    if (existingItems.some((i) => i.name.toLowerCase() === dish.name.toLowerCase() && i.categoryId === cat.id)) {
      skipped++;
      continue;
    }
    await call('POST', '/api/admin/menu-items', {
      categoryId: cat.id, name: dish.name, description: dish.description ?? null, basePrice: dish.price, imageUrl: null,
      isVegetarian: false, isVegan: false, isBestSeller: false, spiceLevel: 'None', isAvailable: true,
      displayOrder: di, preparationTimeMinutes: 20,
    });
    createdItems++;
  }
}

console.log(`Done: ${createdCategories} categories and ${createdItems} dishes created, ${skipped} dishes already existed.`);
