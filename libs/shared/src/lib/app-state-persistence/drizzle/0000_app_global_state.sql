CREATE TABLE "app_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"root_path" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"last_opened_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_workspace_session" (
	"singleton_key" text PRIMARY KEY NOT NULL,
	"active_workspace_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_recent_canvases" (
	"workspace_id" text NOT NULL,
	"document_path" text NOT NULL,
	"last_opened_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_recent_canvases_workspace_id_document_path_pk" PRIMARY KEY("workspace_id","document_path")
);
--> statement-breakpoint
CREATE TABLE "app_preferences" (
	"key" text PRIMARY KEY NOT NULL,
	"value_json" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_app_workspaces_root_path" ON "app_workspaces" USING btree ("root_path");
--> statement-breakpoint
CREATE INDEX "idx_app_workspaces_status" ON "app_workspaces" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_app_workspaces_last_opened" ON "app_workspaces" USING btree ("last_opened_at");
--> statement-breakpoint
CREATE INDEX "idx_app_recent_canvases_workspace" ON "app_recent_canvases" USING btree ("workspace_id","last_opened_at");
