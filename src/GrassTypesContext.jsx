import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const GrassTypesContext = createContext();
export const useGrassTypes = () => useContext(GrassTypesContext);

export function GrassTypesProvider({ children }) {
  const [types, setTypes] = useState([]);   // [{ id, name, color }]

  useEffect(() => {
    async function fetchAll() {
      const { data, error } = await supabase
        .from('grass_types')
        .select('*')
        .order('id', { ascending: true });
      if (!error && data) setTypes(data);
    }
    fetchAll();
  }, []);

  /** 새 풀 종류 추가 (입력 중 바로 추가) */
  async function addType(name, color) {
    const { data, error } = await supabase
      .from('grass_types')
      .insert({ name, color })
      .select()
      .single();
    if (!error && data) {
      setTypes(prev => [...prev, data]);
      return data;
    }
    return null;
  }

  /** 풀 색상 변경 */
  async function updateTypeColor(id, newColor) {
    const { error } = await supabase
      .from('grass_types')
      .update({ color: newColor })
      .eq('id', id);
    if (!error) {
      setTypes(prev => prev.map(t => t.id === id ? { ...t, color: newColor } : t));
    }
  }

  /** 풀 이름 변경 */
  async function updateTypeName(id, newName) {
    const { error } = await supabase
      .from('grass_types')
      .update({ name: newName })
      .eq('id', id);
    if (!error) {
      setTypes(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
    }
    return !error;
  }

  /** 풀 종류 삭제 */
  async function deleteType(id) {
    const { error } = await supabase
      .from('grass_types')
      .delete()
      .eq('id', id);
    if (!error) {
      setTypes(prev => prev.filter(t => t.id !== id));
    }
    return !error;
  }

  /** 색상 맵 (name → color) */
  const colorMap = {};
  types.forEach(t => { colorMap[t.name] = t.color; });

  return (
    <GrassTypesContext.Provider value={{ types, colorMap, addType, updateTypeColor, updateTypeName, deleteType }}>
      {children}
    </GrassTypesContext.Provider>
  );
}
