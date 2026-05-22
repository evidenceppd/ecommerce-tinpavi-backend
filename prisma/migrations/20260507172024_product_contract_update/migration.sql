/*
  Warnings:

  - You are about to drop the column `averageRating` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `metaDescription` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `metaTitle` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `reviewCount` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `product` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `productcategory` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `productcategory` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `productcategory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `applications` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `benefits` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carousel_image` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category_id` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `icons` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pix_pricing` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricing` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `specifications` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `where_use` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `product` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `title` to the `ProductCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `productcategory` DROP FOREIGN KEY `ProductCategory_productId_fkey`;

-- DropIndex
DROP INDEX `Product_slug_key` ON `product`;

-- DropIndex
DROP INDEX `idx_product_active_created` ON `product`;

-- DropIndex
DROP INDEX `idx_product_name` ON `product`;

-- DropIndex
DROP INDEX `idx_product_category_product` ON `productcategory`;

-- DropIndex
DROP INDEX `idx_product_category_slug` ON `productcategory`;

-- AlterTable
ALTER TABLE `product` DROP COLUMN `averageRating`,
    DROP COLUMN `isActive`,
    DROP COLUMN `metaDescription`,
    DROP COLUMN `metaTitle`,
    DROP COLUMN `name`,
    DROP COLUMN `price`,
    DROP COLUMN `reviewCount`,
    DROP COLUMN `slug`,
    DROP COLUMN `stock`,
    ADD COLUMN `applications` VARCHAR(191) NOT NULL,
    ADD COLUMN `benefits` VARCHAR(191) NOT NULL,
    ADD COLUMN `carousel_image` JSON NOT NULL,
    ADD COLUMN `category_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `code` VARCHAR(8) NOT NULL,
    ADD COLUMN `icons` VARCHAR(191) NOT NULL,
    ADD COLUMN `pix_pricing` DOUBLE NOT NULL,
    ADD COLUMN `pricing` DOUBLE NOT NULL,
    ADD COLUMN `quantity_stock` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `reviews` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sales` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `specifications` JSON NOT NULL,
    ADD COLUMN `title` VARCHAR(191) NOT NULL,
    ADD COLUMN `where_use` JSON NOT NULL,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `productcategory` DROP COLUMN `name`,
    DROP COLUMN `productId`,
    DROP COLUMN `slug`,
    ADD COLUMN `title` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Product_code_key` ON `Product`(`code`);

-- CreateIndex
CREATE INDEX `idx_product_category_id` ON `Product`(`category_id`);

-- CreateIndex
CREATE INDEX `idx_product_title` ON `Product`(`title`);

-- CreateIndex
CREATE INDEX `idx_product_created_at` ON `Product`(`createdAt`);

-- CreateIndex
CREATE INDEX `idx_product_category_title` ON `ProductCategory`(`title`);

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `ProductCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
