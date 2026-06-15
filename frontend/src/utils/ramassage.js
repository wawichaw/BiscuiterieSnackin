const legacyVilleLabels = {
  laval: 'Laval',
  montreal: 'Montréal',
  repentigny: 'Repentigny',
};

export function isAdresseParCourriel(lieu) {
  if (!lieu) return false;
  if (lieu.adresseParCourriel) return true;
  const ville = String(lieu.ville || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (ville === 'repentigny') return true;
  const slug = String(lieu.pointRamassage || '').toLowerCase();
  return slug === 'repentigny' || slug.startsWith('repentigny-');
}

export function libelleVilleDepuisSlug(slug) {
  if (!slug) return '';
  const key = String(slug).toLowerCase();
  if (legacyVilleLabels[key]) return legacyVilleLabels[key];
  const prefix = key.split('-')[0];
  if (legacyVilleLabels[prefix]) return legacyVilleLabels[prefix];
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export function libellePointPublic(lieu, slug) {
  if (lieu?.ville) return lieu.ville;
  return libelleVilleDepuisSlug(slug);
}

/** Ville + adresse dans les listes (sauf Repentigny). */
export function libellePointAvecAdresse(lieu, slug) {
  const ville = libellePointPublic(lieu, slug);
  if (isAdresseParCourriel(lieu) || isAdresseParCourriel({ pointRamassage: slug })) {
    return ville;
  }
  if (lieu?.adresse) return `${ville} — ${lieu.adresse}`;
  return ville;
}

export function isSlugRepentigny(slug) {
  if (!slug) return false;
  const key = String(slug).toLowerCase();
  return key === 'repentigny' || key.startsWith('repentigny-');
}

export const MESSAGE_ADRESSE_PAR_COURRIEL =
  'L\'adresse exacte vous sera communiquée par courriel avec votre confirmation de commande.';
