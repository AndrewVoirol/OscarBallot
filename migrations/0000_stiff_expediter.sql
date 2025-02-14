CREATE TABLE "ballots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nominee_id" integer NOT NULL,
	"has_watched" boolean DEFAULT false NOT NULL,
	"predicted_winner" boolean DEFAULT false NOT NULL,
	"want_to_win" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"poster" text NOT NULL,
	"trailer_url" text NOT NULL,
	"streaming_platforms" text[] NOT NULL,
	"awards" jsonb NOT NULL,
	"historical_awards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cast" text[] NOT NULL,
	"crew" text[] NOT NULL,
	"fun_facts" text[] NOT NULL,
	"ceremony_year" integer DEFAULT 2025 NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"tmdb_id" integer,
	"runtime" integer,
	"release_date" text,
	"vote_average" integer,
	"backdrop_path" text,
	"genres" text[],
	"overview" text,
	"biography" text,
	"production_companies" jsonb,
	"extended_credits" jsonb,
	"external_ids" jsonb,
	"career_highlights" jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"data_version" integer DEFAULT 1 NOT NULL,
	"data_complete" boolean DEFAULT false NOT NULL,
	"last_tmdb_sync" timestamp,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"validation_errors" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"nominee_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"watch_status" text DEFAULT 'pending' NOT NULL,
	"rating" integer,
	"notes" text,
	CONSTRAINT "watchlist_user_id_nominee_id_unique" UNIQUE("user_id","nominee_id")
);
--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_nominee_id_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nominees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_nominee_id_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nominees"("id") ON DELETE no action ON UPDATE no action;