CREATE TABLE `account_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`status` enum('requested','pending','active','expired','revoked') NOT NULL DEFAULT 'requested',
	`metaAccessGranted` boolean DEFAULT false,
	`tiktokAccessGranted` boolean DEFAULT false,
	`metaAdAccountId` varchar(64),
	`tiktokAdvertiserId` varchar(64),
	`expiresAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `account_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audits` ADD `conceptScore` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `audits` ADD `estimatedConcepts` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `audits` ADD `entityIdRisk` json;--> statement-breakpoint
ALTER TABLE `audits` ADD `hasAccountData` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `audits` ADD `ftiScore` float;--> statement-breakpoint
ALTER TABLE `audits` ADD `ctrPct` float;--> statement-breakpoint
ALTER TABLE `audits` ADD `thumbStopRate` float;--> statement-breakpoint
ALTER TABLE `audits` ADD `holdRate` float;--> statement-breakpoint
ALTER TABLE `audits` ADD `cpaDeltaPct` float;--> statement-breakpoint
ALTER TABLE `audits` ADD `creativeSimilarityScore` float;--> statement-breakpoint
ALTER TABLE `audits` ADD `accountLevelData` json;