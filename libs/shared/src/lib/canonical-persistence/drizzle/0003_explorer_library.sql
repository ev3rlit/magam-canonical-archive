CREATE TABLE "library_items" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "item_type" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "tags" jsonb NOT NULL,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "visibility" text NOT NULL,
  "payload" jsonb NOT NULL,
  "binary_blob" text,
  "search_text" text NOT NULL,
  "created_by" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "library_items_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE INDEX "idx_library_items_workspace_updated"
  ON "library_items" USING btree ("workspace_id","updated_at");
--> statement-breakpoint
CREATE INDEX "idx_library_items_workspace_type"
  ON "library_items" USING btree ("workspace_id","item_type");
--> statement-breakpoint
CREATE INDEX "idx_library_items_workspace_visibility"
  ON "library_items" USING btree ("workspace_id","visibility","updated_at");
--> statement-breakpoint
CREATE INDEX "idx_library_items_workspace_favorite"
  ON "library_items" USING btree ("workspace_id","is_favorite","updated_at");
--> statement-breakpoint
CREATE TABLE "library_collections" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "library_collections_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE INDEX "idx_library_collections_workspace_sort"
  ON "library_collections" USING btree ("workspace_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_library_collections_workspace_name"
  ON "library_collections" USING btree ("workspace_id","name");
--> statement-breakpoint
CREATE TABLE "library_item_collections" (
  "workspace_id" text NOT NULL,
  "item_id" text NOT NULL,
  "collection_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "library_item_collections_workspace_item_collection_pk"
    PRIMARY KEY("workspace_id","item_id","collection_id")
);
--> statement-breakpoint
CREATE INDEX "idx_library_item_collections_workspace_collection"
  ON "library_item_collections" USING btree ("workspace_id","collection_id","item_id");
--> statement-breakpoint
CREATE TABLE "library_item_versions" (
  "id" text NOT NULL,
  "workspace_id" text NOT NULL,
  "item_id" text NOT NULL,
  "version_no" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "binary_blob" text,
  "change_summary" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" jsonb NOT NULL,
  CONSTRAINT "library_item_versions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_library_item_versions_workspace_item_version"
  ON "library_item_versions" USING btree ("workspace_id","item_id","version_no");
--> statement-breakpoint
CREATE INDEX "idx_library_item_versions_workspace_item_created"
  ON "library_item_versions" USING btree ("workspace_id","item_id","created_at");
