CREATE TABLE IF NOT EXISTS `account_aliases` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`payload` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `accounts_connection` ON `accounts` (`connection_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `balances` (
	`account_id` text NOT NULL,
	`day` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`account_id`, `day`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `balances_day` ON `balances` (`day`,`account_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`institution` text NOT NULL,
	`status` text NOT NULL,
	`capabilities` text NOT NULL,
	`credential` text,
	`revision` text NOT NULL,
	`last_success_at` text,
	`last_error` text,
	`cursor` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `holdings` (
	`account_id` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`account_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`connection_id` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `preferences` (
	`account_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sync_jobs` (
	`connection_id` text PRIMARY KEY NOT NULL,
	`generation` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`pending` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_account_date` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_date` ON `transactions` (`date`,`id`);