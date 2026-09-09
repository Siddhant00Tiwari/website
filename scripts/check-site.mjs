import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function mustExist(rel) {
  if (!existsSync(join(root, rel))) fail(`missing file: ${rel}`);
}

const site = JSON.parse(readFileSync(join(root, "assets/data/site.json"), "utf8"));
const pages = [
  ["index.html", "home"],
  ["about.html", "about"],
  ["projects.html", "projects"],
  ["experience.html", "experience"],
  ["stack.html", "stack"],
  ["notes.html", "notes"],
  ["contact.html", "contact"],
  ["404.html", "notfound"]
];

mustExist("CNAME");
mustExist(".nojekyll");
mustExist("assets/css/style.css");
mustExist("assets/js/app.js");
mustExist("assets/js/pages.js");
mustExist("assets/js/github.js");
mustExist("assets/js/dom.js");
mustExist("assets/favicon.svg");

const cname = readFileSync(join(root, "CNAME"), "utf8").trim();
if (cname !== "siddhant-tiwari.com") fail(`unexpected CNAME: ${cname}`);

if (!site.profile?.githubUser) fail("site.json missing profile.githubUser");
if (!Array.isArray(site.nav) || site.nav.length < 5) fail("site.json nav is too small");
if (!Array.isArray(site.projects) || site.projects.length < 3) fail("site.json needs featured projects");
if (!Array.isArray(site.notes) || site.notes.length < 3) fail("site.json needs notes");

for (const item of site.nav) {
  const file = item.href === "/" ? "index.html" : item.href.replace(/^\//, "");
  mustExist(file);
}

for (const [file, page] of pages) {
  mustExist(file);
  const html = readFileSync(join(root, file), "utf8");
  if (!html.includes(`data-page="${page}"`)) fail(`${file} missing data-page=${page}`);
  if (!html.includes("/assets/js/app.js")) fail(`${file} missing app.js module`);
  if (!html.includes("/assets/css/style.css")) fail(`${file} missing stylesheet`);
  if (html.includes("cdn.tailwindcss.com")) fail(`${file} still loads Tailwind CDN`);
}

const robots = readFileSync(join(root, "robots.txt"), "utf8");
if (robots.includes("Disallow: /")) fail("robots.txt still blocks the whole site");

if (errors.length) {
  console.error(errors.map((line) => `FAIL ${line}`).join("\n"));
  process.exit(1);
}

console.log(`OK ${pages.length} pages, ${site.nav.length} nav items, GitHub user ${site.profile.githubUser}`);
