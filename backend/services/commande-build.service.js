export const validerEtCalculerCommande = async (body) => {
  const {
    horaireCorrespondADate,
    validerRamassageAutorise,
    formatIsoDateLocal,
  } = await import('../utils/horaireHelpers.js');
  const { getParametresCommande } = await import('./parametres-commande.service.js');
  const HoraireRamassage = (await import('../models/HoraireRamassage.model.js')).default;

  for (const boite of body.boites) {
    const totalSaveurs = boite.saveurs.reduce((sum, s) => sum + s.quantite, 0);
    if (totalSaveurs !== boite.taille) {
      throw new Error(`La boîte de ${boite.taille} doit contenir exactement ${boite.taille} biscuits`);
    }

    const Biscuit = (await import('../models/Biscuit.model.js')).default;
    for (const saveur of boite.saveurs) {
      const biscuit = await Biscuit.findById(saveur.biscuit);
      if (!biscuit) {
        throw new Error(`Biscuit avec l'ID ${saveur.biscuit} non trouvé`);
      }
    }
  }

  const totalBoites = body.boites.reduce((sum, boite) => sum + boite.prix, 0);

  let fraisLivraison = 0;
  if (body.typeReception === 'livraison') {
    const dateLivraison = new Date(body.dateLivraison);
    const jourSemaine = dateLivraison.getDay();
    const heureLivraison = body.heureLivraison;

    if (jourSemaine === 4) {
      const [heures] = heureLivraison.split(':').map(Number);
      if (heures >= 18) {
        fraisLivraison = 5;
      }
    }
  }

  const total = totalBoites + fraisLivraison;

  const commandeData = {
    boites: body.boites,
    total,
    typeReception: body.typeReception,
    methodePaiement: body.methodePaiement || 'en_ligne',
    fraisLivraison,
    sourceDecouverte: body.sourceDecouverte,
  };

  if (body.sourceDecouverte === 'autre' && body.sourceDecouverteAutre) {
    commandeData.sourceDecouverteAutre = body.sourceDecouverteAutre.trim();
  }

  if (body.typeReception === 'ramassage') {
    const dateRamassage = new Date(body.dateRamassage);
    const dateIso = formatIsoDateLocal(dateRamassage);

    const horaires = await HoraireRamassage.find({
      pointRamassage: body.pointRamassage,
      disponible: true,
    });
    const horaire = horaires.find((h) => horaireCorrespondADate(h, dateIso));

    if (!horaire) {
      throw new Error('Point ou date de ramassage non disponible');
    }

    const parametres = await getParametresCommande();
    validerRamassageAutorise({
      dateIso,
      heure: body.heureRamassage,
      parametres,
      heuresConfigurees: horaire.heures,
    });

    commandeData.pointRamassage = body.pointRamassage;
    commandeData.dateRamassage = dateRamassage;
    commandeData.heureRamassage = body.heureRamassage;
  } else {
    commandeData.villeLivraison = body.villeLivraison;
    commandeData.adresseLivraison = {
      rue: body.adresseLivraison.rue,
      codePostal: body.adresseLivraison.codePostal,
      instructions: body.adresseLivraison.instructions || '',
    };
    commandeData.dateLivraison = new Date(body.dateLivraison);
    commandeData.heureLivraison = body.heureLivraison;
  }

  return { commandeData, total, fraisLivraison };
};
