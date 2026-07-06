// src/utils/farmerClock.js
// 농부 출퇴근 기록 — farmer_status(현재 상태) + farmer_log(기록)를 한 번에 저장.
// farmer_log 직접쓰기는 RLS로 막혀 있어, security-definer RPC(farm_set_status)를 통해 저장한다.
// (손님용 VINE OWNER 앱이 이 기록을 읽어 '출근/퇴근' 타임라인으로 보여준다)
import { supabase } from '../supabaseClient';

// 아침보고 확정 시 자동 호출 → 출근. 같은 날 중복 출근 기록은 RPC가 알아서 방지한다.
export async function clockIn() {
  try {
    await supabase.rpc('farm_set_status', { p_status: 'work' });
  } catch (_) { /* 실패해도 아침보고 흐름은 막지 않는다 */ }
}

// '최종 퇴근' 버튼 → 퇴근 기록. 성공 여부(boolean) 반환.
export async function clockOut() {
  const { error } = await supabase.rpc('farm_set_status', { p_status: 'off' });
  return !error;
}
