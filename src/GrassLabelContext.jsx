import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const GrassLabelContext = createContext();
export const useGrassLabels = () => useContext(GrassLabelContext);

export function GrassLabelProvider({ children }) {
  const [labels, setLabels] = useState({});      // { "Grass-1-1": {name,color,disabled} }

  /* ─── 1. initial fetch ─────────────────────────────────────────── */
  useEffect(() => {
    async function fetchAll() {
      const { data, error } = await supabase.from('grass_labels').select('*');
      if (!error && data) {
        const obj = {};
        data.forEach(({ id, name, color, disabled }) => {
          obj[id] = { name, color, disabled: disabled || false };
        });
        setLabels(obj);
      }
    }
    fetchAll();
  }, []);

  /* ─── 2. update helper + save to Supabase ──────────────────────── */
  async function upsert(id, payload) {
    setLabels(prev => ({ ...prev, [id]: { ...prev[id], ...payload } }));

    await supabase.from('grass_labels').upsert({
      id,
      name: payload.name ?? labels[id]?.name ?? null,
      color: payload.color ?? labels[id]?.color ?? null,
      disabled: payload.disabled ?? labels[id]?.disabled ?? false,
    });
  }

  /* ─── 3. realtime subscription ──────────────────────────────────── */
  useEffect(() => {
    const channel = supabase
      .channel('grass-labels')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grass_labels' },
        ({ new: row }) =>
          setLabels(prev => ({
            ...prev,
            [row.id]: {
              name: row.name,
              color: row.color,
              disabled: row.disabled || false
            }
          }))
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <GrassLabelContext.Provider value={{ labels, upsert }}>
      {children}
    </GrassLabelContext.Provider>
  );
}
