ALTER TABLE "document_revisions"
  ADD COLUMN "session_id" text;
--> statement-breakpoint
ALTER TABLE "document_revisions"
  ADD COLUMN "runtime_history" jsonb;
--> statement-breakpoint
CREATE INDEX "idx_document_revisions_document_author_session"
  ON "document_revisions" USING btree ("document_id","author_id","session_id","revision_no");
--> statement-breakpoint
CREATE TABLE "canvas_history_cursors" (
  "document_id" text NOT NULL,
  "actor_id" text NOT NULL,
  "session_id" text NOT NULL,
  "undo_revision_no" integer,
  "redo_revision_no" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "canvas_history_cursors_document_actor_session_pk"
    PRIMARY KEY("document_id","actor_id","session_id")
);
--> statement-breakpoint
CREATE INDEX "idx_canvas_history_cursors_document"
  ON "canvas_history_cursors" USING btree ("document_id","updated_at");
