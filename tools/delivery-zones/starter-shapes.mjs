// Rough starter outlines for Port Tennant's owner-named delivery zones, for the owner to adjust
// on the admin map. Run: node starter-shapes.mjs  -> starter-shapes.json + starter-shapes.sql
// Apply: psql -v slug=<restaurant slug> -f starter-shapes.sql   (UAT first)
// Gap-free starter shapes: each area's Voronoi cell (the part of the map closer to its seed than to any
// other), capped at CAP_KM around its seed. Areas listed twice at two prices are cut in two across the
// seed, perpendicular to the restaurant->seed direction. Neighbouring shapes share borders exactly.
import fs from "node:fs";
const REST = [51.622011, -3.925698];
const ZONES = [
  ["Port Tennant",1.5,"Port Tennant"], ["St Tomas",2,"SA1 8BS"], ["Hafod",2,"Hafod"], ["Marina",2,"SA1 1UP"],
  ["Sandfields",2,"SA1 3NE"], ["Landore",2.5,"Landore"], ["Bonymaen",3,"Bon-y-maen"], ["Brynhyfryd",3,"Brynhyfryd"],
  ["Brynmill",3,"Brynmill"], ["Manselton",3,"Manselton"], ["May hill",3,"Mayhill"], ["Plasmarl",3,"Plas-marl"],
  ["Sandfields",3,"SA1 3NE"], ["Upland",3,"Uplands"], ["Waun wen",3,"SA1 6DZ"], ["gors avenue",3,"SA1 6HX"],
  ["Bonymaen",4,"Bon-y-maen"], ["Llansamlet",4,"Llansamlet"], ["Sketty",4,"Sketty"], ["Townhill",4,"Townhill"], ["Winch wen",4,"SA1 7LT"],
];
const COLOURS = { 1.5:"#27ae60", 2:"#2f80ed", 2.5:"#9b51e0", 3:"#e8823c", 4:"#eb5757" };
const CAP_KM = 1.5;
const KX = 111.32 * Math.cos(REST[0]*Math.PI/180), KY = 110.574; // km per degree
const toXY = ([la,lo]) => [(lo-REST[1])*KX, (la-REST[0])*KY];
const toLL = ([x,y]) => [+(REST[0]+y/KY).toFixed(6), +(REST[1]+x/KX).toFixed(6)];
const j = async (url) => (await fetch(url)).json();
async function seedOf(q) {
  if (/^[A-Z]{1,2}\d/.test(q)) { const r = await j(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`); return [r.result.latitude, r.result.longitude]; }
  const r = await j(`https://api.postcodes.io/places?q=${encodeURIComponent(q)}&limit=15`);
  const p = r.result.find(x => /Swansea/.test(x.county_unitary||"")); return [p.latitude, p.longitude];
}
// keep the side of line (p·n <= c)
function clip(poly, n, c) {
  const out = [], f = p => p[0]*n[0] + p[1]*n[1] - c;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i+1)%poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa/(fa-fb); out.push([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])]); }
  }
  return out;
}
const seedsLL = {}; for (const [, , q] of ZONES) if (!seedsLL[q]) seedsLL[q] = await seedOf(q);
const seeds = Object.fromEntries(Object.entries(seedsLL).map(([k,v]) => [k, toXY(v)]));
const cells = {};
for (const [q, s] of Object.entries(seeds)) {
  let poly = Array.from({length: 32}, (_, i) => [s[0] + CAP_KM*Math.cos(i*Math.PI/16), s[1] + CAP_KM*Math.sin(i*Math.PI/16)]);
  for (const [q2, t] of Object.entries(seeds)) {
    if (q2 === q) continue;
    const n = [t[0]-s[0], t[1]-s[1]], m = [(s[0]+t[0])/2, (s[1]+t[1])/2];
    poly = clip(poly, n, n[0]*m[0] + n[1]*m[1]);
  }
  cells[q] = poly;
}
const out = [], byQuery = {};
for (const z of ZONES) (byQuery[z[2]] ??= []).push(z);
for (const [q, zs] of Object.entries(byQuery)) {
  const cell = cells[q];
  if (zs.length === 1) { out.push({ name: zs[0][0], fee: zs[0][1], boundary: cell.map(toLL) }); continue; }
  const s = seeds[q], n = [s[0], s[1]]; // restaurant is the origin, so the direction is the seed itself
  const c = n[0]*s[0] + n[1]*s[1];
  const [cheap, dear] = [...zs].sort((a,b)=>a[1]-b[1]);
  out.push({ name: cheap[0], fee: cheap[1], boundary: clip(cell, n, c).map(toLL) });
  out.push({ name: dear[0], fee: dear[1], boundary: clip(cell, [-n[0],-n[1]], -c).map(toLL) });
}
for (const o of out) o.colour = COLOURS[o.fee];
fs.writeFileSync("starter-shapes.json", JSON.stringify(out, null, 1));
console.log(out.map(o => `${o.name} £${o.fee}: ${o.boundary.length} corners`).join("\n"));

// SQL to load the shapes into Port Tennant's existing zones - only zones that don't have a
// shape yet, so re-running it never overwrites the owner's own drawing.
const esc = (s) => s.replace(/'/g, "''");
const sql = ["BEGIN;"];
for (const o of out) {
  sql.push(`UPDATE "DeliveryZones" SET "BoundaryJson" = '${JSON.stringify(o.boundary)}', "Colour" = '${o.colour}', "UpdatedAt" = now()
  WHERE "RestaurantId" = (SELECT "Id" FROM "Restaurants" WHERE "Slug" = :'slug')
    AND btrim("Name") = '${esc(o.name)}' AND "DeliveryFee" = ${o.fee.toFixed(2)} AND NOT "IsDeleted" AND "BoundaryJson" IS NULL;`);
}
sql.push("COMMIT;");
fs.writeFileSync("starter-shapes.sql", sql.join("\n") + "\n");
console.log(`wrote starter-shapes.sql (${out.length} zones)`);
