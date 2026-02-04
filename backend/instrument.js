/**
 * Chargement des variables d'environnement et initialisation de Sentry.
 * Ce fichier doit être importé en premier dans index.js.
 */
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
}
