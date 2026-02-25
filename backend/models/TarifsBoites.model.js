import mongoose from 'mongoose';

/**
 * Un seul document dans la collection : prix des boîtes 4, 6 et 12 biscuits.
 */
const tarifsBoitesSchema = new mongoose.Schema({
  prix4: {
    type: Number,
    required: true,
    min: [0, 'Le prix ne peut pas être négatif'],
    default: 15,
  },
  prix6: {
    type: Number,
    required: true,
    min: [0, 'Le prix ne peut pas être négatif'],
    default: 20,
  },
  prix12: {
    type: Number,
    required: true,
    min: [0, 'Le prix ne peut pas être négatif'],
    default: 35,
  },
}, {
  timestamps: true,
  collection: 'tarifsboites',
});

const TarifsBoites = mongoose.model('TarifsBoites', tarifsBoitesSchema);

export default TarifsBoites;
