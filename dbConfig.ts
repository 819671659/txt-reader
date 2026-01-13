
import { DbConfig } from './types';

/**
 * Global Database Configuration
 * In a production environment, these should be handled via environment variables 
 * or a secure backend service.
 */
export const DB_CONFIG: DbConfig = {
  host: '127.0.0.1',
  port: '3306',
  user: 'root',
  pass: 'password123' // Default password placeholder
};
