CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`pin_hash` text,
	`pin_salt` text,
	`pin_iterations` integer,
	`pin_revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pin_limits` (
	`identifier_hash` text PRIMARY KEY NOT NULL,
	`failure_count` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`email` text,
	`pin_revision` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
