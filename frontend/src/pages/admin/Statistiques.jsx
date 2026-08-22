import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { libelleVilleDepuisSlug } from '../../utils/ramassage';
import {
  SOURCE_DECOUVERTE_LABELS,
  getSourceDecouverteCategorie,
  getSourceDecouverteLabel,
  isLienPaiementAdmin,
} from '../../utils/sourceDecouverte';
import './Statistiques.css';

const SOURCE_ORDER = [
  'instagram',
  'facebook',
  'tiktok',
  'internet',
  'bouche_a_oreille',
  'evenement',
  'autre',
  'non_renseigne',
];

const SOURCE_COLORS = {
  instagram: '#c13584',
  facebook: '#1877f2',
  tiktok: '#111111',
  internet: '#4285f4',
  bouche_a_oreille: '#d97706',
  evenement: '#7c3aed',
  autre: '#a0162b',
  non_renseigne: '#9ca3af',
};

const pad = (n) => String(n).padStart(2, '0');

const toLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const endOfMonth = (d) => endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));

const formatDateHeure = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateCourt = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatMoney = (n) => `${Number(n || 0).toFixed(2)} $`;

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const excelCell = (value, type = 'String') => {
  if (type === 'Number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '<Cell><Data ss:Type="Number">0</Data></Cell>';
    return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
};

const excelSheet = (name, headers, rows, types) => {
  const headerRow = `<Row>${headers.map((h) => excelCell(h)).join('')}</Row>`;
  const dataRows = rows.map((row) => (
    `<Row>${headers.map((header, i) => excelCell(row[header], types[i] || 'String')).join('')}</Row>`
  )).join('');
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
};

const telechargerExcel = (xml, filename) => {
  const blob = new Blob([`\uFEFF${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const resumeBoites = (commande) => {
  if (!commande.boites?.length) return '';
  return commande.boites.map((boite, index) => {
    const saveurs = (boite.saveurs || [])
      .map((s) => `${s.quantite}x ${s.biscuit?.nom || 'Biscuit'}`)
      .join(', ');
    return `Boîte ${index + 1} (${boite.taille} biscuits${saveurs ? `: ${saveurs}` : ''})`;
  }).join(' | ');
};

const compterSaveurs = (commandes) => {
  const map = new Map();
  for (const commande of commandes) {
    for (const boite of commande.boites || []) {
      for (const saveur of boite.saveurs || []) {
        const nom = saveur.biscuit?.nom || 'Biscuit';
        map.set(nom, (map.get(nom) || 0) + (saveur.quantite || 0));
      }
    }
  }
  return [...map.entries()]
    .map(([nom, quantite]) => ({ nom, quantite }))
    .sort((a, b) => b.quantite - a.quantite);
};

const AdminStatistiques = () => {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState('tout');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get('/commandes?archivees=all');
        setCommandes(response.data?.data?.commandes || []);
      } catch (err) {
        console.error('Erreur chargement statistiques:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const bornes = useMemo(() => {
    const now = new Date();
    if (periode === 'mois') {
      return { debut: startOfMonth(now), fin: endOfMonth(now) };
    }
    if (periode === 'mois_dernier') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { debut: startOfMonth(prev), fin: endOfMonth(prev) };
    }
    if (periode === 'annee') {
      return { debut: new Date(now.getFullYear(), 0, 1), fin: endOfDay(new Date(now.getFullYear(), 11, 31)) };
    }
    if (periode === 'perso') {
      return {
        debut: dateDebut ? new Date(`${dateDebut}T00:00:00`) : null,
        fin: dateFin ? new Date(`${dateFin}T23:59:59`) : null,
      };
    }
    return { debut: null, fin: null };
  }, [periode, dateDebut, dateFin]);

  const commandesFiltrees = useMemo(() => {
    return commandes.filter((commande) => {
      const created = new Date(commande.createdAt);
      if (bornes.debut && created < bornes.debut) return false;
      if (bornes.fin && created > bornes.fin) return false;
      return true;
    });
  }, [commandes, bornes]);

  const kpis = useMemo(() => {
    const totalCommandes = commandesFiltrees.length;
    const chiffreAffaires = commandesFiltrees.reduce((sum, c) => sum + (c.total || 0), 0);
    const panierMoyen = totalCommandes ? chiffreAffaires / totalCommandes : 0;
    const ramassage = commandesFiltrees.filter((c) => c.typeReception === 'ramassage').length;
    return { totalCommandes, chiffreAffaires, panierMoyen, ramassage };
  }, [commandesFiltrees]);

  const commandesFormulaire = useMemo(
    () => commandesFiltrees.filter((commande) => !isLienPaiementAdmin(commande)),
    [commandesFiltrees],
  );

  const nbLiensAdmin = commandesFiltrees.length - commandesFormulaire.length;

  const sources = useMemo(() => {
    const counts = {};
    for (const commande of commandesFormulaire) {
      const { key } = getSourceDecouverteCategorie(commande);
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = commandesFormulaire.length || 1;
    const rows = SOURCE_ORDER
      .filter((key) => counts[key])
      .map((key) => ({
        key,
        label: key === 'non_renseigne'
          ? 'Non renseigné'
          : SOURCE_DECOUVERTE_LABELS[key] || key,
        count: counts[key],
        pct: Math.round((counts[key] / total) * 1000) / 10,
      }));
    const extra = Object.keys(counts)
      .filter((key) => !SOURCE_ORDER.includes(key) && key !== 'lien_admin')
      .map((key) => ({
        key,
        label: key,
        count: counts[key],
        pct: Math.round((counts[key] / total) * 1000) / 10,
      }));
    return [...rows, ...extra].sort((a, b) => b.count - a.count);
  }, [commandesFormulaire]);

  const maxSource = sources[0]?.count || 1;

  const autresDetails = useMemo(() => {
    const map = new Map();
    for (const commande of commandesFormulaire) {
      if (commande.sourceDecouverte !== 'autre') continue;
      const detail = (commande.sourceDecouverteAutre || 'Non précisé').trim();
      map.set(detail, (map.get(detail) || 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [commandesFormulaire]);

  const lieux = useMemo(() => {
    const map = new Map();
    for (const commande of commandesFiltrees) {
      const slug = commande.pointRamassage || commande.villeLivraison || 'inconnu';
      map.set(slug, (map.get(slug) || 0) + 1);
    }
    return [...map.entries()]
      .map(([slug, count]) => ({ slug, label: libelleVilleDepuisSlug(slug) || slug, count }))
      .sort((a, b) => b.count - a.count);
  }, [commandesFiltrees]);

  const saveurs = useMemo(() => compterSaveurs(commandesFiltrees).slice(0, 8), [commandesFiltrees]);
  const maxSaveur = saveurs[0]?.quantite || 1;

  const exporterExcel = () => {
    const commandesHeaders = [
      'N° commande',
      'Date commande',
      'Client',
      'Courriel',
      'Téléphone',
      'Comment nous a trouvé',
      'Source (catégorie)',
      'Précision source',
      'Type de réception',
      'Lieu',
      'Date ramassage/livraison',
      'Heure',
      'Statut',
      'Paiement',
      'Paiement confirmé',
      'Total ($)',
      'Boîtes et saveurs',
      'Archivée',
      'Créée par admin',
    ];
    const commandesRows = commandesFiltrees.map((commande) => {
      const dateRdv = commande.typeReception === 'ramassage'
        ? commande.dateRamassage
        : commande.dateLivraison;
      const heure = commande.heureRamassage || commande.heureLivraison || '';
      const cat = getSourceDecouverteCategorie(commande);
      return {
        'N° commande': commande._id?.slice(-6) || '',
        'Date commande': formatDateHeure(commande.createdAt),
        Client: commande.user?.name || commande.visiteurNom || '',
        Courriel: commande.user?.email || commande.visiteurEmail || '',
        Téléphone: commande.visiteurTelephone || '',
        'Comment nous a trouvé': getSourceDecouverteLabel(commande),
        'Source (catégorie)': cat.label,
        'Précision source': isLienPaiementAdmin(commande) ? '' : (commande.sourceDecouverteAutre || ''),
        'Type de réception': commande.typeReception === 'ramassage' ? 'Ramassage' : 'Livraison',
        Lieu: libelleVilleDepuisSlug(commande.pointRamassage || commande.villeLivraison) || '',
        'Date ramassage/livraison': dateRdv ? formatDateCourt(dateRdv) : '',
        Heure: heure,
        Statut: commande.statut || '',
        Paiement: commande.methodePaiement === 'sur_place' ? 'Sur place' : 'En ligne',
        'Paiement confirmé': commande.paiementConfirme ? 'Oui' : 'Non',
        'Total ($)': commande.total || 0,
        'Boîtes et saveurs': resumeBoites(commande),
        Archivée: commande.archivee ? 'Oui' : 'Non',
        'Créée par admin': commande.creeParAdmin ? 'Oui' : 'Non',
      };
    });
    const commandesTypes = commandesHeaders.map((h) => (h === 'Total ($)' ? 'Number' : 'String'));

    const sourcesHeaders = ['Source', 'Nombre de commandes', 'Pourcentage'];
    const sourcesRows = sources.map((s) => ({
      Source: s.label,
      'Nombre de commandes': s.count,
      Pourcentage: s.pct,
    }));
    const sourcesTypes = ['String', 'Number', 'Number'];

    const saveursAll = compterSaveurs(commandesFiltrees);
    const saveursHeaders = ['Saveur', 'Quantité vendue'];
    const saveursRows = saveursAll.map((s) => ({
      Saveur: s.nom,
      'Quantité vendue': s.quantite,
    }));
    const saveursTypes = ['String', 'Number'];

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${excelSheet('Commandes', commandesHeaders, commandesRows, commandesTypes)}
${excelSheet('Sources', sourcesHeaders, sourcesRows, sourcesTypes)}
${excelSheet('Saveurs', saveursHeaders, saveursRows, saveursTypes)}
</Workbook>`;

    telechargerExcel(xml, `snackin-statistiques-${toLocalDateKey(new Date())}.xls`);
  };

  return (
    <div className="admin-stats-page">
      <div className="stats-page-header">
        <div>
          <h1>Statistiques</h1>
          <p className="stats-page-subtitle">
            D’où viennent vos clientes, combien de commandes, et un export Excel de toutes les infos.
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={exporterExcel}
          disabled={loading || commandesFiltrees.length === 0}
        >
          Exporter vers Excel
        </button>
      </div>

      <div className="stats-filters">
        <div className="stats-periodes" role="group" aria-label="Période">
          {[
            { id: 'tout', label: 'Tout' },
            { id: 'mois', label: 'Ce mois' },
            { id: 'mois_dernier', label: 'Mois dernier' },
            { id: 'annee', label: 'Cette année' },
            { id: 'perso', label: 'Dates précises' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`stats-periode ${periode === opt.id ? 'active' : ''}`}
              onClick={() => setPeriode(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {periode === 'perso' && (
          <div className="stats-dates-perso">
            <label>
              Du
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </label>
            <label>
              Au
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {loading ? (
        <p className="stats-empty">Chargement des statistiques…</p>
      ) : commandes.length === 0 ? (
        <p className="stats-empty">Aucune commande pour le moment.</p>
      ) : commandesFiltrees.length === 0 ? (
        <p className="stats-empty">Aucune commande sur cette période.</p>
      ) : (
        <>
          <div className="stats-kpis">
            <div className="stats-kpi">
              <span className="stats-kpi-label">Commandes</span>
              <strong>{kpis.totalCommandes}</strong>
            </div>
            <div className="stats-kpi">
              <span className="stats-kpi-label">Chiffre d’affaires</span>
              <strong>{formatMoney(kpis.chiffreAffaires)}</strong>
            </div>
            <div className="stats-kpi">
              <span className="stats-kpi-label">Panier moyen</span>
              <strong>{formatMoney(kpis.panierMoyen)}</strong>
            </div>
            <div className="stats-kpi">
              <span className="stats-kpi-label">Ramassage</span>
              <strong>{kpis.ramassage}</strong>
            </div>
          </div>

          <section className="stats-card">
            <h2>Comment nous ont-elles trouvés ?</h2>
            <p className="stats-card-hint">
              Uniquement les réponses du formulaire de commande (Instagram, Facebook, etc.).
            </p>
            {sources.length === 0 ? (
              <p className="stats-empty-inline">
                Aucune réponse de formulaire sur cette période.
              </p>
            ) : (
              <div className="stats-bars">
                {sources.map((source) => (
                  <div key={source.key} className="stats-bar-row">
                    <span className="stats-bar-label">{source.label}</span>
                    <div className="stats-bar-track">
                      <div
                        className="stats-bar-fill"
                        style={{
                          width: `${Math.max(6, (source.count / maxSource) * 100)}%`,
                          background: SOURCE_COLORS[source.key] || 'var(--cherry)',
                        }}
                      />
                    </div>
                    <span className="stats-bar-value">
                      {source.count} ({source.pct} %)
                    </span>
                  </div>
                ))}
              </div>
            )}
            {nbLiensAdmin > 0 && (
              <p className="stats-note-admin">
                {nbLiensAdmin} commande{nbLiensAdmin > 1 ? 's' : ''} créée{nbLiensAdmin > 1 ? 's' : ''} par lien de paiement admin — ce n’est pas une option du formulaire, donc elles ne sont pas dans ce graphique.
              </p>
            )}
            {autresDetails.length > 0 && (
              <div className="stats-autres">
                <h3>Précisions « Autre »</h3>
                <ul>
                  {autresDetails.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="stats-grid">
            <section className="stats-card">
              <h2>Saveurs les plus commandées</h2>
              {saveurs.length === 0 ? (
                <p className="stats-empty-inline">Aucune saveur à afficher.</p>
              ) : (
                <div className="stats-bars">
                  {saveurs.map((s) => (
                    <div key={s.nom} className="stats-bar-row">
                      <span className="stats-bar-label">{s.nom}</span>
                      <div className="stats-bar-track">
                        <div
                          className="stats-bar-fill stats-bar-fill-pink"
                          style={{ width: `${Math.max(6, (s.quantite / maxSaveur) * 100)}%` }}
                        />
                      </div>
                      <span className="stats-bar-value">{s.quantite}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="stats-card">
              <h2>Par lieu de ramassage</h2>
              {lieux.length === 0 ? (
                <p className="stats-empty-inline">Aucun lieu à afficher.</p>
              ) : (
                <ul className="stats-list">
                  {lieux.map((lieu) => (
                    <li key={lieu.slug}>
                      <span>{lieu.label}</span>
                      <strong>{lieu.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="stats-card">
            <div className="stats-table-header">
              <h2>Commandes de la période</h2>
              <Link to="/admin/commandes" className="stats-link">Voir le suivi des commandes →</Link>
            </div>
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Source</th>
                    <th>Lieu</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {commandesFiltrees.slice(0, 40).map((commande) => (
                    <tr key={commande._id}>
                      <td>{formatDateHeure(commande.createdAt)}</td>
                      <td>{commande.user?.name || commande.visiteurNom || '—'}</td>
                      <td>{getSourceDecouverteLabel(commande)}</td>
                      <td>{libelleVilleDepuisSlug(commande.pointRamassage || commande.villeLivraison) || '—'}</td>
                      <td>{formatMoney(commande.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {commandesFiltrees.length > 40 && (
              <p className="stats-table-more">
                {commandesFiltrees.length - 40} autres commandes sont incluses dans l’export Excel.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminStatistiques;
