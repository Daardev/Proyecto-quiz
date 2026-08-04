ALTER TABLE "quizzes" ADD COLUMN "attempts_left" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "kind" varchar(20) DEFAULT 'answer' NOT NULL;
