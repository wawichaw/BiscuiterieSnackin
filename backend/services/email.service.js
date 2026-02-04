import nodemailer from 'nodemailer';

// Configuration du transporteur email
// Fonctionne avec n'importe quel service SMTP (Gmail, Outlook, Yahoo, etc.)
const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465; // Port 465 utilise SSL/TLS, les autres utilisent STARTTLS
  
  return nodemailer.createTransport({
    host: host,
    port: port,
    secure: secure, // true pour 465, false pour les autres ports (587, etc.)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Options supplémentaires pour une meilleure compatibilité
    tls: {
      rejectUnauthorized: false, // Accepte les certificats auto-signés (utile pour certains serveurs)
    },
  });
};

const transporter = getTransporter();

/**
 * Envoie un email de confirmation de commande
 * @param {Object} options - Options de l'email
 * @param {String} options.to - Adresse email du destinataire
 * @param {String} options.nomClient - Nom du client
 * @param {String} options.numeroCommande - Numéro de commande
 * @param {Number} options.total - Total de la commande
 * @param {String} options.typeReception - Type de réception ('ramassage' ou 'livraison')
 * @param {String} options.pointRamassage - Point de ramassage (si ramassage)
 * @param {Date} options.dateRamassage - Date de ramassage (si ramassage)
 * @param {String} options.heureRamassage - Heure de ramassage (si ramassage)
 * @param {String} options.villeLivraison - Ville de livraison (si livraison)
 * @param {Object} options.adresseLivraison - Adresse de livraison (si livraison)
 * @param {Date} options.dateLivraison - Date de livraison (si livraison)
 * @param {String} options.heureLivraison - Heure de livraison (si livraison)
 * @param {Array} options.boites - Boîtes commandées
 */
export const envoyerEmailConfirmation = async (options) => {
  try {
    // Vérifier que les variables d'environnement sont configurées
    console.log('📧 Tentative d\'envoi d\'email...');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_USER:', process.env.SMTP_USER ? 'Configuré' : 'Non configuré');
    console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? 'Configuré' : 'Non configuré');
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('⚠️  SMTP non configuré. Email non envoyé.');
      console.warn('SMTP_USER:', process.env.SMTP_USER);
      console.warn('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? 'Présent' : 'Absent');
      return { success: false, message: 'SMTP non configuré' };
    }

    const { 
      to, 
      nomClient, 
      numeroCommande, 
      total, 
      typeReception,
      pointRamassage, 
      dateRamassage, 
      heureRamassage,
      villeLivraison,
      adresseLivraison,
      dateLivraison,
      heureLivraison,
      boites 
    } = options;

    // Formater la date selon le type de réception
    let dateFormatee, heureFormatee, lieuInfo;
    if (typeReception === 'ramassage') {
      dateFormatee = new Date(dateRamassage).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      heureFormatee = heureRamassage;
      lieuInfo = `<p><strong>Point de ramassage :</strong> ${pointRamassage.charAt(0).toUpperCase() + pointRamassage.slice(1)}</p>`;
    } else {
      dateFormatee = new Date(dateLivraison).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      heureFormatee = heureLivraison || '18:00';
      lieuInfo = `
        <p><strong>Ville :</strong> ${villeLivraison.charAt(0).toUpperCase() + villeLivraison.slice(1)}</p>
        <p><strong>Adresse :</strong> ${adresseLivraison.rue}, ${adresseLivraison.codePostal}</p>
        ${adresseLivraison.instructions ? `<p><strong>Instructions :</strong> ${adresseLivraison.instructions}</p>` : ''}
      `;
    }

    // Créer le HTML de l'email
    const boitesHTML = boites.map((boite, index) => {
      const saveursHTML = boite.saveurs.map(s => {
        const nomBiscuit = s.biscuit?.nom || 'Biscuit';
        return `<li>${s.quantite}x ${nomBiscuit}</li>`;
      }).join('');

      return `
        <div style="margin-bottom: 20px; padding: 15px; background: #fff5f7; border-radius: 8px;">
          <strong>Boîte ${index + 1} - ${boite.taille} biscuits (${boite.prix.toFixed(2)} $)</strong>
          <ul style="margin: 10px 0 0 20px; padding: 0;">
            ${saveursHTML}
          </ul>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #a0162b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #a0162b; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍪 Snackin' - Confirmation de commande</h1>
            </div>
            <div class="content">
              <p>Bonjour ${nomClient},</p>
              
              <p>Votre commande <strong>#${numeroCommande}</strong> est maintenant <strong>en traitement</strong> !</p>
              
              <h2>Détails de votre commande :</h2>
              ${boitesHTML}
              
              <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                <p><strong>Total :</strong> ${total.toFixed(2)} $</p>
                ${lieuInfo}
                <p><strong>Date et heure :</strong> ${dateFormatee} à ${heureFormatee}</p>
              </div>
              
              <p style="margin-top: 30px;">Nous vous contacterons lorsque votre commande sera prête !</p>
              
              <p>Merci pour votre commande ! 🍪</p>
              
              <p style="margin-top: 30px;">
                <strong>L'équipe Snackin'</strong>
              </p>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const texte = `
Bonjour ${nomClient},

Votre commande #${numeroCommande} est maintenant en traitement !

Détails de votre commande :
${boites.map((boite, index) => {
  const saveurs = boite.saveurs.map(s => `${s.quantite}x ${s.biscuit?.nom || 'Biscuit'}`).join(', ');
  return `Boîte ${index + 1} - ${boite.taille} biscuits (${boite.prix.toFixed(2)} $) : ${saveurs}`;
}).join('\n')}

Total : ${total.toFixed(2)} $
${typeReception === 'ramassage' 
  ? `Point de ramassage : ${pointRamassage.charAt(0).toUpperCase() + pointRamassage.slice(1)}`
  : `Ville : ${villeLivraison.charAt(0).toUpperCase() + villeLivraison.slice(1)}\nAdresse : ${adresseLivraison.rue}, ${adresseLivraison.codePostal}${adresseLivraison.instructions ? `\nInstructions : ${adresseLivraison.instructions}` : ''}`
}
Date et heure : ${dateFormatee} à ${heureFormatee}

Nous vous contacterons lorsque votre commande sera prête !

Merci pour votre commande !
L'équipe Snackin'
    `;

    console.log('📧 Envoi de l\'email à:', to);
    console.log('📧 Nom du client:', nomClient);
    console.log('📧 Numéro de commande:', numeroCommande);
    
    const info = await transporter.sendMail({
      from: `"Snackin'" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `🍪 Snackin' - Votre commande #${numeroCommande} est en traitement`,
      text: texte,
      html: html,
    });

    console.log('✅ Email envoyé avec succès!');
    console.log('✅ Message ID:', info.messageId);
    console.log('✅ Destinataire:', to);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:');
    console.error('❌ Type d\'erreur:', error.constructor.name);
    console.error('❌ Message:', error.message);
    console.error('❌ Code:', error.code);
    console.error('❌ Stack:', error.stack);
    return { success: false, error: error.message };
  }
};

/**
 * Envoie un email de remerciement et invitation à laisser un avis
 * @param {Object} options - Options de l'email
 * @param {String} options.to - Adresse email du destinataire
 * @param {String} options.nomClient - Nom du client
 * @param {String} options.numeroCommande - Numéro de commande
 */
export const envoyerEmailRemerciement = async (options) => {
  try {
    // Vérifier que les variables d'environnement sont configurées
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('⚠️  SMTP non configuré. Email non envoyé.');
      return { success: false, message: 'SMTP non configuré' };
    }

    const { to, nomClient, numeroCommande } = options;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #a0162b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background: #a0162b; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍪 Snackin' - Merci pour votre commande !</h1>
            </div>
            <div class="content">
              <p>Bonjour ${nomClient},</p>
              
              <p>Votre commande <strong>#${numeroCommande}</strong> a été complétée avec succès !</p>
              
              <p style="margin-top: 30px;">Nous espérons que vous avez apprécié nos biscuits ! 🍪</p>
              
              <div style="margin-top: 30px; padding: 20px; background: #fff5f7; border-radius: 8px; text-align: center;">
                <h2 style="color: #a0162b; margin-top: 0;">Votre avis nous tient à cœur !</h2>
                <p>Nous serions ravis de connaître votre expérience avec Snackin'. Votre avis nous aide à améliorer nos produits et notre service.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/commentaires" class="button" style="text-decoration: none; color: white;">
                  💬 Laisser un avis
                </a>
              </div>
              
              <p style="margin-top: 30px;">Nous espérons vous revoir très bientôt !</p>
              
              <p>Merci encore pour votre confiance ! 🍪</p>
              
              <p style="margin-top: 30px;">
                <strong>L'équipe Snackin'</strong>
              </p>
            </div>
            <div class="footer">
              <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const texte = `
Bonjour ${nomClient},

Votre commande #${numeroCommande} a été complétée avec succès !

Nous espérons que vous avez apprécié nos biscuits ! 🍪

Votre avis nous tient à cœur !
Nous serions ravis de connaître votre expérience avec Snackin'. Votre avis nous aide à améliorer nos produits et notre service.

Visitez notre page de commentaires : ${process.env.FRONTEND_URL || 'http://localhost:3000'}/commentaires

Nous espérons vous revoir très bientôt !

Merci encore pour votre confiance !
L'équipe Snackin'
    `;

    console.log('📧 Envoi de l\'email de remerciement à:', to);
    
    const info = await transporter.sendMail({
      from: `"Snackin'" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `🍪 Snackin' - Merci pour votre commande #${numeroCommande} !`,
      text: texte,
      html: html,
    });

    console.log('✅ Email de remerciement envoyé avec succès!');
    console.log('✅ Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de remerciement:');
    console.error('❌ Message:', error.message);
    return { success: false, error: error.message };
  }
};

export default { envoyerEmailConfirmation, envoyerEmailRemerciement };

