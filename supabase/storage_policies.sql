-- ============================================================
-- Podowa Storage 정책 (tree-images 버킷)
-- ============================================================
-- 버킷을 public으로 만들었어도 INSERT/UPDATE/DELETE는 별도 정책 필요.
-- 이 파일을 Supabase SQL Editor에 붙여넣고 Run하면 끝.
-- 재실행해도 안전 (DROP IF EXISTS 사용).
-- ============================================================

-- 누구나 읽기 (사진 보기)
DROP POLICY IF EXISTS "podowa_tree_images_select" ON storage.objects;
CREATE POLICY "podowa_tree_images_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'tree-images');

-- 로그인한 사용자만 업로드
DROP POLICY IF EXISTS "podowa_tree_images_insert" ON storage.objects;
CREATE POLICY "podowa_tree_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'tree-images');

-- 로그인한 사용자만 덮어쓰기/이름변경
DROP POLICY IF EXISTS "podowa_tree_images_update" ON storage.objects;
CREATE POLICY "podowa_tree_images_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'tree-images')
  WITH CHECK (bucket_id = 'tree-images');

-- 로그인한 사용자만 삭제
DROP POLICY IF EXISTS "podowa_tree_images_delete" ON storage.objects;
CREATE POLICY "podowa_tree_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'tree-images');
