CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"date" text NOT NULL,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_impacts" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"trend_id" text,
	"headline" text NOT NULL,
	"automated" text[] DEFAULT '{}'::text[] NOT NULL,
	"augmented" text[] DEFAULT '{}'::text[] NOT NULL,
	"new_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"declining_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"new_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"tools" text[] DEFAULT '{}'::text[] NOT NULL,
	"student_advice" text NOT NULL,
	"exposure" integer DEFAULT 50 NOT NULL,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"source_item_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"url" text,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_entity_id" text NOT NULL,
	"target_entity_id" text NOT NULL,
	"relation" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"evidence_item_ids" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"why_interesting" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"technologies" text[] DEFAULT '{}'::text[] NOT NULL,
	"difficulty" text NOT NULL,
	"time_estimate" text NOT NULL,
	"architecture" text NOT NULL,
	"data_requirements" text NOT NULL,
	"expected_result" text NOT NULL,
	"github_potential" integer NOT NULL,
	"resume_value" integer NOT NULL,
	"startup_potential" integer NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_item_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"trend_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "experiments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "item_entities" (
	"item_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"salience" real DEFAULT 0.5 NOT NULL,
	CONSTRAINT "item_entities_item_id_entity_id_pk" PRIMARY KEY("item_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "item_metric_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metrics" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"source_id" text,
	"author" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snippet" text,
	"content_hash" text,
	"category" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"tldr" text,
	"why_it_matters" text,
	"analysis" jsonb,
	"score" integer DEFAULT 0 NOT NULL,
	"score_breakdown" jsonb,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"cluster_id" text,
	"embedding" vector(768),
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'raw' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_signals" (
	"skill_id" text NOT NULL,
	"date" text NOT NULL,
	"mentions" integer DEFAULT 0 NOT NULL,
	"repo_mentions" integer DEFAULT 0 NOT NULL,
	"job_mentions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "skill_signals_skill_id_date_pk" PRIMARY KEY("skill_id","date")
);
--> statement-breakpoint
CREATE TABLE "skill_status" (
	"skill_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"growth_30d" real,
	"last_30" integer DEFAULT 0 NOT NULL,
	"prev_30" integer DEFAULT 0 NOT NULL,
	"evidence_item_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"homepage" text,
	"credibility" real DEFAULT 0.6 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"etag" text,
	"last_fetched_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "startup_profiles" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"tagline" text NOT NULL,
	"problem" text NOT NULL,
	"product" text NOT NULL,
	"ai_tech" text NOT NULL,
	"funding_stage" text,
	"investors" text[] DEFAULT '{}'::text[] NOT NULL,
	"founders" text[] DEFAULT '{}'::text[] NOT NULL,
	"market" text NOT NULL,
	"competitors" text[] DEFAULT '{}'::text[] NOT NULL,
	"interesting" text NOT NULL,
	"weaknesses" text NOT NULL,
	"ideas" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_item_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"momentum" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_clusters" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"lead_item_id" text,
	"item_count" integer DEFAULT 1 NOT NULL,
	"source_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_entities" (
	"trend_id" text NOT NULL,
	"entity_id" text NOT NULL,
	CONSTRAINT "trend_entities_trend_id_entity_id_pk" PRIMARY KEY("trend_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "trend_items" (
	"trend_id" text NOT NULL,
	"item_id" text NOT NULL,
	"relevance" real DEFAULT 0.5 NOT NULL,
	CONSTRAINT "trend_items_trend_id_item_id_pk" PRIMARY KEY("trend_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "trend_snapshots" (
	"trend_id" text NOT NULL,
	"date" text NOT NULL,
	"mention_count" integer NOT NULL,
	"score" real NOT NULL,
	CONSTRAINT "trend_snapshots_trend_id_date_pk" PRIMARY KEY("trend_id","date")
);
--> statement-breakpoint
CREATE TABLE "trends" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"thesis" text NOT NULL,
	"summary" text NOT NULL,
	"status" text NOT NULL,
	"momentum" real DEFAULT 0 NOT NULL,
	"why_happening" text NOT NULL,
	"implications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"chain" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "trends_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tier" text NOT NULL,
	"task" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"cached" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"collection" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"experience_level" text DEFAULT 'mid' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_impacts" ADD CONSTRAINT "career_impacts_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_source_entity_id_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_entities" ADD CONSTRAINT "item_entities_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_entities" ADD CONSTRAINT "item_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_metric_snapshots" ADD CONSTRAINT "item_metric_snapshots_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_signals" ADD CONSTRAINT "skill_signals_skill_id_entities_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_status" ADD CONSTRAINT "skill_status_skill_id_entities_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "startup_profiles" ADD CONSTRAINT "startup_profiles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_entities" ADD CONSTRAINT "trend_entities_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_entities" ADD CONSTRAINT "trend_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_items" ADD CONSTRAINT "trend_items_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_items" ADD CONSTRAINT "trend_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_snapshots" ADD CONSTRAINT "trend_snapshots_trend_id_trends_id_fk" FOREIGN KEY ("trend_id") REFERENCES "public"."trends"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "briefings_kind_date_uq" ON "briefings" USING btree ("kind","date");--> statement-breakpoint
CREATE INDEX "career_impacts_role_idx" ON "career_impacts" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_type_slug_uq" ON "entities" USING btree ("type","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_relations_uq" ON "entity_relations" USING btree ("source_entity_id","target_entity_id","relation");--> statement-breakpoint
CREATE INDEX "item_entities_entity_idx" ON "item_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "item_snapshots_item_idx" ON "item_metric_snapshots" USING btree ("item_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "items_url_hash_uq" ON "items" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "items_published_idx" ON "items" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_score_idx" ON "items" USING btree ("score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_kind_published_idx" ON "items" USING btree ("kind","published_at");--> statement-breakpoint
CREATE INDEX "items_embedding_hnsw" ON "items" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_uq" ON "bookmarks" USING btree ("user_id","target_type","target_id","collection");--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "user_events_user_idx" ON "user_events" USING btree ("user_id","created_at");