-- CreateIndex
CREATE INDEX `idx_customer_created_at` ON `Customer`(`createdAt`);

-- CreateIndex
CREATE INDEX `idx_order_customer_status_created` ON `Order`(`customerId`, `status`, `createdAt`);

-- CreateIndex
CREATE INDEX `idx_order_customer_created` ON `Order`(`customerId`, `createdAt`);

-- CreateIndex
CREATE INDEX `idx_order_status_created` ON `Order`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `idx_product_active_created` ON `Product`(`isActive`, `createdAt`);

-- CreateIndex
CREATE INDEX `idx_product_name` ON `Product`(`name`);

-- CreateIndex
CREATE INDEX `idx_product_category_category_product` ON `ProductCategory`(`categoryId`, `productId`);

-- CreateIndex
CREATE INDEX `idx_review_product_status_created` ON `Review`(`productId`, `status`, `createdAt`);

-- CreateIndex
CREATE INDEX `idx_review_customer_created` ON `Review`(`customerId`, `createdAt`);
