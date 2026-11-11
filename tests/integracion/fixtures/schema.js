// Structural reference only. No historical dump or stored records are imported.
const opciones = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
const tablas = [
    `CREATE TABLE categorias (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL,
        descripcion VARCHAR(255) DEFAULT NULL,
        PRIMARY KEY (id), UNIQUE KEY uk_categorias_nombre (nombre)
    ) ${opciones}`,
    `CREATE TABLE usuarios (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL,
        contrasena VARCHAR(255) NOT NULL, rol VARCHAR(30) NOT NULL DEFAULT 'Dueño',
        activo TINYINT(1) NOT NULL DEFAULT 1,
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uk_usuarios_email (email)
    ) ${opciones}`,
    `CREATE TABLE productos (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        codigo VARCHAR(50) NOT NULL, nombre VARCHAR(150) NOT NULL,
        descripcion TEXT DEFAULT NULL, marca VARCHAR(100) DEFAULT NULL,
        categoria_id INT UNSIGNED NOT NULL,
        precio_compra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), UNIQUE KEY uk_productos_codigo (codigo),
        KEY idx_productos_categoria (categoria_id),
        CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id)
    ) ${opciones}`,
    `CREATE TABLE lotes (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, producto_id INT UNSIGNED NOT NULL,
        codigo_lote VARCHAR(100) DEFAULT NULL, fecha_vencimiento DATE DEFAULT NULL,
        stock_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado VARCHAR(20) NOT NULL DEFAULT 'activo',
        PRIMARY KEY (id), KEY idx_lotes_producto (producto_id),
        CONSTRAINT fk_lotes_producto FOREIGN KEY (producto_id) REFERENCES productos (id)
    ) ${opciones}`,
    `CREATE TABLE movimientos_stock (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, producto_id INT UNSIGNED NOT NULL,
        usuario_id INT UNSIGNED DEFAULT NULL, tipo VARCHAR(20) NOT NULL,
        cantidad DECIMAL(10,2) NOT NULL, motivo VARCHAR(100) NOT NULL,
        observacion VARCHAR(255) DEFAULT NULL,
        fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id), KEY idx_movimientos_producto (producto_id),
        KEY idx_movimientos_usuario (usuario_id),
        CONSTRAINT fk_movimientos_producto FOREIGN KEY (producto_id) REFERENCES productos (id),
        CONSTRAINT fk_movimientos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ) ${opciones}`,
    `CREATE TABLE movimientos_lotes (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT, movimiento_id INT UNSIGNED NOT NULL,
        lote_id INT UNSIGNED NOT NULL, cantidad DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (id), KEY idx_movimientos_lotes_movimiento (movimiento_id),
        KEY idx_movimientos_lotes_lote (lote_id),
        CONSTRAINT fk_movimientos_lotes_lote FOREIGN KEY (lote_id) REFERENCES lotes (id),
        CONSTRAINT fk_movimientos_lotes_movimiento FOREIGN KEY (movimiento_id) REFERENCES movimientos_stock (id)
    ) ${opciones}`
];

async function prepararSchema(conexion, marcador, comprobar = () => {}) {
    const ejecutar = async (sql, params) => { comprobar(); const resultado = await conexion.query(sql, params); comprobar(); return resultado; };
    const existentes = await ejecutar('SHOW TABLES');
    if (existentes.length) throw new Error('La base temporal debe estar vacía; no se limpiarán tablas existentes');
    for (const ddl of tablas) await ejecutar(ddl);
    // Fresh synthetic fixtures; opening stock is zero to preserve future accounting invariants.
    await ejecutar('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)', ['Pruebas sintéticas', marcador]);
    const hash = await require('bcryptjs').hash(require('node:crypto').randomBytes(24).toString('hex'), 4);
    comprobar();
    await ejecutar('INSERT INTO usuarios (nombre, email, contrasena, rol) VALUES (?, ?, ?, ?)', ['Cuenta sintética', 'integracion@example.invalid', hash, 'Dueño']);
    await ejecutar('INSERT INTO productos (codigo, nombre, categoria_id) VALUES (?, ?, ?)', ['SINTETICO-1', 'Producto sintético', 1]);
    await ejecutar('INSERT INTO lotes (producto_id, codigo_lote) VALUES (?, ?)', [1, 'LOTE-SINTETICO-1']);
}

module.exports = { tablas, prepararSchema };
