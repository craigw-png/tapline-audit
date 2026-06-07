ALTER TABLE `audits` ADD `brandDomain` varchar(255);--> statement-breakpoint
ALTER TABLE `audits` ADD `similarwebData` json;--> statement-breakpoint
ALTER TABLE `brands` ADD `domain` varchar(255);