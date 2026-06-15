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

/** 0 = dimanche … 6 = samedi (convention JavaScript) */
export const JOURS_LABELS = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

export const JOURS_ORDRE = [1, 2, 3, 4, 5, 6, 0];

export function formatIsoDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateLocal(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getJourSemaineFromIso(iso) {
  return parseIsoDateLocal(iso).getDay();
}

export function formatJoursSemaine(joursSemaine = []) {
  return [...joursSemaine]
    .sort((a, b) => JOURS_ORDRE.indexOf(a) - JOURS_ORDRE.indexOf(b))
    .map((j) => JOURS_LABELS[j])
    .join(', ');
}

/** Dates concrètes à partir des jours récurrents (semaine en cours + semaines suivantes). */
export function genererDatesProchainesSemaines(joursSemaine, nbSemaines = 4, fromDate = new Date()) {
  if (!joursSemaine?.length) return [];

  const today = new Date(fromDate);
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + nbSemaines * 7);

  const dates = [];
  const cursor = new Date(today);
  while (cursor <= end) {
    if (joursSemaine.includes(cursor.getDay())) {
      dates.push(formatIsoDateLocal(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function collectDatesFromHoraire(horaire, nbSemaines = 4) {
  const doc = horaire.toObject ? horaire.toObject() : horaire;
  if (doc.joursSemaine?.length) {
    return genererDatesProchainesSemaines(doc.joursSemaine, nbSemaines);
  }
  if (doc.date) {
    const iso = formatIsoDateLocal(new Date(doc.date));
    const today = formatIsoDateLocal(new Date());
    return iso >= today ? [iso] : [];
  }
  return [];
}

export function horaireCorrespondADate(horaire, dateIso) {
  const doc = horaire.toObject ? horaire.toObject() : horaire;
  if (doc.joursSemaine?.length) {
    return doc.joursSemaine.includes(getJourSemaineFromIso(dateIso));
  }
  if (doc.date) {
    return formatIsoDateLocal(new Date(doc.date)) === dateIso;
  }
  return false;
}
