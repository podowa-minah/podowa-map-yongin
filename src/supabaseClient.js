// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// ⚠️ 임시: 친구 Supabase 사용 중 (진짜 데이터)
// 나중에 데이터 마이그레이션 끝나면 다시 본인 Supabase로 변경:
//   url: 'https://uablztntzdfqbdadrinf.supabase.co'
//   anon: (본인 Supabase anon key)
const supabaseUrl = 'https://xmysqbfuihialtvbsshb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteXNxYmZ1aWhpYWx0dmJzc2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExOTk0MTEsImV4cCI6MjA4Njc3NTQxMX0.XObG3tb7agaKW7ZW63OrxR5a1GCX_SqQvQdFPzytues';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);