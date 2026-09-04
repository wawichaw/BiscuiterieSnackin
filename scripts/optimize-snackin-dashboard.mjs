/**
 * Optimise Snackin_Dashboard_Aicha.xlsx — sélecteur de mois + formules Ventes/Dépenses
 * Usage: node scripts/optimize-snackin-dashboard.mjs
 */
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { injectExcelCharts } from './inject-excel-charts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const sources = [
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Snackin_Dashboard_Aicha_Optimise_v2.xlsx'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Snackin_Dashboard_Aicha_Optimise.xlsx'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'Snackin_Dashboard_Aicha.xlsx'),
  path.join(root, 'Snackin_Dashboard_Aicha_Optimise.xlsx'),
  path.join(root, 'Snackin_Dashboard_Aicha_copy.xlsx'),
];

const sourcePath = sources.find((p) => fs.existsSync(p)) || sources[1];

const outputPath = path.join(
  process.env.USERPROFILE || root,
  'Downloads',
  'Snackin_Dashboard_Aicha_Optimise.xlsx',
);

const outputCopyPath = path.join(root, 'Snackin_Dashboard_Aicha_Optimise.xlsx');
const outputFallbackPath = path.join(
  process.env.USERPROFILE || root,
  'Downloads',
  'Snackin_Dashboard_Aicha_Optimise_v2.xlsx',
);
const outputV3Path = path.join(
  process.env.USERPROFILE || root,
  'Downloads',
  'Snackin_Dashboard_Aicha_Optimise_v3.xlsx',
);

const colLetter = (n) => {
  let s = '';
  let num = n;
  while (num > 0) {
    const m = (num - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
};

/** Extrait les noms de biscuits depuis la colonne Produit (ex. "2x Dulce Lava"). */
const extractCookiesFromProduit = (text) => {
  const names = new Set();
  if (!text) return names;
  const regex = /(\d+)\s*x\s+([^\n\r]+)/gi;
  let match = regex.exec(String(text));
  while (match) {
    const name = match[2].trim();
    if (name && !/^boîte\b/i.test(name) && !/biscuits?\s*$/i.test(name)) {
      names.add(name);
    }
    match = regex.exec(String(text));
  }
  return names;
};

const ventesCookieFormula = (row, cookieName) => {
  const esc = cookieName.replace(/"/g, '""');
  return `IF(C${row}="","",SUM(MAP(TEXTSPLIT(C${row},CHAR(10)),LAMBDA(L,IF(ISNUMBER(SEARCH("x ${esc}",L)),IFERROR(--TRIM(RIGHT(SUBSTITUTE(TEXTBEFORE(L,"x")," ",REPT(" ",100)),100)),0),0))))`;
};

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

  // --- Extraire la liste des biscuits vendus ---
  const cookieSet = new Set();
  ventes.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const produit = row.getCell(3).value;
    extractCookiesFromProduit(produit).forEach((name) => cookieSet.add(name));
  });
  const cookieNames = [...cookieSet].sort((a, b) => a.localeCompare(b, 'fr'));
  const COOKIE_COL_START = 9; // colonne I (H réservée éventuellement à « source »)

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

  // --- Tableau de bord optimisé (recréer la feuille pour éviter conflits de fusion) ---
  const dashIndex = dashboard.id;
  wb.removeWorksheet(dashIndex);
  dashboard = wb.addWorksheet('Tableau de bord');
  wb.worksheets.sort((a, b) => {
    if (a.name === 'Tableau de bord') return -1;
    if (b.name === 'Tableau de bord') return 1;
    return 0;
  });

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
      formula: `SUMIFS(Ventes!G:G,Ventes!A:A,">="&${dateStart},Ventes!A:A,"<="&${dateEnd},Ventes!F:F,"confirmer*")`,
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
      formula: `COUNTIFS(Ventes!A:A,">="&${dateStart},Ventes!A:A,"<="&${dateEnd},Ventes!F:F,"confirmer*")`,
      fmt: '0',
    },
    {
      label: 'Panier moyen',
      formula: 'IF(B13=0,"",B10/B13)',
      fmt: '#,##0.00" $"',
    },
    {
      label: 'Ventes site web',
      formula: `COUNTIFS(Ventes!G:G,">0",Ventes!A:A,">="&${dateStart},Ventes!A:A,"<="&${dateEnd},Ventes!F:F,"confirmer*",Ventes!H:H,"site web")`,
      fmt: '0',
    },
  ];

  metrics.forEach((m, i) => {
    const r = 10 + i;
    dashboard.getCell(`A${r}`).value = m.label;
    dashboard.getCell(`B${r}`).value = { formula: m.formula };
    dashboard.getCell(`B${r}`).numFmt = m.fmt;
  });

  // Cookie le plus vendu du mois (auxiliaires D4/D5, colonne D déjà masquée)
  dashboard.getCell('D4').value = {
    formula: cookieNames.length ? "MAX('Stats biscuits'!B:B)" : '0',
  };
  dashboard.getCell('D5').value = {
    formula: cookieNames.length
      ? 'IF(D4=0,"—",INDEX(\'Stats biscuits\'!A:A,MATCH(D4,\'Stats biscuits\'!B:B,0)))'
      : '"—"',
  };

  dashboard.getCell('A17').value = '🍪 Cookie le plus vendu (mois)';
  dashboard.getCell('B17').value = {
    formula: 'IF(D4=0,"—",D5&" ("&TEXT(D4,"0")&" unités)")',
  };
  dashboard.getCell('B17').font = { bold: true, size: 12, color: { argb: cherry } };
  dashboard.getCell('A17').font = { bold: true };

  // Cookie le moins vendu (MINIFS > 0)
  dashboard.getCell('D6').value = {
    formula: cookieNames.length
      ? 'IF(COUNTIFS(\'Stats biscuits\'!B:B,">0")=0,0,MINIFS(\'Stats biscuits\'!B:B,\'Stats biscuits\'!B:B,">0"))'
      : '0',
  };
  dashboard.getCell('D7').value = {
    formula: cookieNames.length
      ? 'IF(D6=0,"—",INDEX(\'Stats biscuits\'!A:A,MATCH(D6,\'Stats biscuits\'!B:B,0)))'
      : '"—"',
  };
  dashboard.getCell('A18').value = '📉 Cookie le moins vendu (mois)';
  dashboard.getCell('B18').value = {
    formula: 'IF(D6=0,"—",D7&" ("&TEXT(D6,"0")&" unités)")',
  };
  dashboard.getCell('B18').font = { bold: true, size: 12, color: { argb: 'FF555555' } };
  dashboard.getCell('A18').font = { bold: true };

  // Section — synthèse
  dashboard.mergeCells('A21:B21');
  dashboard.getCell('A21').value = '📈 Synthèse';
  dashboard.getCell('A21').fill = sectionFill;
  dashboard.getCell('A21').font = { bold: true, color: { argb: cherry } };

  dashboard.getCell('A22').value = 'Trésorerie totale (banque + comptant)';
  dashboard.getCell('B22').value = { formula: 'B6+B7' };
  dashboard.getCell('B22').numFmt = '#,##0.00" $"';

  dashboard.getCell('A23').value = 'Profit estimé global (trésorerie − dépenses du mois)';
  dashboard.getCell('B23').value = { formula: 'B22-B11' };
  dashboard.getCell('B23').numFmt = '#,##0.00" $"';

  // Instructions
  dashboard.mergeCells('A25:B28');
  dashboard.getCell('A25').value = [
    'Comment utiliser :',
    '1. Choisissez le mois en B2 — stats et graphiques se mettent à jour.',
    '2. Consultez la feuille « Graphiques » pour les diagrammes visuels.',
    '3. Ajoutez vos ventes dans « Ventes » (colonne Produit : ex. 2x Dulce Lava).',
    '4. Cookies +/- vendus : feuille « Stats biscuits ». Nécessite Excel 365.',
  ].join('\n');
  dashboard.getCell('A25').alignment = { wrapText: true, vertical: 'top' };
  dashboard.getCell('A25').font = { size: 10, color: { argb: 'FF666666' } };

  dashboard.getColumn(1).width = 42;
  dashboard.getColumn(2).width = 28;

  // --- Feuille Stats biscuits ---
  let statsBiscuits = wb.getWorksheet('Stats biscuits');
  if (statsBiscuits) wb.removeWorksheet(statsBiscuits.id);
  statsBiscuits = wb.addWorksheet('Stats biscuits');

  statsBiscuits.getCell('A1').value = 'Biscuit';
  statsBiscuits.getCell('B1').value = 'Quantité (mois sélectionné)';
  statsBiscuits.getCell('C1').value = 'Quantité (totale)';
  statsBiscuits.getCell('D1').value = 'Col. Ventes';
  [statsBiscuits.getCell('A1'), statsBiscuits.getCell('B1'), statsBiscuits.getCell('C1')].forEach((cell) => {
    cell.font = { bold: true, color: { argb: cherry } };
    cell.fill = headerFill;
  });
  statsBiscuits.getColumn(4).hidden = true;

  cookieNames.forEach((name, index) => {
    const r = index + 2;
    const ventesCol = colLetter(COOKIE_COL_START + index);
    statsBiscuits.getCell(`A${r}`).value = name;
    statsBiscuits.getCell(`D${r}`).value = ventesCol;
    statsBiscuits.getCell(`B${r}`).value = {
      formula: `SUMPRODUCT((YEAR(Ventes!$A$2:$A$500)='Tableau de bord'!$D$2)*(MONTH(Ventes!$A$2:$A$500)='Tableau de bord'!$D$3)*(TRIM(Ventes!$F$2:$F$500)="confirmer")*Ventes!$${ventesCol}$2:$${ventesCol}$500)`,
    };
    statsBiscuits.getCell(`C${r}`).value = {
      formula: `SUMPRODUCT((TRIM(Ventes!$F$2:$F$500)="confirmer")*Ventes!$${ventesCol}$2:$${ventesCol}$500)`,
    };
    statsBiscuits.getCell(`B${r}`).numFmt = '0';
    statsBiscuits.getCell(`C${r}`).numFmt = '0';
  });

  statsBiscuits.getColumn(1).width = 28;
  statsBiscuits.getColumn(2).width = 26;
  statsBiscuits.getColumn(3).width = 18;

  // --- Feuille Données graphiques ---
  let dataGraph = wb.getWorksheet('Données graphiques');
  if (dataGraph) wb.removeWorksheet(dataGraph.id);
  dataGraph = wb.addWorksheet('Données graphiques');

  dataGraph.getCell('A1').value = '📊 Données pour graphiques (formules dynamiques)';
  dataGraph.getCell('A1').font = { bold: true, size: 14, color: { argb: cherry } };

  dataGraph.getCell('A3').value = 'CA par mois ($)';
  dataGraph.getCell('A3').font = { bold: true, color: { argb: cherry } };
  dataGraph.getCell('A4').value = 'Mois';
  dataGraph.getCell('B4').value = 'Chiffre d\'affaires';
  monthOptions.forEach((key, i) => {
    const r = 5 + i;
    const [y, m] = key.split('-').map(Number);
    dataGraph.getCell(`A${r}`).value = formatMonthLabel(key);
    dataGraph.getCell(`B${r}`).value = {
      formula: `SUMIFS(Ventes!G:G,Ventes!A:A,">="&DATE(${y},${m},1),Ventes!A:A,"<="&EOMONTH(DATE(${y},${m},1),0),Ventes!F:F,"confirmer*")`,
    };
    dataGraph.getCell(`B${r}`).numFmt = '#,##0.00" $"';
  });
  const caStart = 5;
  const caEnd = 4 + monthOptions.length;

  dataGraph.getCell('D3').value = 'Saveurs vendues (mois sélectionné)';
  dataGraph.getCell('D3').font = { bold: true, color: { argb: cherry } };
  dataGraph.getCell('D4').value = 'Biscuit';
  dataGraph.getCell('E4').value = 'Quantité';
  cookieNames.forEach((_, i) => {
    const r = 5 + i;
    dataGraph.getCell(`D${r}`).value = { formula: `'Stats biscuits'!A${i + 2}` };
    dataGraph.getCell(`E${r}`).value = { formula: `'Stats biscuits'!B${i + 2}` };
    dataGraph.getCell(`E${r}`).numFmt = '0';
  });
  const pieStart = 5;
  const pieEnd = 4 + cookieNames.length;

  dataGraph.getCell('G3').value = 'Entrées d\'argent par jour (mois sélectionné)';
  dataGraph.getCell('G3').font = { bold: true, color: { argb: cherry } };
  dataGraph.getCell('G4').value = 'Jour';
  dataGraph.getCell('H4').value = 'Montant ($)';
  for (let d = 1; d <= 31; d++) {
    const r = 4 + d;
    dataGraph.getCell(`G${r}`).value = `J${d}`;
    dataGraph.getCell(`H${r}`).value = {
      formula: `SUMIFS(Ventes!G:G,Ventes!A:A,">="&DATE('Tableau de bord'!$D$2,'Tableau de bord'!$D$3,${d}),Ventes!A:A,"<"&DATE('Tableau de bord'!$D$2,'Tableau de bord'!$D$3,${d}+1),Ventes!F:F,"confirmer*")`,
    };
    dataGraph.getCell(`H${r}`).numFmt = '#,##0.00" $"';
  }

  dataGraph.getColumn(1).width = 22;
  dataGraph.getColumn(2).width = 18;
  dataGraph.getColumn(4).width = 26;
  dataGraph.getColumn(5).width = 12;
  dataGraph.getColumn(7).width = 10;
  dataGraph.getColumn(8).width = 16;

  // --- Feuille Graphiques (titres + graphiques injectés) ---
  let graphiques = wb.getWorksheet('Graphiques');
  if (graphiques) wb.removeWorksheet(graphiques.id);
  graphiques = wb.addWorksheet('Graphiques');
  graphiques.getCell('A1').value = '📈 Graphiques Snackin\' — se mettent à jour selon le mois (B2 du Tableau de bord)';
  graphiques.getCell('A1').font = { bold: true, size: 14, color: { argb: cherry } };
  graphiques.getCell('A2').value = 'Mois actif :';
  graphiques.getCell('B2').value = { formula: "'Tableau de bord'!B3" };
  graphiques.getColumn(1).width = 50;

  // --- Colonnes quantité par biscuit dans Ventes (I, J, K…) ---
  cookieNames.forEach((name, index) => {
    const col = COOKIE_COL_START + index;
    const letter = colLetter(col);
    ventes.getCell(`${letter}1`).value = `Qty ${name}`;
    ventes.getColumn(col).width = 12;
    for (let r = 2; r <= 500; r++) {
      ventes.getCell(`${letter}${r}`).value = { formula: ventesCookieFormula(r, name) };
      ventes.getCell(`${letter}${r}`).numFmt = '0';
    }
  });

  // Formules colonne G pour nouvelles lignes Ventes
  for (let r = 2; r <= 500; r++) {
    ventes.getCell(`G${r}`).value = {
      formula: `IF(D${r}="","",IF(ISNUMBER(D${r}),D${r},VALUE(SUBSTITUTE(SUBSTITUTE(D${r},"$","")," ",""))))`,
    };
    ventes.getCell(`G${r}`).numFmt = '#,##0.00" $"';
  }

  // Générer buffer + injecter graphiques
  let buffer = await wb.xlsx.writeBuffer();

  const chartConfig = {
    sheetName: 'Graphiques',
    charts: [
      {
        type: 'bar',
        title: 'CA par mois',
        catRange: `'Données graphiques'!$A$${caStart}:$A$${caEnd}`,
        valRange: `'Données graphiques'!$B$${caStart}:$B$${caEnd}`,
        barDir: 'col',
        anchor: { col: 0, row: 3, col2: 8, row2: 20 },
      },
      {
        type: 'pie',
        title: 'Saveurs vendues (mois)',
        catRange: `'Données graphiques'!$D$${pieStart}:$D$${pieEnd}`,
        valRange: `'Données graphiques'!$E$${pieStart}:$E$${pieEnd}`,
        anchor: { col: 9, row: 3, col2: 17, row2: 20 },
      },
      {
        type: 'line',
        title: 'Entrées par jour (mois)',
        catRange: `'Données graphiques'!$G$5:$G$35`,
        valRange: `'Données graphiques'!$H$5:$H$35`,
        anchor: { col: 0, row: 21, col2: 12, row2: 38 },
      },
    ],
  };

  try {
    buffer = await injectExcelCharts(Buffer.from(buffer), chartConfig);
    console.log('✅ Graphiques injectés (3 diagrammes)');
  } catch (chartErr) {
    console.warn('⚠️ Graphiques non injectés:', chartErr.message);
    console.warn('   Les données restent dans « Données graphiques ».');
  }

  let savedPath = '';
  for (const target of [outputPath, outputV3Path, outputCopyPath, outputFallbackPath]) {
    try {
      fs.writeFileSync(target, buffer);
      savedPath = target;
      console.log('✅ Fichier créé:', target);
      break;
    } catch (err) {
      if (err.code === 'EBUSY') {
        console.warn('⚠️ Verrouillé:', target);
      } else {
        throw err;
      }
    }
  }
  if (!savedPath) {
    throw new Error('Impossible d\'écrire le fichier — fermez Excel et relancez le script.');
  }
  console.log('   Mois par défaut:', defaultMonth, '—', formatMonthLabel(defaultMonth));
  console.log('   Mois disponibles:', monthOptions.map(formatMonthLabel).join(', '));
  console.log('   Biscuits détectés:', cookieNames.length ? cookieNames.join(', ') : '(aucun)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
