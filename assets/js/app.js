import { el, clear } from "./dom.js";
import { renderers } from "./pages.js";

const THEME_KEY = "st-theme";

async function loadSite() {
  const response = await fetch("/assets/data/site.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Unable to load site data");
  return response.json();
}

function currentTheme() {
  return localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function formatClock(timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(new Date());
}

function mountHeader(site, page) {
  const nav = el("nav", { class: "nav-links", "aria-label": "Primary" },
    site.nav.map((item) =>
      el("a", {
        href: item.href,
        "aria-current": item.id === page ? "page" : null
      }, item.label)
    )
  );

  const clock = el("div", { class: "clock", dataset: { tz: site.profile.timezone } }, formatClock(site.profile.timezone));
  const themeBtn = el("button", {
    class: "icon-btn",
    type: "button",
    "aria-label": "Toggle theme",
    title: "Toggle theme"
  }, "◐");
  themeBtn.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  });

  const paletteBtn = el("button", {
    class: "icon-btn palette-btn",
    type: "button",
    "aria-label": "Open command palette",
    title: "Search pages (Ctrl+K)"
  }, "⌘");
  paletteBtn.addEventListener("click", () => document.dispatchEvent(new CustomEvent("st:palette")));

  const menuBtn = el("button", {
    class: "icon-btn menu-btn",
    type: "button",
    "aria-expanded": "false",
    "aria-controls": "mobile-nav",
    "aria-label": "Open menu"
  }, "☰");

  const mobile = el("div", { id: "mobile-nav", class: "mobile-nav" },
    site.nav.map((item) =>
      el("a", {
        href: item.href,
        "aria-current": item.id === page ? "page" : null
      }, item.label)
    )
  );
  menuBtn.addEventListener("click", () => {
    const open = mobile.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });

  const header = el("header", { class: "site-header" }, [
    el("div", { class: "wrap header-inner" }, [
      el("a", { class: "brand", href: "/" }, [
        el("span", { class: "brand-dot", "aria-hidden": "true" }),
        `${site.profile.handle}:~#`
      ]),
      nav,
      el("div", { class: "header-actions" }, [clock, paletteBtn, themeBtn, menuBtn])
    ])
  ]);

  const mount = document.getElementById("site-header");
  clear(mount);
  mount.append(header, mobile);

  setInterval(() => {
    clock.textContent = formatClock(site.profile.timezone);
  }, 30000);
}

function mountFooter(site) {
  const year = new Date().getFullYear();
  const footer = el("footer", { class: "site-footer" }, [
    el("div", { class: "wrap footer-inner" }, [
      el("p", {}, `© ${year} ${site.profile.name} · GitHub Pages · data-driven, not a single static file`),
      el("div", { class: "footer-links" }, [
        el("a", { href: site.profile.links.github, target: "_blank", rel: "noreferrer" }, "GitHub"),
        el("a", { href: site.profile.links.linkedin, target: "_blank", rel: "noreferrer" }, "LinkedIn"),
        el("button", { class: "icon-btn footer-cmd", type: "button" }, "Ctrl+K")
      ])
    ])
  ]);
  footer.querySelector("button").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("st:palette"));
  });
  const mount = document.getElementById("site-footer");
  clear(mount);
  mount.append(footer);
}

function mountPalette(site) {
  const items = [
    ...site.nav,
    { id: "github", href: site.profile.links.github, label: "Open GitHub" },
    { id: "linkedin", href: site.profile.links.linkedin, label: "Open LinkedIn" }
  ];
  const input = el("input", { type: "search", placeholder: "Jump to a page…", "aria-label": "Command palette" });
  const list = el("div", { class: "palette-list", role: "listbox" });
  const box = el("div", { class: "palette-box" }, [input, list]);
  const overlay = el("div", { class: "palette", role: "dialog", "aria-label": "Command palette" }, [box]);

  let index = 0;
  let visible = items;

  const paint = () => {
    const query = input.value.trim().toLowerCase();
    visible = items.filter((item) => item.label.toLowerCase().includes(query));
    index = 0;
    clear(list);
    visible.forEach((item, i) => {
      const btn = el("button", {
        type: "button",
        role: "option",
        "aria-selected": i === index ? "true" : "false"
      }, item.label);
      btn.addEventListener("click", () => go(item));
      list.append(btn);
    });
  };

  const go = (item) => {
    overlay.classList.remove("open");
    if (item.href.startsWith("http")) window.open(item.href, "_blank", "noreferrer");
    else window.location.href = item.href;
  };

  const open = () => {
    overlay.classList.add("open");
    input.value = "";
    paint();
    input.focus();
  };

  input.addEventListener("input", paint);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      index = Math.min(visible.length - 1, index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      index = Math.max(0, index - 1);
    } else if (event.key === "Enter" && visible[index]) {
      event.preventDefault();
      go(visible[index]);
    } else if (event.key === "Escape") {
      overlay.classList.remove("open");
    }
    [...list.children].forEach((node, i) => node.setAttribute("aria-selected", String(i === index)));
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.classList.remove("open");
  });
  document.addEventListener("st:palette", open);
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      open();
    }
    if (event.key === "Escape") overlay.classList.remove("open");
  });

  document.body.append(overlay);
}

function setSeo(site, page) {
  const titleMap = {
    home: site.profile.name,
    about: `About · ${site.profile.name}`,
    projects: `Projects · ${site.profile.name}`,
    experience: `Experience · ${site.profile.name}`,
    stack: `Stack · ${site.profile.name}`,
    notes: `Notes · ${site.profile.name}`,
    contact: `Contact · ${site.profile.name}`,
    notfound: `Not found · ${site.profile.name}`
  };
  document.title = `${titleMap[page] || site.profile.name} | ${site.profile.role}`;
}

async function boot() {
  applyTheme(currentTheme());
  const main = document.getElementById("main");
  const page = main?.dataset.page || "home";

  try {
    const site = await loadSite();
    setSeo(site, page);
    mountHeader(site, page);
    mountFooter(site);
    mountPalette(site);
    const render = renderers[page] || renderers.notfound;
    await render(main, site);
  } catch (error) {
    main.append(document.createTextNode("The site data failed to load. Refresh, or check that /assets/data/site.json is reachable."));
    console.error(error);
  }
}

boot();
