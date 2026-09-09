const USER = "Siddhant00Tiwari";
const CACHE_KEY = "st-github-cache-v1";
const TTL_MS = 10 * 60 * 1000;
const HIDDEN = new Set(["Siddhant00Tiwari"]);

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}`);
  }
  return response.json();
}

export async function loadGitHub() {
  const cached = readCache();
  if (cached) return cached;

  try {
    const [user, repos] = await Promise.all([
      getJson(`https://api.github.com/users/${USER}`),
      getJson(`https://api.github.com/users/${USER}/repos?sort=updated&per_page=100`)
    ]);

    const data = {
      user,
      repos: repos
        .filter((repo) => !repo.fork && !HIDDEN.has(repo.name))
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)),
      fetchedAt: Date.now(),
      live: true
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    return cached || { user: null, repos: [], live: false, error: error.message };
  }
}

export function formatDate(value) {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function relativeTime(value) {
  if (!value) return "unknown";
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
