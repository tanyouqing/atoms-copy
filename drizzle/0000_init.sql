CREATE TABLE `llm_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text,
	`turn_id` text,
	`step` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer,
	`duration_ms` integer NOT NULL,
	`ok` integer NOT NULL,
	`error_code` text,
	`attempt` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`meta_json` text,
	`version_id` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_project_idx` ON `messages` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`title` text NOT NULL,
	`title_locked` integer DEFAULT false NOT NULL,
	`initial_prompt` text NOT NULL,
	`current_version_id` text,
	`template_id` text,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_visitor_idx` ON `projects` (`visitor_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`ip` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_visitor_idx` ON `usage_events` (`visitor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `usage_ip_idx` ON `usage_events` (`ip`,`created_at`);--> statement-breakpoint
CREATE INDEX `usage_created_idx` ON `usage_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`seq` integer NOT NULL,
	`turn_id` text NOT NULL,
	`label` text NOT NULL,
	`source` text NOT NULL,
	`template_id` text,
	`config_json` text,
	`html` text NOT NULL,
	`plan_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`errors_json` text,
	`parent_version_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versions_project_seq_uq` ON `versions` (`project_id`,`seq`);--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
