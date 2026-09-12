/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.7.2-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: stock_fiable_prueba
-- ------------------------------------------------------
-- Server version	12.2.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_categorias_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categorias`
--

LOCK TABLES `categorias` WRITE;
/*!40000 ALTER TABLE `categorias` DISABLE KEYS */;
INSERT INTO `categorias` VALUES
(1,'Categoría Prueba','Categoría para pruebas de integridad'),
(2,'Bebidas','Bebidas y gaseosas'),
(3,'Lácteos','Productos lácteos'),
(4,'Limpieza','Productos de limpieza'),
(5,'Snacks','Golosinas y snacks');
/*!40000 ALTER TABLE `categorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lotes`
--

DROP TABLE IF EXISTS `lotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lotes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `producto_id` int(10) unsigned NOT NULL,
  `codigo_lote` varchar(100) DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `stock_actual` decimal(10,2) NOT NULL DEFAULT 0.00,
  `estado` varchar(20) NOT NULL DEFAULT 'activo',
  PRIMARY KEY (`id`),
  KEY `idx_lotes_producto` (`producto_id`),
  CONSTRAINT `fk_lotes_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lotes`
--

LOCK TABLES `lotes` WRITE;
/*!40000 ALTER TABLE `lotes` DISABLE KEYS */;
INSERT INTO `lotes` VALUES
(2,2,'TEST-LOTE-001','2026-12-31',10.00,'activo'),
(3,4,'YOG-001','2026-08-18',0.00,'activo'),
(4,4,'YOG-002','2026-09-20',0.00,'activo'),
(5,4,'YOG-003','2026-10-30',2.00,'activo');
/*!40000 ALTER TABLE `lotes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movimientos_lotes`
--

DROP TABLE IF EXISTS `movimientos_lotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientos_lotes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `movimiento_id` int(10) unsigned NOT NULL,
  `lote_id` int(10) unsigned NOT NULL,
  `cantidad` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_movimientos_lotes_movimiento` (`movimiento_id`),
  KEY `idx_movimientos_lotes_lote` (`lote_id`),
  CONSTRAINT `fk_movimientos_lotes_lote` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`),
  CONSTRAINT `fk_movimientos_lotes_movimiento` FOREIGN KEY (`movimiento_id`) REFERENCES `movimientos_stock` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movimientos_lotes`
--

LOCK TABLES `movimientos_lotes` WRITE;
/*!40000 ALTER TABLE `movimientos_lotes` DISABLE KEYS */;
INSERT INTO `movimientos_lotes` VALUES
(2,5,2,5.00),
(4,7,3,5.00),
(5,7,4,3.00),
(6,8,4,3.00),
(7,9,4,5.00),
(8,10,4,15.00),
(9,10,5,5.00),
(10,11,4,1.00),
(11,12,4,1.00),
(12,12,5,5.00),
(13,13,5,1.00),
(14,14,5,1.00),
(15,15,5,1.00),
(16,16,5,1.00),
(17,17,5,1.00),
(18,18,5,1.00);
/*!40000 ALTER TABLE `movimientos_lotes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movimientos_stock`
--

DROP TABLE IF EXISTS `movimientos_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
  CONSTRAINT `fk_movimientos_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`),
  CONSTRAINT `fk_movimientos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movimientos_stock`
--

LOCK TABLES `movimientos_stock` WRITE;
/*!40000 ALTER TABLE `movimientos_stock` DISABLE KEYS */;
INSERT INTO `movimientos_stock` VALUES
(5,2,1,'ENTRADA',10.00,'Prueba integridad','Movimiento válido para pruebas FK','2026-08-17 19:28:05'),
(6,4,1,'ENTRADA',12.00,'Compra','Ingreso de mercadería de prueba','2026-08-17 19:42:22'),
(7,4,1,'SALIDA',8.00,'Venta','Salida de prueba aplicando FEFO','2026-08-17 19:42:45'),
(8,4,1,'ENTRADA',3.00,'Compra','Entrada de prueba','2026-08-17 21:46:33'),
(9,4,1,'SALIDA',5.00,'Venta','Salida de prueba','2026-08-17 21:53:17'),
(10,4,1,'SALIDA',20.00,'Venta','Prueba FEFO múltiples lotes','2026-08-17 21:55:05'),
(11,4,NULL,'ENTRADA',1.00,'Compra','Prueba de validaciones','2026-08-23 15:20:49'),
(12,4,NULL,'SALIDA',6.00,'Venta','Prueba FEFO con dos lotes','2026-08-23 15:25:07'),
(13,4,1,'ENTRADA',1.00,'Compra','Prueba usuario autenticado','2026-08-23 16:58:07'),
(14,4,1,'SALIDA',1.00,'Venta','Prueba usuario autenticado en salida','2026-08-23 16:58:52'),
(15,4,1,'ENTRADA',1.00,'Compra','Prueba autorizaci�n Due�o','2026-08-23 18:02:38'),
(16,4,1,'SALIDA',1.00,'Venta','Prueba autorizaci�n salida','2026-08-23 18:11:04'),
(17,4,1,'ENTRADA',1.00,'Compra','Prueba final autorizaci�n Due�o','2026-08-23 18:37:59'),
(18,4,1,'SALIDA',1.00,'Venta','Prueba final FEFO','2026-08-23 18:39:50');
/*!40000 ALTER TABLE `movimientos_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `productos`
--

LOCK TABLES `productos` WRITE;
/*!40000 ALTER TABLE `productos` DISABLE KEYS */;
INSERT INTO `productos` VALUES
(2,'TEST-001','Producto Prueba',NULL,NULL,1,0.00,0.00,0.00,'activo','2026-08-17 19:26:14','2026-08-17 19:26:14'),
(3,'BEB-001','Coca Cola 2.25L','Gaseosa cola de 2.25 litros','Coca Cola',2,1200.00,1800.00,10.00,'activo','2026-08-17 19:40:52','2026-08-17 19:40:52'),
(4,'LAC-001','Yogur Natural','Yogur natural','La Serenísima',3,800.00,1200.00,10.00,'activo','2026-08-17 19:40:52','2026-08-17 19:40:52'),
(5,'SNK-001','Papas Fritas 150g','Papas fritas clásicas','Lays',5,900.00,1400.00,8.00,'activo','2026-08-17 19:40:52','2026-08-17 19:40:52'),
(6,'LIM-001','Detergente 750ml','Detergente líquido','Magistral',4,1100.00,1700.00,5.00,'activo','2026-08-17 19:40:52','2026-08-17 19:40:52');
/*!40000 ALTER TABLE `productos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES
(1,'Usuario Prueba','prueba@stock.com','$2b$10$drs6dhy9wng07yvJMZ6MPOgK6LKOvCRgBmo9MtL0cufzStIelTnlW','Dueño',1,'2026-08-17 19:25:58');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'stock_fiable_prueba'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-08-30 20:03:01
