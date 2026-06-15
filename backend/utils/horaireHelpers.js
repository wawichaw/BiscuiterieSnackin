/** Slug stable pour identifier un point de ramassage (ville + adresse). */
export function buildPointRamassage(ville, adresse) {
  const slug = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const v = slug(ville);
  const a = slug(adresse).slice(0, 40);
  return a ? `${v}-${a}` : v;
}

/** Génère les créneaux HH:MM entre heureDebut et heureFin (inclus). */
export function genererHeures(heureDebut, heureFin, intervalleMinutes = 30) {
  const parse = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const format = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let start = parse(heureDebut);
  let end = parse(heureFin);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    throw new Error('Plage horaire invalide');
  }

  const heures = [];
  for (let t = start; t <= end; t += intervalleMinutes) {
    heures.push(format(t));
  }
  return heures.length ? heures : [heureDebut];
}

export const HEURE_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
