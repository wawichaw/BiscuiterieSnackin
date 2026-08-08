import ParametresCommande from '../models/ParametresCommande.model.js';

const DEFAULTS = {
  actif: true,
  heureLimiteCommande: '11:00',
  delaiMinimumMinutes: 60,
  bloquerJourMeme: true,
};

export async function getParametresCommande() {
  let doc = await ParametresCommande.findOne().lean();
  if (!doc) {
    const created = await ParametresCommande.create(DEFAULTS);
    doc = created.toObject();
  }
  return {
    actif: doc.actif ?? DEFAULTS.actif,
    heureLimiteCommande: doc.heureLimiteCommande ?? DEFAULTS.heureLimiteCommande,
    delaiMinimumMinutes: doc.delaiMinimumMinutes ?? DEFAULTS.delaiMinimumMinutes,
    bloquerJourMeme: doc.bloquerJourMeme ?? DEFAULTS.bloquerJourMeme,
  };
}

export async function updateParametresCommande(update) {
  const doc = await ParametresCommande.findOneAndUpdate(
    {},
    { $set: update },
    { new: true, upsert: true },
  );
  return {
    actif: doc.actif,
    heureLimiteCommande: doc.heureLimiteCommande,
    delaiMinimumMinutes: doc.delaiMinimumMinutes,
    bloquerJourMeme: doc.bloquerJourMeme,
  };
}
