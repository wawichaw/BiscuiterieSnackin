import HoraireRamassage from '../models/HoraireRamassage.model.js';
import { isAdressePriveeClient } from '../utils/horaireHelpers.js';

const legacyVilleLabels = {
  laval: 'Laval',
  montreal: 'Montréal',
  repentigny: 'Repentigny',
};

/** Infos complètes pour l'email de confirmation (inclut l'adresse Repentigny). */
export async function getInfosRamassagePourEmail(pointRamassage) {
  if (!pointRamassage) {
    return { ville: '', adresse: '', adressePrivee: false };
  }

  const horaire = await HoraireRamassage.findOne({ pointRamassage });
  if (horaire) {
    return {
      ville: horaire.ville,
      adresse: horaire.adresse || '',
      adressePrivee: isAdressePriveeClient(horaire),
    };
  }

  const slug = String(pointRamassage).toLowerCase();
  const villeLegacy = legacyVilleLabels[slug] || legacyVilleLabels[slug.split('-')[0]];
  return {
    ville: villeLegacy || pointRamassage,
    adresse: '',
    adressePrivee: isAdressePriveeClient({ pointRamassage }),
  };
}
