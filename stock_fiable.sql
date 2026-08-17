-- ============================================================
-- STOCK FIABLE
-- Base de datos definitiva
-- MariaDB / InnoDB / UTF8MB4
-- ============================================================

CREATE DATABASE IF NOT EXISTS `stock_fiable`
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `stock_fiable`;

-- ============================================================
-- LIMPIEZA
-- El orden respeta las dependencias de las claves foráneas
-- ============================================================

DROP TABLE IF EXISTS `movimientos_lotes`;
DROP TABLE IF EXISTS `movimientos_stock`;
DROP TABLE IF EXISTS `lotes`;
DROP TABLE IF EXISTS `productos`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `categorias`;

-- ============================================================
-- 1. CATEGORIAS
-- ============================================================

CREATE TABLE `categorias` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categorias_nombre` (`nombre`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. USUARIOS
-- ============================================================

CREATE TABLE `usuarios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `rol` varchar(30) NOT NULL DEFAULT 'Dueño',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usuarios_email` (`email`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. PRODUCTOS
-- ============================================================

CREATE TABLE `productos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `marca` varchar(100) DEFAULT NULL,
  `categoria_id` int(10) unsigned NOT NULL,
  `precio_compra` decimal(10,2) NOT NULL DEFAULT 0.00,
  `precio_venta` decimal(10,2) NOT NULL DEFAULT 0.00,
  `stock_minimo` decimal(10,2) NOT NULL DEFAULT 0.00,
  `estado` varchar(20) NOT NULL DEFAULT 'activo',
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_productos_codigo` (`codigo`),
  KEY `idx_productos_categoria` (`categoria_id`),
  CONSTRAINT `fk_productos_categoria`
    FOREIGN KEY (`categoria_id`)
    REFERENCES `categorias` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. LOTES
-- ============================================================

CREATE TABLE `lotes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `producto_id` int(10) unsigned NOT NULL,
  `codigo_lote` varchar(100) DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `stock_actual` decimal(10,2) NOT NULL DEFAULT 0.00,
  `estado` varchar(20) NOT NULL DEFAULT 'activo',
  PRIMARY KEY (`id`),
  KEY `idx_lotes_producto` (`producto_id`),
  CONSTRAINT `fk_lotes_producto`
    FOREIGN KEY (`producto_id`)
    REFERENCES `productos` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. MOVIMIENTOS DE STOCK
-- ============================================================

CREATE TABLE `movimientos_stock` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `producto_id` int(10) unsigned NOT NULL,
  `usuario_id` int(10) unsigned DEFAULT NULL,
  `tipo` varchar(20) NOT NULL,
  `cantidad` decimal(10,2) NOT NULL,
  `motivo` varchar(100) NOT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_movimientos_producto` (`producto_id`),
  KEY `idx_movimientos_usuario` (`usuario_id`),
  CONSTRAINT `fk_movimientos_producto`
    FOREIGN KEY (`producto_id`)
    REFERENCES `productos` (`id`),
  CONSTRAINT `fk_movimientos_usuario`
    FOREIGN KEY (`usuario_id`)
    REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. MOVIMIENTOS POR LOTE
-- ============================================================

CREATE TABLE `movimientos_lotes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `movimiento_id` int(10) unsigned NOT NULL,
  `lote_id` int(10) unsigned NOT NULL,
  `cantidad` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_movimientos_lotes_movimiento` (`movimiento_id`),
  KEY `idx_movimientos_lotes_lote` (`lote_id`),
  CONSTRAINT `fk_movimientos_lotes_lote`
    FOREIGN KEY (`lote_id`)
    REFERENCES `lotes` (`id`),
  CONSTRAINT `fk_movimientos_lotes_movimiento`
    FOREIGN KEY (`movimiento_id`)
    REFERENCES `movimientos_stock` (`id`)
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================