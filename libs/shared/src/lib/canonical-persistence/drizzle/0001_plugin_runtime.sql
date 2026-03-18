CREATE TABLE "plugin_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"package_name" text NOT NULL,
	"display_name" text NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"plugin_package_id" text NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"bundle_ref" text NOT NULL,
	"integrity_hash" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"plugin_version_id" text NOT NULL,
	"export_name" text NOT NULL,
	"component_kind" text NOT NULL,
	"prop_schema" jsonb NOT NULL,
	"binding_schema" jsonb NOT NULL,
	"capabilities" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"plugin_version_id" text NOT NULL,
	"permission_key" text NOT NULL,
	"permission_value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plugin_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"surface_id" text NOT NULL,
	"plugin_export_id" text NOT NULL,
	"plugin_version_id" text NOT NULL,
	"display_name" text NOT NULL,
	"props" jsonb,
	"binding_config" jsonb,
	"persisted_state" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_plugin_packages_workspace_name" ON "plugin_packages" USING btree ("workspace_id","package_name");
--> statement-breakpoint
CREATE INDEX "idx_plugin_packages_owner" ON "plugin_packages" USING btree ("owner_kind","owner_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_plugin_versions_package_version" ON "plugin_versions" USING btree ("plugin_package_id","version");
--> statement-breakpoint
CREATE INDEX "idx_plugin_versions_package_status" ON "plugin_versions" USING btree ("plugin_package_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_plugin_exports_version_export" ON "plugin_exports" USING btree ("plugin_version_id","export_name");
--> statement-breakpoint
CREATE INDEX "idx_plugin_exports_version_component" ON "plugin_exports" USING btree ("plugin_version_id","component_kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_plugin_permissions_version_key" ON "plugin_permissions" USING btree ("plugin_version_id","permission_key");
--> statement-breakpoint
CREATE INDEX "idx_plugin_instances_document_surface" ON "plugin_instances" USING btree ("document_id","surface_id");
--> statement-breakpoint
CREATE INDEX "idx_plugin_instances_version" ON "plugin_instances" USING btree ("plugin_version_id");
--> statement-breakpoint
CREATE INDEX "idx_plugin_instances_export" ON "plugin_instances" USING btree ("plugin_export_id");
