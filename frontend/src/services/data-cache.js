/**
 * Cache module-level pour les GeoJSON statiques.
 *
 * Une couche GeoJSON est chargée au plus une fois par session (les fichiers sont
 * fingerprintés par Vercel donc le HTTP cache fait déjà le travail, mais éviter
 * la désérialisation JSON répétée est utile sur les gros fichiers).
 */

const promiseCache = new Map();

export async function loadGeoJson(url) {
  if (!url) return null;
  if (promiseCache.has(url)) return promiseCache.get(url);
  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    })
    .catch((err) => {
      // En cas d'échec on retire du cache pour permettre un nouvel essai
      promiseCache.delete(url);
      throw err;
    });
  promiseCache.set(url, p);
  return p;
}

export function clearCache() {
  promiseCache.clear();
}
