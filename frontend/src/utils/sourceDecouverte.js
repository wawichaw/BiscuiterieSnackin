export const SOURCE_DECOUVERTE_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  internet: 'Google / Internet',
  bouche_a_oreille: 'Bouche-à-oreille',
  evenement: 'Événement / marché',
  autre: 'Autre',
};

export const SOURCE_DECOUVERTE_OPTIONS = Object.entries(SOURCE_DECOUVERTE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const getSourceDecouverteLabel = (commande) => {
  if (!commande?.sourceDecouverte) return 'Non renseigné';
  if (commande.sourceDecouverte === 'autre') {
    return commande.sourceDecouverteAutre
      ? `Autre — ${commande.sourceDecouverteAutre}`
      : 'Autre';
  }
  return SOURCE_DECOUVERTE_LABELS[commande.sourceDecouverte] || commande.sourceDecouverte;
};

export const getSourceDecouverteCategorie = (commande) => {
  if (!commande?.sourceDecouverte) {
    return { key: 'non_renseigne', label: 'Non renseigné' };
  }
  if (
    commande.sourceDecouverte === 'autre'
    && /lien de paiement admin/i.test(commande.sourceDecouverteAutre || '')
  ) {
    return { key: 'lien_admin', label: 'Lien de paiement (admin)' };
  }
  if (commande.sourceDecouverte === 'autre') {
    return { key: 'autre', label: 'Autre' };
  }
  return {
    key: commande.sourceDecouverte,
    label: SOURCE_DECOUVERTE_LABELS[commande.sourceDecouverte] || commande.sourceDecouverte,
  };
};
