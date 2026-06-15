import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config();

const to = process.env.TEST_EMAIL || 'snackin.mtl@gmail.com';
const from = process.env.SENDGRID_FROM || "Snackin' <snackin.mtl@gmail.com>";

if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY manquante dans backend/.env');
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

try {
  await sgMail.send({
    to,
    from,
    subject: "Test Snackin' – envoi SendGrid",
    text: 'Si vous recevez ce message, la configuration SendGrid fonctionne.',
    html: '<p>Si vous recevez ce message, la <strong>configuration SendGrid</strong> fonctionne.</p>',
  });
  console.log('✅ Email test envoyé à:', to);
} catch (error) {
  console.error('❌ Échec envoi test');
  if (error.response?.body) console.error(JSON.stringify(error.response.body, null, 2));
  else console.error(error.message);
  process.exit(1);
}
