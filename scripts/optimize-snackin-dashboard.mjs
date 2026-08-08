/**
 * Optimise Snackin_Dashboard_Aicha.xlsx — sélecteur de mois + formules Ventes/Dépenses
 * Usage: node scripts/optimize-snackin-dashboard.mjs
 */
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const sources = [
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Snackin_Dashboard_Aicha.xlsx'),
  path.join(root, 'Snackin_Dashboard_Aicha_copy.xlsx'),
];

const sourcePath = sources.find((p) => fs.existsSync(p)) || sources[1];

const outputPath = path.join(
  process.env.USERPROFILE || root,
  'Downloads',
  'Snackin_Dashboard_Aicha_Optimise.xlsx',
);

const parseMontant = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/\s/g, '').replace(/\$/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

const monthKey = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const MONTH_LABELS = {
  '01': 'Janvier', '02': 'Février', '03': 'Mars', '04': 'Avril',
  '05': 'Mai', '06': 'Juin', '07': 'Juillet', '08': 'Août',
  '09': 'Septembre', '10': 'Octobre', '11': 'Novembre', '12': 'Décembre',
};

const formatMonthLabel = (key) => {
  const [y, m] = key.split('-');
  return `${MONTH_LABELS[m] || m} ${y}`;
};

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error('Fichier source introuvable:', sourcePath);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(sourcePath);

  const ventes = wb.getWorksheet('Ventes');
  const depenses = wb.getWorksheet('Dépenses');
  let dashboard = wb.getWorksheet('Tableau de bord');

  if (!ventes || !dashboard) {
    console.error('Feuilles Ventes ou Tableau de bord manquantes');
    process.exit(1);
  }

  // --- Ventes : colonne G Montant (numérique) ---
  ventes.getCell('G1').value = 'Montant (num.)';
  ventes.getColumn(7).width = 14;

  const monthSet = new Set();
  let defaultMonth = '';

  ventes.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const dateVal = row.getCell(1).value;
    const montantRaw = row.getCell(4).value;
    const parsed = parseMontant(montantRaw);

    if (parsed != null) {
      row.getCell(4).value = parsed;
      row.getCell(4).numFmt = '#,##0.00" $"';
    }

    row.getCell(7).value = parsed ?? null;
    if (parsed != null) row.getCell(7).numFmt = '#,##0.00" $"';

    let dateObj = null;
    if (dateVal instanceof Date) dateObj = dateVal;
    else if (typeof dateVal === 'number') {
      dateObj = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    }

    const key = monthKey(dateObj);
    if (key) monthSet.add(key);
  });

  // Mois par défaut : le plus récent des ventes, ou mois courant
  const sortedMonths = [...monthSet].sort();
  defaultMonth = sortedMonths.at(-1) || monthKey(new Date()) || '2026-06';

  // Ajouter quelques mois futurs à la liste
  const [dy, dm] = defaultMonth.split('-').map(Number);
  for (let i = 0; i <= 6; i++) {
    const dt = new Date(dy, dm - 1 + i, 1);
    monthSet.add(monthKey(dt));
  }
  const monthOptions = [...monthSet].filter(Boolean).sort();
  const monthListFormula = `"${monthOptions.join(',')}"`;

  // --- Dépenses : format numérique Montant ---
  if (depenses) {
    depenses.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const montantRaw = row.getCell(4).value;
      const parsed = parseMontant(montantRaw);
      if (parsed != null) {
        row.getCell(4).value = parsed;
        row.getCell(4).numFmt = '#,##0.00" $"';
      }
      const dateVal = row.getCell(1).value;
      if (dateVal instanceof Date) {
        const key = monthKey(dateVal);
        if (key) monthSet.add(key);
      }
    });
  }

  // --- Tableau de bord optimisé ---
  dashboard.spliceRows(1, dashboard.rowCount);

  const cherry = 'FFA0162B';
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F7' } };
  const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE8EC' } };

  const setHeader = (cell, value, bold = true) => {
    cell.value = value;
    cell.font = { bold, color: { argb: cherry }, size: bold ? 12 : 11 };
    cell.fill = headerFill;
  };

  // Ligne 1 — titre
  dashboard.mergeCells('A1:B1');
  setHeader(dashboard.getCell('A1'), '🍪 Snackin\' — Tableau de bord', true);
  dashboard.getCell('A1').font = { bold: true, size: 16, color: { argb: cherry } };

  // Ligne 2 — sélecteur mois
  setHeader(dashboard.getCell('A2'), 'Mois sélectionné');
  dashboard.getCell('B2').value = defaultMonth;
  dashboard.getCell('B2').dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [monthListFormula],
    showErrorMessage: true,
    errorTitle: 'Mois invalide',
    error: 'Choisissez un mois dans la liste.',
  };
  dashboard.getCell('B2').font = { bold: true, size: 12 };

  // Helpers (année / mois) — colonne D masquée
  dashboard.getCell('D2').value = { formula: 'VALUE(LEFT(B2,4))' };
  dashboard.getCell('D3').value = { formula: 'VALUE(RIGHT(B2,2))' };
  dashboard.getColumn(4).hidden = true;

  // Ligne 3 — libellé période
  dashboard.getCell('A3').value = 'Période affichée';
  dashboard.getCell('B3').value = {
    formula: 'TEXT(DATE($D$2,$D$3,1),"mmmm yyyy")',
  };
  dashboard.getCell('B3').font = { italic: true, color: { argb: 'FF555555' } };

  // Section — situation actuelle
  dashboard.mergeCells('A5:B5');
  dashboard.getCell('A5').value = '💰 Situation actuelle (à mettre à jour manuellement)';
  dashboard.getCell('A5').fill = sectionFill;
  dashboard.getCell('A5').font = { bold: true, color: { argb: cherry } };

  const manualRows = [
    ['Argent en banque', 727],
    ['Argent comptant', 145.8],
  ];
  manualRows.forEach(([label, val], i) => {
    const r = 6 + i;
    dashboard.getCell(`A${r}`).value = label;
    dashboard.getCell(`B${r}`).value = val;
    dashboard.getCell(`B${r}`).numFmt = '#,##0.00" $"';
  });

  // Section — ce mois (formules)
  dashboard.mergeCells('A9:B9');
  dashboard.getCell('A9').value = '📊 Statistiques du mois sélectionné';
  dashboard.getCell('A9').fill = sectionFill;
  dashboard.getCell('A9').font = { bold: true, color: { argb: cherry } };

  const dateStart = 'DATE($D$2,$D$3,1)';
  const dateEnd = 'EOMONTH(DATE($D$2,$D$3,1),0)';

  const metrics = [
    {
      label: "Chiffre d'affaires du mois",
      formula: `SUMIFS(Ventes!G:G,Ventes!A:A,">="&${dateStart},Ventes!A:A,"<="&${dateEnd},Ventes!F:F,"confirmer")`,
      fmt: '#,##0.00" $"',
    },
    {
      label: 'Dépenses du mois',
      formula: `SUMIFS(Dépenses!D:D,Dépenses!A:A,">="&${dateStart},Dépenses!A:A,"<="&${dateEnd})`,
      fmt: '#,##0.00" $"',
    },
    {
      label: 'Profit du mois (CA − dépenses)',
      formula: 'B10-B11',
      fmt: '#,##0.00" $"',
    },
    {
      label: 'Nombre de commandes',
      formula: `COUNTIFS(Ventes!A:A,">="&${dateStart},Ventes!A:A,"<="&${dateEnd},Ventes!F:F,"confirmer")`,
      fmt: '0',
    },
    {
      label: 'Panier moyen',
      formula: 'IF(B13=0,"",B10/B13)',
      fmt: '#,##0.00" $"',
    },
    {
      label: 'Ventes site web',
      formula: `COUNTIFS(Ventes!G:G,">0",Ventes!A:A,">="&${dateStart},Ventes!A:A,"<="&${dateEnd},Ventes!F:F,"confirmer",Ventes!H:H,"site web")`,
      fmt: '0',
    },
  ];

  metrics.forEach((m, i) => {
    const r = 10 + i;
    dashboard.getCell(`A${r}`).value = m.label;
    dashboard.getCell(`B${r}`).value = { formula: m.formula };
    dashboard.getCell(`B${r}`).numFmt = m.fmt;
  });

  // Section — synthèse
  dashboard.mergeCells('A18:B18');
  dashboard.getCell('A18').value = '📈 Synthèse';
  dashboard.getCell('A18').fill = sectionFill;
  dashboard.getCell('A18').font = { bold: true, color: { argb: cherry } };

  dashboard.getCell('A19').value = 'Trésorerie totale (banque + comptant)';
  dashboard.getCell('B19').value = { formula: 'B6+B7' };
  dashboard.getCell('B19').numFmt = '#,##0.00" $"';

  dashboard.getCell('A20').value = 'Profit estimé global (trésorerie − dépenses du mois)';
  dashboard.getCell('B20').value = { formula: 'B19-B11' };
  dashboard.getCell('B20').numFmt = '#,##0.00" $"';

  // Instructions
  dashboard.mergeCells('A22:B25');
  dashboard.getCell('A22').value = [
    'Comment utiliser :',
    '1. Choisissez le mois en B2 — les stats se mettent à jour automatiquement.',
    '2. Mettez à jour banque/comptant (B6-B7) quand vous le souhaitez.',
    '3. Ajoutez vos ventes dans « Ventes » et dépenses dans « Dépenses » (dates + montants).',
    '4. Colonne G « Montant (num.) » dans Ventes est remplie automatiquement si vous entrez ex. 24$.',
  ].join('\n');
  dashboard.getCell('A22').alignment = { wrapText: true, vertical: 'top' };
  dashboard.getCell('A22').font = { size: 10, color: { argb: 'FF666666' } };

  dashboard.getColumn(1).width = 42;
  dashboard.getColumn(2).width = 22;

  // Formules colonne G pour nouvelles lignes Ventes
  for (let r = 2; r <= 500; r++) {
    ventes.getCell(`G${r}`).value = {
      formula: `IF(D${r}="","",IF(ISNUMBER(D${r}),D${r},VALUE(SUBSTITUTE(SUBSTITUTE(D${r},"$","")," ",""))))`,
    };
    ventes.getCell(`G${r}`).numFmt = '#,##0.00" $"';
  }

  await wb.xlsx.writeFile(outputPath);
  console.log('✅ Fichier créé:', outputPath);
  console.log('   Mois par défaut:', defaultMonth, '—', formatMonthLabel(defaultMonth));
  console.log('   Mois disponibles:', monthOptions.map(formatMonthLabel).join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
