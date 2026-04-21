-- =====================================================
-- FEATURE : KYC PDF storage (génération PDF post-signature)
-- Date : 2026-04-21
-- Context : Batch A du projet KYC — on génère un PDF de synthèse à la
--           signature (PP ou PM selon type_personne), on le stocke dans
--           un bucket privé Supabase Storage, et on garde le chemin
--           + timestamp sur la fiche client pour retrouvabilité.
--
-- Approche :
--   · Deux colonnes nullables sur clients (kyc_pdf_storage_path, kyc_pdf_generated_at).
--   · Bucket Storage créé en SQL via storage.create_bucket (idempotent).
--   · Policies RLS sur storage.objects :
--       - INSERT : service_role uniquement (la route serveur upload avec
--         la clé service_role après RPC réussie). On n'ouvre PAS aux anon.
--       - SELECT : authenticated (les consultants connectés peuvent lister/
--         télécharger via signed URL).
--       - DELETE : managers only (via is_manager()).
--
-- Idempotent : tous les ADD COLUMN / CREATE POLICY sont gardés par IF NOT
-- EXISTS ou DROP/CREATE.
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_pdf_storage_path TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS kyc_pdf_generated_at TIMESTAMPTZ;

-- Index partiel — on ne requêtera que les clients qui ont un PDF généré
-- (minoritaires au début, quasi totalité à terme).
CREATE INDEX IF NOT EXISTS idx_clients_kyc_pdf_generated_at
  ON clients(kyc_pdf_generated_at DESC)
  WHERE kyc_pdf_storage_path IS NOT NULL;

-- =====================================================
-- Bucket Storage : kyc-documents (privé)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS policies sur storage.objects pour ce bucket
-- =====================================================

-- Clean-up : on drop d'abord pour pouvoir re-run sans erreur.
DROP POLICY IF EXISTS "kyc_docs_insert_service_role" ON storage.objects;
DROP POLICY IF EXISTS "kyc_docs_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "kyc_docs_delete_managers" ON storage.objects;
DROP POLICY IF EXISTS "kyc_docs_update_service_role" ON storage.objects;

-- INSERT : service_role only (cf. route /api/kyc/sign-public).
-- L'anon ne peut pas uploader ; on veut éviter qu'un token public
-- puisse écrire arbitrairement dans ce bucket.
CREATE POLICY "kyc_docs_insert_service_role"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'kyc-documents');

-- UPDATE : service_role only (overwrite lors d'une re-signature).
CREATE POLICY "kyc_docs_update_service_role"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'kyc-documents')
  WITH CHECK (bucket_id = 'kyc-documents');

-- SELECT : tout utilisateur authentifié (consultant) peut lire les PDFs.
-- La granularité par client se fera plutôt via le front (le consultant
-- ne voit que les PDFs des clients qu'il peut voir via la vue clients).
CREATE POLICY "kyc_docs_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents');

-- DELETE : managers only (garde-fou conformité — un consultant ne doit
-- pas pouvoir supprimer un PDF signé).
CREATE POLICY "kyc_docs_delete_managers"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND is_manager());

-- =====================================================
-- Smoke test
-- =====================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'clients'
--   AND column_name IN ('kyc_pdf_storage_path', 'kyc_pdf_generated_at');
-- Doit retourner 2 lignes.
--
-- SELECT id FROM storage.buckets WHERE id = 'kyc-documents';
-- Doit retourner 1 ligne.
