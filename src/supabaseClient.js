// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Replace with your values from Project Settings -> API
const supabaseUrl = 'https://uablztntzdfqbdadrinf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhYmx6dG50emRmcWJkYWRyaW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDQxNDEsImV4cCI6MjA5NTIyMDE0MX0.wgReJQ1uZSrOVM2MQywI-DFMZ7vxvscbaFmbZvdHZ4U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);