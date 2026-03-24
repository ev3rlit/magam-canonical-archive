DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'app_recent_documents'
  ) THEN
    ALTER TABLE "app_recent_documents" RENAME TO "app_recent_canvases";
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_recent_canvases'
      AND column_name = 'document_path'
  ) THEN
    ALTER TABLE "app_recent_canvases" RENAME COLUMN "document_path" TO "canvas_path";
  END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  current_pk_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'app_recent_canvases'
  ) THEN
    RETURN;
  END IF;

  SELECT con.conname
  INTO current_pk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'app_recent_canvases'
    AND con.contype = 'p'
  LIMIT 1;

  IF current_pk_name = 'app_recent_documents_workspace_id_document_path_pk' THEN
    EXECUTE 'ALTER TABLE "app_recent_canvases" RENAME CONSTRAINT "app_recent_documents_workspace_id_document_path_pk" TO "app_recent_canvases_workspace_id_canvas_path_pk"';
  ELSIF current_pk_name = 'app_recent_canvases_workspace_id_document_path_pk' THEN
    EXECUTE 'ALTER TABLE "app_recent_canvases" RENAME CONSTRAINT "app_recent_canvases_workspace_id_document_path_pk" TO "app_recent_canvases_workspace_id_canvas_path_pk"';
  ELSIF current_pk_name IS NULL THEN
    EXECUTE 'ALTER TABLE "app_recent_canvases" ADD CONSTRAINT "app_recent_canvases_workspace_id_canvas_path_pk" PRIMARY KEY ("workspace_id", "canvas_path")';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "app_preferences"
    WHERE "key" = 'workspace.lastActiveDocumentSession'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM "app_preferences"
      WHERE "key" = 'workspace.lastActiveCanvasSession'
    ) THEN
      DELETE FROM "app_preferences"
      WHERE "key" = 'workspace.lastActiveDocumentSession';
    ELSE
      UPDATE "app_preferences"
      SET "key" = 'workspace.lastActiveCanvasSession'
      WHERE "key" = 'workspace.lastActiveDocumentSession';
    END IF;
  END IF;
END $$;
