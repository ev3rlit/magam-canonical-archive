CREATE TABLE "objects" (
	"id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"semantic_role" text NOT NULL,
	"primary_content_kind" text,
	"public_alias" text,
	"content_blocks" jsonb,
	"source_meta" jsonb NOT NULL,
	"capabilities" jsonb NOT NULL,
	"capability_sources" jsonb,
	"canonical_text" text NOT NULL,
	"extensions" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objects_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "canvas_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"node_id" text NOT NULL,
	"binding_kind" text NOT NULL,
	"source_ref" jsonb NOT NULL,
	"mapping" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"surface_id" text NOT NULL,
	"node_kind" text NOT NULL,
	"node_type" text,
	"parent_node_id" text,
	"canonical_object_id" text,
	"plugin_instance_id" text,
	"props" jsonb,
	"layout" jsonb NOT NULL,
	"style" jsonb,
	"persisted_state" jsonb,
	"z_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"revision_no" integer NOT NULL,
	"author_kind" text NOT NULL,
	"author_id" text NOT NULL,
	"mutation_batch" jsonb NOT NULL,
	"snapshot_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "object_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"from_object_id" text NOT NULL,
	"to_object_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"sort_key" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_objects_workspace_role" ON "objects" USING btree ("workspace_id","semantic_role");--> statement-breakpoint
CREATE INDEX "idx_objects_workspace_content_kind" ON "objects" USING btree ("workspace_id","primary_content_kind");--> statement-breakpoint
CREATE INDEX "idx_canvas_bindings_document_node" ON "canvas_bindings" USING btree ("document_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_nodes_document_surface_z" ON "canvas_nodes" USING btree ("document_id","surface_id","z_index");--> statement-breakpoint
CREATE INDEX "idx_document_revisions_document_revision" ON "document_revisions" USING btree ("document_id","revision_no");--> statement-breakpoint
CREATE INDEX "idx_object_relations_workspace_from_relation" ON "object_relations" USING btree ("workspace_id","from_object_id","relation_type");