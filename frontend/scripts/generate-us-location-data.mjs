/**
 * Builds public JSON for US state/city/ZIP dropdowns from the zipcodes package.
 * Run: node scripts/generate-us-location-data.mjs
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const zipcodes = require("zipcodes");
const zipStates = require("zipcodes/lib/states");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outBase = join(root, "public", "data", "us");
const citiesDir = join(outBase, "cities");
/** Laravel reads these for server-side city/state/ZIP validation. */
const backendUsBase = join(root, "..", "backend", "resources", "data", "us");
const backendCitiesDir = join(backendUsBase, "cities");

/** US states + DC (excludes territories and Canadian provinces in zipcodes). */
const US_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

function titleCaseStateName(upperFull) {
  return upperFull
    .split(" ")
    .map((w) => (w.length ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");
}

mkdirSync(citiesDir, { recursive: true });
mkdirSync(backendCitiesDir, { recursive: true });

const statesPayload = US_STATE_CODES.map((code) => {
  const full = zipStates.abbr[code];
  const name = full ? titleCaseStateName(full) : code;
  return { code, name };
}).sort((a, b) => a.name.localeCompare(b.name));

const statesJson = JSON.stringify({ states: statesPayload });
writeFileSync(join(outBase, "states.json"), statesJson, "utf8");
writeFileSync(join(backendUsBase, "states.json"), statesJson, "utf8");

for (const stateCode of US_STATE_CODES) {
  const rows = zipcodes.lookupByState(stateCode).filter((r) => r && r.country === "US");
  const byCity = new Map();
  for (const r of rows) {
    const cityName = String(r.city || "").trim();
    if (!cityName) continue;
    if (!byCity.has(cityName)) byCity.set(cityName, new Set());
    const z = String(r.zip || "").trim();
    if (z) byCity.get(cityName).add(z);
  }
  const cities = [...byCity.entries()]
    .map(([name, zips]) => ({
      name,
      zips: [...zips].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cityJson = JSON.stringify({ cities });
  writeFileSync(join(citiesDir, `${stateCode}.json`), cityJson, "utf8");
  writeFileSync(join(backendCitiesDir, `${stateCode}.json`), cityJson, "utf8");
}

console.log(
  `Wrote ${US_STATE_CODES.length} city files + states.json under public/data/us/ and backend/resources/data/us/`,
);
