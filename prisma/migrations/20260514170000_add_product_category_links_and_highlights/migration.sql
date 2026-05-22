ALTER TABLE `Product`
  ADD COLUMN `highlights` JSON NULL;

CREATE TABLE `ProductCategoryLink` (
  `productId` VARCHAR(191) NOT NULL,
  `categoryId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`productId`, `categoryId`),
  INDEX `idx_product_category_link_product`(`productId`),
  INDEX `idx_product_category_link_category`(`categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `ProductCategoryLink` (`productId`, `categoryId`, `createdAt`)
SELECT `id`, `category_id`, NOW(3)
FROM `Product`;

ALTER TABLE `ProductCategoryLink`
  ADD CONSTRAINT `ProductCategoryLink_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductCategoryLink_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
