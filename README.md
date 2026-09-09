# siddhant-tiwari.com

Personal site for **Siddhant Tiwari**, served by GitHub Pages from this user repository.

The previous site was a single hardcoded HTML file. This version is a multi-page, data-driven frontend:

- Pages: Home, About, Projects, Experience, Stack, Notes, Contact, plus `404.html`
- Content lives in `assets/data/site.json` and is rendered in the browser
- Projects pulls **live GitHub repositories** from the public API (with session cache)
- Home includes an interactive terminal (`help`, `whoami`, `github`, …)
- Notes and live repos are searchable/filterable
- Command palette: `Ctrl+K` / `Cmd+K`
- Theme toggle persisted in `localStorage`
- No Jekyll, no build step, no Tailwind CDN

## GitHub Pages

This is a **user site** (`Siddhant00Tiwari.github.io`), so Pages serves the repo root.

| File | Why it is here |
| --- | --- |
| `CNAME` | Custom domain `siddhant-tiwari.com` |
| `.nojekyll` | Skip Jekyll so `assets/` and ES modules are served as-is |
| `404.html` | GitHub Pages custom not-found page |
| Root-absolute paths (`/assets/...`) | Correct for a user site and for the custom domain |

Project Pages (`username.github.io/repo-name`) would need a different base path. Do not reuse these paths there.

After merge to `main`, GitHub Pages publishes automatically. The custom domain still needs a valid certificate on Cloudflare/GitHub — `siddhant-tiwari.com` was returning Cloudflare 526 when this rebuild started.

## Local preview

There is no bundler. Serve the repo root so `/assets/...` resolves.

macOS / zsh:

```bash
python3 -m http.server 4173
```

Windows PowerShell:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## Checks

```bash
npm run check
```

## Edit content

Change copy, certs, featured projects, and notes in `assets/data/site.json`. The GitHub grid updates itself from `https://api.github.com/users/Siddhant00Tiwari`.
