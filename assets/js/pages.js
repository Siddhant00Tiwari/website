import { el, clear } from "./dom.js";
import { loadGitHub, formatDate, relativeTime } from "./github.js";

function linkBtn(href, label, className = "btn") {
  return el("a", { class: className, href }, label);
}

function tags(list) {
  return el("div", { class: "tag-row" }, list.map((tag) => el("span", { class: "tag" }, tag)));
}

function countUp(node, target) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = String(target);
    return;
  }
  const start = performance.now();
  const duration = 900;
  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    node.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 3))));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function observeMetrics(root) {
  const nodes = [...root.querySelectorAll("[data-target]")];
  const run = (node) => countUp(node, Number(node.dataset.target || 0));
  if (!("IntersectionObserver" in window)) {
    nodes.forEach(run);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      run(entry.target);
      io.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: "80px 0px" });
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) run(node);
    else io.observe(node);
  });
}

function mountTerminal(host, site, github) {
  const out = el("div", { class: "term-out" });
  const input = el("input", {
    type: "text",
    autocomplete: "off",
    spellcheck: "false",
    "aria-label": "Terminal command"
  });

  const print = (htmlLikeLines) => {
    htmlLikeLines.forEach((line) => {
      const row = el("div");
      row.append(line);
      out.append(row);
    });
    out.scrollTop = out.scrollHeight;
  };

  const line = (text, className) => el("span", { class: className }, text);

  const commands = {
    help: () => [
      line("whoami, stack, certs, projects, github, notes, contact, ls, clear, date")
    ],
    whoami: () => [line(site.profile.summary)],
    stack: () => [line(site.stack.map((group) => `${group.name}: ${group.items.join(", ")}`).join("\n"))],
    certs: () => [line(site.certs.map((cert) => `${cert.name} — ${cert.full}`).join("\n"))],
    projects: () => [line(site.projects.map((project) => project.title).join("\n"))],
    notes: () => [line(site.notes.map((note) => note.title).join("\n"))],
    contact: () => [line(`${site.profile.links.linkedin}\n${site.profile.links.github}`)],
    ls: () => [line(site.nav.map((item) => item.href).join("  "))],
    date: () => [line(new Date().toString())],
    github: () => {
      if (!github.user) return [line("GitHub API is rate-limited or unreachable. Featured projects still load from local data.")];
      return [line(`${github.user.login} · ${github.user.public_repos} public repos · ${github.user.followers} followers\nLatest: ${github.repos.slice(0, 5).map((repo) => repo.name).join(", ")}`)];
    },
    clear: () => {
      clear(out);
      return [];
    }
  };

  const run = (raw) => {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    print([el("div", {}, [line(`${site.profile.handle}:~$ `, "ok"), line(raw, "cmd")])]);
    const handler = commands[value];
    if (!handler) {
      print([line(`command not found: ${raw}. Try help.`)]);
      return;
    }
    const result = handler();
    if (result.length) print(result);
  };

  print([
    el("div", {}, [line(`${site.profile.handle}:~$ `, "ok"), line("whoami", "cmd")]),
    line(site.profile.summary),
    el("div", {}, [line(`${site.profile.handle}:~$ `, "ok"), line("help", "cmd")]),
    line("whoami, stack, certs, projects, github, notes, contact, ls, clear, date")
  ]);

  const form = el("form", { class: "term-form" }, [
    el("span", { class: "ok" }, `${site.profile.handle}:~$`),
    input
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(input.value);
    input.value = "";
  });

  host.append(
    el("div", { class: "terminal-bar" }, [
      el("div", { class: "traffic" }, [el("span"), el("span"), el("span")]),
      el("span", {}, "control-plane — interactive")
    ]),
    el("div", { class: "terminal-body" }, [out, form])
  );
  queueMicrotask(() => input.focus({ preventScroll: true }));
}

async function liveStrip(site) {
  const github = await loadGitHub();
  const status = github.live
    ? `live · fetched ${relativeTime(github.fetchedAt)}`
    : "cached / offline fallback";
  const repos = github.user ? `${github.user.public_repos} public repos` : `${site.projects.length} featured projects`;
  const push = github.repos[0]
    ? `last push ${relativeTime(github.repos[0].pushed_at)} on ${github.repos[0].name}`
    : "GitHub feed unavailable";
  return {
    github,
    node: el("aside", { class: "panel live-strip", "aria-live": "polite" }, [
      el("strong", {}, status),
      el("div", { class: "live-meta" }, [
        el("span", {}, repos),
        el("span", {}, push),
        github.user ? el("span", {}, `${github.user.followers} followers`) : null
      ]),
      linkBtn(site.profile.links.github, "GitHub", "btn")
    ])
  };
}

function projectCard(project) {
  return el("article", { class: "card" }, [
    el("div", { class: "card-kicker" }, project.tags[0]),
    el("h3", {}, project.title),
    el("p", {}, project.blurb),
    project.points ? el("ul", { class: "list" }, project.points.map((point) => el("li", {}, point))) : null,
    tags(project.tags)
  ]);
}

function repoCard(repo) {
  return el("article", { class: "card" }, [
    el("div", { class: "card-kicker" }, repo.language || "repo"),
    el("h3", {}, [
      el("a", { href: repo.html_url, target: "_blank", rel: "noreferrer" }, repo.name)
    ]),
    el("p", {}, repo.description || "No description on GitHub yet."),
    el("div", { class: "tag-row" }, [
      el("span", { class: "tag" }, `★ ${repo.stargazers_count}`),
      el("span", { class: "tag" }, `updated ${relativeTime(repo.pushed_at)}`),
      repo.homepage ? el("a", { class: "tag", href: repo.homepage, target: "_blank", rel: "noreferrer" }, "site") : null
    ])
  ]);
}

export async function renderHome(main, site) {
  const { github, node: strip } = await liveStrip(site);
  const terminal = el("div", { class: "panel terminal" });
  mountTerminal(terminal, site, github);

  main.append(
    el("section", { class: "hero wrap" }, [
      el("div", {}, [
        el("div", { class: "kicker" }, ["Control plane live"]),
        el("h1", {}, [site.profile.name.split(" ")[0], el("br"), el("span", { class: "muted" }, site.profile.name.split(" ")[1])]),
        el("p", { class: "lede" }, site.profile.tagline),
        el("div", { class: "hero-actions" }, [
          linkBtn("/projects.html", "View projects", "btn primary"),
          linkBtn("/contact.html", "Get in touch", "btn")
        ]),
        el("div", { class: "chip-row" }, site.certs.map((cert) => el("span", { class: "chip" }, cert.name)))
      ]),
      terminal
    ]),
    el("div", { class: "wrap" }, strip),
    el("section", { class: "section wrap", id: "impact" }, [
      el("div", { class: "section-head" }, [
        el("h2", {}, "Operational impact"),
        el("a", { class: "muted", href: "/experience.html" }, "Full timeline →")
      ]),
      el("div", { class: "grid-4" }, site.metrics.map((metric) =>
        el("article", { class: "metric" }, [
          el("div", { class: "metric-value" }, [
            metric.display
              ? el("span", {}, metric.display)
              : el("span", { dataset: { target: String(metric.value) } }, "0"),
            metric.suffix && !metric.display ? el("span", {}, metric.suffix) : null
          ]),
          el("div", { class: "metric-label" }, metric.label),
          el("p", {}, metric.detail)
        ])
      ))
    ]),
    el("section", { class: "section wrap" }, [
      el("div", { class: "section-head" }, [
        el("h2", {}, "Featured architecture"),
        el("a", { class: "muted", href: "/projects.html" }, "All work →")
      ]),
      el("div", { class: "grid-2" }, site.projects.slice(0, 4).map(projectCard))
    ])
  );

  observeMetrics(main);
}

export function renderAbout(main, site) {
  main.append(
    el("section", { class: "wrap page-hero" }, [
      el("div", { class: "kicker" }, "About"),
      el("h1", {}, "Build once. Operate on purpose."),
      el("p", {}, site.profile.summary)
    ]),
    el("section", { class: "wrap grid-2" }, [
      el("article", { class: "card" }, [
        el("h3", {}, "Currently"),
        el("p", {}, site.profile.availability),
        el("ul", { class: "list" }, site.focus.map((item) => el("li", {}, item)))
      ]),
      el("article", { class: "card" }, [
        el("h3", {}, "Elsewhere"),
        el("p", {}, `${site.profile.location} · ${site.profile.timezone}`),
        el("div", { class: "hero-actions" }, [
          linkBtn(site.profile.links.github, "GitHub", "btn"),
          linkBtn(site.profile.links.linkedin, "LinkedIn", "btn")
        ])
      ])
    ]),
    el("section", { class: "section wrap" }, [
      el("div", { class: "section-head" }, [el("h2", {}, "Certifications")]),
      el("div", { class: "grid-3" }, site.certs.map((cert) =>
        el("article", { class: "cert" }, [
          el("div", { class: "card-kicker" }, cert.issuer),
          el("h3", {}, cert.name),
          el("p", {}, cert.full)
        ])
      ))
    ])
  );
}

export async function renderProjects(main, site) {
  const github = await loadGitHub();
  const featured = el("div", { class: "grid-2" }, site.projects.map(projectCard));
  const live = el("div", { class: "grid-2" });
  const filters = el("div", { class: "chip-row" });
  const search = el("input", {
    type: "search",
    placeholder: "Filter live repositories",
    "aria-label": "Filter repositories"
  });

  const languages = ["all", ...new Set(github.repos.map((repo) => repo.language).filter(Boolean))];
  let activeLang = "all";

  const paint = () => {
    const query = search.value.trim().toLowerCase();
    const rows = github.repos.filter((repo) => {
      const hay = `${repo.name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase();
      const langOk = activeLang === "all" || repo.language === activeLang;
      return langOk && hay.includes(query);
    });
    clear(live);
    if (!github.repos.length) {
      live.append(el("div", { class: "empty" }, "GitHub did not return repositories. Featured work above is still available."));
      return;
    }
    if (!rows.length) {
      live.append(el("div", { class: "empty" }, "No repositories match that filter."));
      return;
    }
    rows.forEach((repo) => live.append(repoCard(repo)));
  };

  languages.forEach((lang) => {
    const btn = el("button", { class: `filter-btn${lang === "all" ? " active" : ""}`, type: "button" }, lang);
    btn.addEventListener("click", () => {
      activeLang = lang;
      filters.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === btn));
      paint();
    });
    filters.append(btn);
  });
  search.addEventListener("input", paint);
  paint();

  main.append(
    el("section", { class: "wrap page-hero" }, [
      el("div", { class: "kicker" }, "Projects"),
      el("h1", {}, "Architecture plus live GitHub."),
      el("p", {}, "Featured platform work stays in local data. The grid below is fetched from the GitHub API at runtime, so this page changes when repositories change.")
    ]),
    el("section", { class: "wrap" }, [
      el("div", { class: "section-head" }, [el("h2", {}, "Featured")]),
      featured
    ]),
    el("section", { class: "section wrap" }, [
      el("div", { class: "section-head" }, [
        el("h2", {}, "Live from GitHub"),
        el("p", { class: "muted" }, github.live ? `Updated ${formatDate(github.fetchedAt)}` : "Fallback mode")
      ]),
      el("div", { class: "search-row" }, [search, filters]),
      live
    ])
  );
}

export function renderExperience(main, site) {
  main.append(
    el("section", { class: "wrap page-hero" }, [
      el("div", { class: "kicker" }, "Experience"),
      el("h1", {}, "What the metrics are attached to."),
      el("p", {}, "Impact stories from platform work: cost, access, observability, and delivery.")
    ]),
    el("section", { class: "wrap timeline" }, site.experience.map((job) =>
      el("article", { class: "job" }, [
        el("div", {}, [
          el("div", { class: "job-period" }, job.period),
          el("p", { class: "faint" }, job.org)
        ]),
        el("div", {}, [
          el("h3", {}, job.title),
          el("p", {}, job.summary),
          el("ul", { class: "list" }, job.points.map((point) => el("li", {}, point)))
        ])
      ])
    ))
  );
}

export function renderStack(main, site) {
  main.append(
    el("section", { class: "wrap page-hero" }, [
      el("div", { class: "kicker" }, "Stack"),
      el("h1", {}, "Tools that stay in the rotation."),
      el("p", {}, "Grouped the way the work is grouped: cloud, orchestration, delivery, telemetry, access, data.")
    ]),
    el("section", { class: "wrap grid-2" }, site.stack.map((group) =>
      el("article", { class: "card stack-group" }, [
        el("h3", {}, group.name),
        el("div", { class: "stack-items" }, group.items.map((item) => el("span", { class: "chip" }, item)))
      ])
    ))
  );
}

export function renderNotes(main, site) {
  const search = el("input", {
    type: "search",
    placeholder: "Search notes",
    "aria-label": "Search notes"
  });
  const filters = el("div", { class: "chip-row" });
  const list = el("div", { class: "grid-2" });
  const allTags = ["all", ...new Set(site.notes.flatMap((note) => note.tags))];
  let active = "all";

  const paint = () => {
    const query = search.value.trim().toLowerCase();
    const rows = site.notes.filter((note) => {
      const hay = `${note.title} ${note.excerpt} ${note.body} ${note.tags.join(" ")}`.toLowerCase();
      const tagOk = active === "all" || note.tags.includes(active);
      return tagOk && hay.includes(query);
    });
    clear(list);
    if (!rows.length) {
      list.append(el("div", { class: "empty" }, "No notes match."));
      return;
    }
    rows.forEach((note) => {
      const card = el("article", { class: "note", id: note.id }, [
        el("div", { class: "note-meta" }, [el("span", {}, note.date), el("span", {}, note.tags.join(" · "))]),
        el("h3", {}, note.title),
        el("p", {}, note.excerpt),
        el("p", { class: "note-body" }, note.body),
        el("button", { class: "btn", type: "button" }, "Read")
      ]);
      card.querySelector("button").addEventListener("click", () => {
        const open = card.classList.toggle("open");
        card.querySelector("button").textContent = open ? "Close" : "Read";
      });
      list.append(card);
    });
  };

  allTags.forEach((tag) => {
    const btn = el("button", { class: `filter-btn${tag === "all" ? " active" : ""}`, type: "button" }, tag);
    btn.addEventListener("click", () => {
      active = tag;
      filters.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === btn));
      paint();
    });
    filters.append(btn);
  });
  search.addEventListener("input", paint);

  main.append(
    el("section", { class: "wrap page-hero" }, [
      el("div", { class: "kicker" }, "Notes"),
      el("h1", {}, "Operator notes, not a blog farm."),
      el("p", {}, "Searchable write-ups from cost work, Harbor, WireGuard, tracing, and release flags.")
    ]),
    el("section", { class: "wrap" }, [
      el("div", { class: "search-row" }, [search, filters]),
      list
    ])
  );
  paint();

  const hash = location.hash.replace("#", "");
  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      target.classList.add("open");
      const button = target.querySelector("button");
      if (button) button.textContent = "Close";
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
}

export function renderContact(main, site) {
  const status = el("p", { class: "form-status muted" });
  const name = el("input", { id: "name", name: "name", required: true, maxlength: "80" });
  const email = el("input", { id: "email", name: "email", type: "email", required: true });
  const message = el("textarea", { id: "message", name: "message", required: true, maxlength: "2000" });

  const form = el("form", { class: "form" }, [
    el("label", { for: "name" }, ["Name", name]),
    el("label", { for: "email" }, ["Email", email]),
    el("label", { for: "message" }, ["Message", message]),
    el("button", { class: "btn primary", type: "submit" }, "Copy message"),
    status
  ]);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const payload = `Hi Siddhant,\n\n${message.value.trim()}\n\n— ${name.value.trim()} (${email.value.trim()})`;
    try {
      await navigator.clipboard.writeText(payload);
      status.textContent = "Message copied. Paste it into LinkedIn or GitHub.";
    } catch {
      status.textContent = "Clipboard blocked. Select the drafted text after opening LinkedIn.";
    }
    window.open(site.profile.links.linkedin, "_blank", "noreferrer");
  });

  main.append(
    el("section", { class: "wrap page-hero" }, [
      el("div", { class: "kicker" }, "Contact"),
      el("h1", {}, "Start a thread."),
      el("p", {}, "No backend on GitHub Pages — the form copies a draft and opens LinkedIn. GitHub works too.")
    ]),
    el("section", { class: "wrap contact-grid" }, [
      el("article", { class: "card" }, [
        el("h3", {}, "Direct"),
        el("p", {}, site.profile.availability),
        el("div", { class: "hero-actions" }, [
          linkBtn(site.profile.links.linkedin, "LinkedIn", "btn primary"),
          linkBtn(site.profile.links.github, "GitHub", "btn")
        ])
      ]),
      el("article", { class: "panel form-panel" }, [form])
    ])
  );
}

export function renderNotFound(main) {
  main.append(
    el("section", { class: "wrap not-found" }, [
      el("div", { class: "kicker" }, "404"),
      el("h1", {}, "Route not in the cluster."),
      el("p", { class: "lede" }, "That path is not part of this site."),
      el("div", { class: "hero-actions" }, [
        linkBtn("/", "Back to home", "btn primary"),
        linkBtn("/projects.html", "Projects", "btn")
      ])
    ])
  );
}

export const renderers = {
  home: renderHome,
  about: renderAbout,
  projects: renderProjects,
  experience: renderExperience,
  stack: renderStack,
  notes: renderNotes,
  contact: renderContact,
  notfound: renderNotFound
};
