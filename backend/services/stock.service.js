import Biscuit from '../models/Biscuit.model.js';

export const calculerBesoinsStock = (boites = []) => {
  const besoins = new Map();
  for (const boite of boites) {
    for (const saveur of boite.saveurs || []) {
      const id = saveur.biscuit?._id?.toString?.()
        || saveur.biscuit?.toString?.()
        || String(saveur.biscuit);
      if (!id) continue;
      besoins.set(id, (besoins.get(id) || 0) + saveur.quantite);
    }
  }
  return besoins;
};

export const verifierStockDisponible = async (boites = []) => {
  const besoins = calculerBesoinsStock(boites);
  const errors = [];

  for (const [biscuitId, qty] of besoins) {
    const biscuit = await Biscuit.findById(biscuitId);
    if (!biscuit) {
      errors.push('Un biscuit de la commande n\'existe plus');
      continue;
    }
    if (!biscuit.disponible || biscuit.stock < qty) {
      errors.push(
        `Stock insuffisant pour « ${biscuit.nom} » (disponible : ${biscuit.stock}, demandé : ${qty})`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('. '));
  }
};

export const decrementerStockCommande = async (boites = []) => {
  const besoins = calculerBesoinsStock(boites);

  for (const [biscuitId, qty] of besoins) {
    const updated = await Biscuit.findOneAndUpdate(
      { _id: biscuitId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true },
    );

    if (!updated) {
      const biscuit = await Biscuit.findById(biscuitId);
      const nom = biscuit?.nom || biscuitId;
      throw new Error(`Stock insuffisant pour « ${nom} » lors de la confirmation`);
    }

    if (updated.stock <= 0) {
      updated.disponible = false;
      await updated.save();
    }
  }
};
