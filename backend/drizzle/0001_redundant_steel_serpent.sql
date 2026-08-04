ALTER TABLE "questions" ALTER COLUMN "starter_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "tests_template" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "type" varchar(20) DEFAULT 'code' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "options" json;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "correct_option" integer;