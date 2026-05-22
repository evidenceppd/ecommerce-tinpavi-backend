ALTER TABLE `ProductCategory`
  ADD COLUMN `coverImage` VARCHAR(500) NULL;

UPDATE `ProductCategory`
SET `coverImage` = CASE
  WHEN `title` = 'Placas de sinalização' THEN '/assets/categorias/placadesinalização.png'
  WHEN `title` = 'Tachas e tachões' THEN '/assets/categorias/tachas.png'
  WHEN `title` = 'Dispositivos refletivos' THEN '/assets/categorias/dispositivos.png'
  WHEN `title` = 'Tintas para sinalização' THEN '/assets/categorias/tintas.png'
  WHEN `title` IN ('Equipamentos', 'Equipamentos de sinalização') THEN '/assets/categorias/equipamentos.png'
  WHEN `title` IN ('Kits', 'Kits de sinalização') THEN '/assets/categorias/kits.png'
  ELSE `coverImage`
END;