-- CreateTable
CREATE TABLE `PageView` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `page` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `device` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    `referrer` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageView_createdAt_idx`(`createdAt`),
    INDEX `PageView_page_idx`(`page`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Blog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria` VARCHAR(191) NOT NULL DEFAULT '',
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NOT NULL,
    `materia` TEXT NOT NULL,
    `imagem_capa` VARCHAR(191) NULL,
    `imagem_banner` VARCHAR(191) NULL,
    `imagem_banner_mobile` VARCHAR(191) NULL,
    `tempo_leitura` VARCHAR(191) NULL,
    `publicado` BOOLEAN NOT NULL DEFAULT true,
    `data_publicacao` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Blog_publicado_idx`(`publicado`),
    INDEX `Blog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
