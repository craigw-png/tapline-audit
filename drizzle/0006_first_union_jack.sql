ALTER TABLE `audits` ADD `partnershipConfirmed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `audits` ADD `candidateAds` json;--> statement-breakpoint
ALTER TABLE `audits` ADD `adLibraryUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `audits` ADD `brandedContentUrl` varchar(512);