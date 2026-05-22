/*
  Warnings:

  - The primary key for the `productcategory` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `categoryId` on the `productcategory` table. All the data in the column will be lost.
  - You are about to drop the `category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productattribute` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productattributevalue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productimage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productvariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `productvariantattributevalue` table. If the table is not empty, all the data it contains will be lost.
  - The required column `id` was added to the `ProductCategory` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `name` to the `ProductCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProductCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `category` DROP FOREIGN KEY `Category_parentId_fkey`;

-- DropForeignKey
ALTER TABLE `productattribute` DROP FOREIGN KEY `ProductAttribute_productId_fkey`;

-- DropForeignKey
ALTER TABLE `productattributevalue` DROP FOREIGN KEY `ProductAttributeValue_attributeId_fkey`;

-- DropForeignKey
ALTER TABLE `productcategory` DROP FOREIGN KEY `ProductCategory_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `productimage` DROP FOREIGN KEY `ProductImage_productId_fkey`;

-- DropForeignKey
ALTER TABLE `productvariant` DROP FOREIGN KEY `ProductVariant_productId_fkey`;

-- DropForeignKey
ALTER TABLE `productvariantattributevalue` DROP FOREIGN KEY `ProductVariantAttributeValue_attributeValueId_fkey`;

-- DropForeignKey
ALTER TABLE `productvariantattributevalue` DROP FOREIGN KEY `ProductVariantAttributeValue_variantId_fkey`;

-- DropTable
DROP TABLE `productcategory`;

-- CreateTable
CREATE TABLE `productcategory` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `idx_product_category_product`(`productId`),
  INDEX `idx_product_category_slug`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `productcategory` ADD CONSTRAINT `ProductCategory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE `category`;

-- DropTable
DROP TABLE `productattribute`;

-- DropTable
DROP TABLE `productattributevalue`;

-- DropTable
DROP TABLE `productimage`;

-- DropTable
DROP TABLE `productvariant`;

-- DropTable
DROP TABLE `productvariantattributevalue`;

