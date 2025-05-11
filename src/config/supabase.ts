import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Çevre değişkenlerini kontrol et
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL veya anonim anahtar eksik. Lütfen .env dosyanızı kontrol edin.');
}

// Admin işlemleri için service role key gereklidir
if (!supabaseServiceKey) {
  console.warn('UYARI: Supabase Service Role Key eksik. Admin işlemleri çalışmayacak!');
}

// Supabase istemcisini oluştur
// Admin işlemleri için service role key kullanılmalıdır
export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}); 