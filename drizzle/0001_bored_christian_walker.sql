CREATE TABLE `audit_competitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`metaPageId` varchar(64),
	`totalAds` int DEFAULT 0,
	`partnershipPct` float DEFAULT 0,
	`andromedaScore` float DEFAULT 0,
	`estimatedSpendMin` int DEFAULT 0,
	`estimatedSpendMax` int DEFAULT 0,
	`usedMockData` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` varchar(32) NOT NULL,
	`brandId` int NOT NULL,
	`brandName` varchar(255) NOT NULL,
	`period` varchar(16) NOT NULL,
	`platform` enum('meta','tiktok','combined') NOT NULL DEFAULT 'combined',
	`status` enum('pending','processing','complete','error') NOT NULL DEFAULT 'pending',
	`totalAds` int DEFAULT 0,
	`partnershipAds` int DEFAULT 0,
	`partnershipPct` float DEFAULT 0,
	`estimatedSpendMin` int DEFAULT 0,
	`estimatedSpendMax` int DEFAULT 0,
	`estimatedImpressionsMin` int DEFAULT 0,
	`estimatedImpressionsMax` int DEFAULT 0,
	`andromedaScore` float DEFAULT 0,
	`formatScore` float DEFAULT 0,
	`partnershipScore` float DEFAULT 0,
	`durationScore` float DEFAULT 0,
	`formatBreakdown` json,
	`metaAdsData` json,
	`tiktokAdsData` json,
	`creatorGapData` json,
	`usedMockData` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`),
	CONSTRAINT `audits_shareId_unique` UNIQUE(`shareId`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`metaPageId` varchar(64),
	`tiktokHandle` varchar(128),
	`industry` varchar(128),
	`logoUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_slug_unique` UNIQUE(`slug`)
);
