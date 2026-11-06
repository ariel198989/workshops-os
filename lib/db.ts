import { createClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY } from './config';

export const sb = createClient(SB_URL, SB_KEY);
