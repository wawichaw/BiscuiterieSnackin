import PDFDocument from 'pdfkit';

const MARQUE = "Snackin'";
const COULEUR_PRINCIPALE = '#a0162b';
const COULEUR_TEXTE = '#222222';
const COULEUR_MUTED = '#666666';

const money = (n) => `${Number(n || 0).toFixed(2)} $`;

const capitalize = (s = '') => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * Génère une facture PDF pour une commande confirmée.
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
export const genererFacturePdf = async ({
  numeroCommande,
  nomClient,
  emailClient,
  telephoneClient,
  dateCommande,
  total,
  fraisLivraison = 0,
  typeReception,
  pointRamassage,
  villeRamassage,
  adresseRamassage,
  dateRamassage,
  heureRamassage,
  villeLivraison,
  adresseLivraison,
  dateLivraison,
  heureLivraison,
  methodePaiement,
  boites = [],
}) => {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // En-tête
  doc
    .fillColor(COULEUR_PRINCIPALE)
    .fontSize(26)
    .font('Helvetica-Bold')
    .text(MARQUE, 50, 50);

  doc
    .fillColor(COULEUR_MUTED)
    .fontSize(10)
    .font('Helvetica')
    .text('Biscuits artisanaux', 50, 80);

  doc
    .fillColor(COULEUR_PRINCIPALE)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('FACTURE', 350, 50, { align: 'right', width: 200 });

  doc
    .fillColor(COULEUR_TEXTE)
    .fontSize(10)
    .font('Helvetica')
    .text(`N° #${numeroCommande}`, 350, 78, { align: 'right', width: 200 });

  const dateFacture = dateCommande
    ? new Date(dateCommande).toLocaleDateString('fr-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('fr-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

  doc.text(`Date : ${dateFacture}`, 350, 94, { align: 'right', width: 200 });

  // Ligne séparatrice
  doc
    .moveTo(50, 120)
    .lineTo(562, 120)
    .strokeColor(COULEUR_PRINCIPALE)
    .lineWidth(2)
    .stroke();

  // Client
  let y = 140;
  doc
    .fillColor(COULEUR_PRINCIPALE)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Facturé à', 50, y);

  y += 18;
  doc
    .fillColor(COULEUR_TEXTE)
    .fontSize(11)
    .font('Helvetica')
    .text(nomClient || 'Client', 50, y);

  if (emailClient) {
    y += 15;
    doc.fillColor(COULEUR_MUTED).fontSize(10).text(emailClient, 50, y);
  }
  if (telephoneClient) {
    y += 14;
    doc.text(telephoneClient, 50, y);
  }

  // Réception
  y = 140;
  doc
    .fillColor(COULEUR_PRINCIPALE)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(typeReception === 'ramassage' ? 'Ramassage' : 'Livraison', 320, y);

  y += 18;
  doc.fillColor(COULEUR_TEXTE).fontSize(10).font('Helvetica');

  if (typeReception === 'ramassage') {
    const villeLabel = villeRamassage || capitalize(pointRamassage);
    doc.text(villeLabel || '—', 320, y);
    if (adresseRamassage) {
      y += 14;
      doc.fillColor(COULEUR_MUTED).text(`${adresseRamassage}, ${villeLabel}`, 320, y, { width: 240 });
    }
    if (dateRamassage) {
      y += 14;
      const d = new Date(dateRamassage).toLocaleDateString('fr-CA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      doc.fillColor(COULEUR_TEXTE).text(`${d} à ${heureRamassage || ''}`, 320, y, { width: 240 });
    }
  } else {
    const ville = capitalize(villeLivraison);
    doc.text(ville || '—', 320, y);
    if (adresseLivraison?.rue) {
      y += 14;
      doc
        .fillColor(COULEUR_MUTED)
        .text(`${adresseLivraison.rue}, ${adresseLivraison.codePostal || ''}`, 320, y, { width: 240 });
    }
    if (dateLivraison) {
      y += 14;
      const d = new Date(dateLivraison).toLocaleDateString('fr-CA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      doc.fillColor(COULEUR_TEXTE).text(`${d} à ${heureLivraison || ''}`, 320, y, { width: 240 });
    }
  }

  // Tableau des articles
  y = Math.max(y + 36, 230);

  doc
    .rect(50, y, 512, 24)
    .fill(COULEUR_PRINCIPALE);

  doc
    .fillColor('#ffffff')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Description', 58, y + 7)
    .text('Qté', 360, y + 7, { width: 40, align: 'center' })
    .text('Prix', 420, y + 7, { width: 60, align: 'right' })
    .text('Total', 490, y + 7, { width: 64, align: 'right' });

  y += 28;
  doc.font('Helvetica').fillColor(COULEUR_TEXTE);

  for (let i = 0; i < boites.length; i++) {
    const boite = boites[i];
    const titre = `Boîte de ${boite.taille} biscuits`;
    const prix = Number(boite.prix || 0);

    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.font('Helvetica-Bold').fontSize(10).text(titre, 58, y, { width: 290 });
    doc.font('Helvetica').text('1', 360, y, { width: 40, align: 'center' });
    doc.text(money(prix), 420, y, { width: 60, align: 'right' });
    doc.text(money(prix), 490, y, { width: 64, align: 'right' });
    y += 16;

    for (const s of boite.saveurs || []) {
      const nom = s.biscuit?.nom || 'Biscuit';
      doc
        .fillColor(COULEUR_MUTED)
        .fontSize(9)
        .text(`  • ${s.quantite}× ${nom}`, 58, y, { width: 290 });
      y += 13;
    }

    y += 10;
    doc
      .moveTo(50, y)
      .lineTo(562, y)
      .strokeColor('#eeeeee')
      .lineWidth(1)
      .stroke();
    y += 10;
    doc.fillColor(COULEUR_TEXTE);
  }

  // Totaux
  y += 8;
  const sousTotal = Number(total || 0) - Number(fraisLivraison || 0);

  const rowTotal = (label, value, bold = false) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 12 : 10)
      .fillColor(COULEUR_TEXTE)
      .text(label, 360, y, { width: 100, align: 'right' })
      .text(money(value), 470, y, { width: 84, align: 'right' });
    y += bold ? 20 : 16;
  };

  rowTotal('Sous-total', sousTotal);
  if (Number(fraisLivraison) > 0) {
    rowTotal('Frais de livraison', fraisLivraison);
  }
  rowTotal('Total payé', total, true);

  y += 8;
  const paiementLabel =
    methodePaiement === 'en_ligne' ? 'Payé en ligne (Stripe)' : 'Paiement sur place';
  doc
    .fillColor(COULEUR_MUTED)
    .fontSize(10)
    .font('Helvetica')
    .text(`Mode de paiement : ${paiementLabel}`, 50, y);

  // Pied de page
  doc
    .fillColor(COULEUR_MUTED)
    .fontSize(9)
    .text(
      "Merci pour votre confiance ! Conservez cette facture comme preuve d'achat.",
      50,
      720,
      { align: 'center', width: 512 }
    )
    .text(`${MARQUE} — snackin.mtl@gmail.com`, 50, 736, { align: 'center', width: 512 });

  doc.end();

  const buffer = await done;
  return {
    buffer,
    filename: `facture-snackin-${numeroCommande}.pdf`,
  };
};

export default { genererFacturePdf };
