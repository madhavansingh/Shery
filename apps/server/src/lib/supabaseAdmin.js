import { createClient } from '@supabase/supabase-js';
import config from '../config/env.js';
import logger from '../loggers/logger.js';

let _supabaseAdmin = null;

/**
 * Returns a singleton Supabase admin client.
 * Uses the SERVICE_ROLE_KEY (server-side only — never expose to clients).
 */
export function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    logger.warn('Supabase credentials not configured — storage operations will fail if STORAGE_PROVIDER=supabase');
    return null;
  }

  _supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logger.info('Supabase admin client initialized', { url: config.supabaseUrl });
  return _supabaseAdmin;
}

export default getSupabaseAdmin;
