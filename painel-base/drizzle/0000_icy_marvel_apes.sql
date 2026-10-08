CREATE TABLE `birds` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`identification` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`species` text NOT NULL,
	`sex` text NOT NULL,
	`mutation` text NOT NULL,
	`certainty` text DEFAULT 'observada' NOT NULL,
	`carriers` text DEFAULT '' NOT NULL,
	`origin` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`birth_date` text DEFAULT '' NOT NULL,
	`father_id` text,
	`mother_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`father_id`) REFERENCES `birds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mother_id`) REFERENCES `birds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `birds_scope_identification` ON `birds` (`scope`,`identification`);--> statement-breakpoint
CREATE INDEX `birds_scope` ON `birds` (`scope`);--> statement-breakpoint
CREATE TABLE `clutches` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`pair_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`pair_id`) REFERENCES `pairs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clutches_scope` ON `clutches` (`scope`);--> statement-breakpoint
CREATE UNIQUE INDEX `clutches_open_pair` ON `clutches` (`pair_id`) WHERE "clutches"."end_date" IS NULL;--> statement-breakpoint
CREATE TABLE `demo_init` (
	`id` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eggs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`clutch_id` text NOT NULL,
	`number` integer NOT NULL,
	`laid_date` text NOT NULL,
	`status` text NOT NULL,
	`hatch_date` text,
	`chick_id` text,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`clutch_id`) REFERENCES `clutches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chick_id`) REFERENCES `birds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `eggs_scope` ON `eggs` (`scope`);--> statement-breakpoint
CREATE UNIQUE INDEX `eggs_clutch_number` ON `eggs` (`clutch_id`,`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `eggs_chick` ON `eggs` (`chick_id`);--> statement-breakpoint
CREATE TABLE `mutation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`bird_id` text NOT NULL,
	`mutation` text NOT NULL,
	`certainty` text NOT NULL,
	`carriers` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`bird_id`) REFERENCES `birds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mutation_history_scope` ON `mutation_history` (`scope`);--> statement-breakpoint
CREATE TABLE `pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`male_id` text NOT NULL,
	`female_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`male_id`) REFERENCES `birds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`female_id`) REFERENCES `birds`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pairs_active_male` ON `pairs` (`male_id`) WHERE "pairs"."end_date" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `pairs_active_female` ON `pairs` (`female_id`) WHERE "pairs"."end_date" IS NULL;--> statement-breakpoint
CREATE INDEX `pairs_scope` ON `pairs` (`scope`);