ALTER TABLE "experiments" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "embedding_model" text;--> statement-breakpoint
UPDATE "items" SET "embedding_model" = 'mock-hash-768' WHERE "embedding" IS NOT NULL AND "embedding_model" IS NULL;
