ALTER TABLE `Product`
  ADD COLUMN `slug` VARCHAR(191) NULL,
  ADD COLUMN `brand` VARCHAR(191) NULL,
  ADD COLUMN `faqs` JSON NULL,
  ADD COLUMN `usage_areas` JSON NULL,
  ADD COLUMN `variants` JSON NULL,
  ADD COLUMN `compare_at_price` DOUBLE NULL,
  ADD COLUMN `weight_kg` DOUBLE NULL,
  ADD COLUMN `dimensions` VARCHAR(191) NULL,
  ADD COLUMN `seo_title` VARCHAR(191) NULL,
  ADD COLUMN `seo_description` VARCHAR(191) NULL,
  ADD COLUMN `badge` VARCHAR(191) NULL,
  ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX `Product_slug_key` ON `Product`(`slug`);
