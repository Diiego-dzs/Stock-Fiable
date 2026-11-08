
const pool = require('../config/db');

function errorProducto(mensaje, status = 400) {
    return Object.assign(new Error(mensaje), { status });
}
function validarTexto(datos, campo, max, requerido = false) {
    const valor = datos[campo] ?? '';
    if (typeof valor !== 'string' || valor.trim().length > max || (requerido && !valor.trim())) throw errorProducto('El campo ' + campo + ' no es válido');
    return valor.trim() || null;
}
function validarCategoria(valor) {
    const categoria = Number(valor);
    if (!Number.isInteger(categoria) || categoria <= 0) throw errorProducto('La categoría no es válida');
    return categoria;
}
function validarDecimal(valor, campo) {
    if (!['number', 'string'].includes(typeof valor) || !/^\d+(\.\d{1,2})?$/.test(String(valor)) || !Number.isFinite(Number(valor)) || Number(valor) > 99999999.99) throw errorProducto('El campo ' + campo + ' debe ser un número no negativo con hasta dos decimales');
    return Number(valor);
}

async function obtenerProductos() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const productos = await conexion.query(`
            SELECT
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.marca,
                p.categoria_id,
                c.nombre AS categoria,
                p.precio_compra,
                p.precio_venta,
                p.stock_minimo,
                p.estado,
                COALESCE(SUM(l.stock_actual), 0) AS stock_actual
            FROM productos p
            INNER JOIN categorias c
                ON c.id = p.categoria_id
            LEFT JOIN lotes l
                ON l.producto_id = p.id AND l.estado = 'activo'
            GROUP BY
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.marca,
                p.categoria_id,
                c.nombre,
                p.precio_compra,
                p.precio_venta,
                p.stock_minimo,
                p.estado
            ORDER BY p.nombre
        `);

        return productos;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerStockPorProducto(productoId) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const producto = await conexion.query(`
            SELECT
                id,
                codigo,
                nombre,
                stock_minimo,
                estado
            FROM productos
            WHERE id = ?
        `, [productoId]);

        if (producto.length === 0) {
            return null;
        }

        const lotes = await conexion.query(`
            SELECT
                id,
                codigo_lote,
                fecha_vencimiento,
                stock_actual,
                estado
            FROM lotes
            WHERE producto_id = ?
            ORDER BY fecha_vencimiento ASC, id ASC
        `, [productoId]);

        const stockTotal = lotes.reduce(
            (total, lote) => total + (lote.estado === 'activo' ? Number(lote.stock_actual) : 0),
            0
        );

        return {
            producto: producto[0],
            stock_total: stockTotal,
            lotes
        };

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerLotesPorProducto(productoId) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const lotes = await conexion.query(`
            SELECT
                id,
                producto_id,
                codigo_lote,
                fecha_vencimiento,
                stock_actual,
                estado
            FROM lotes
            WHERE producto_id = ?
            ORDER BY fecha_vencimiento ASC, id ASC
        `, [productoId]);

        return lotes;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    obtenerProductos,
    obtenerStockPorProducto,
    obtenerLotesPorProducto
};

async function crearProducto(datos) {
    const texto = (campo, max, requerido = false) => validarTexto(datos, campo, max, requerido);
    const codigo = texto('codigo', 50, true);
    const nombre = texto('nombre', 150, true);
    const descripcion = texto('descripcion', 16000);
    const marca = texto('marca', 100);
    const categoria = validarCategoria(datos.categoria_id);
    const valores = ['precio_compra', 'precio_venta', 'stock_minimo'].map(campo => {
        const valor = datos[campo] ?? 0;
        return validarDecimal(valor, campo);
    });
    let conexion;
    try {
        conexion = await pool.getConnection();
        const categorias = await conexion.query('SELECT id FROM categorias WHERE id = ?', [categoria]);
        if (!categorias.length) throw new Error('Categoría no encontrada');
        const resultado = await conexion.query(`INSERT INTO productos (codigo, nombre, descripcion, marca, categoria_id, precio_compra, precio_venta, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [codigo, nombre, descripcion, marca, categoria, ...valores]);
        return { id: Number(resultado.insertId), codigo, nombre, stock_actual: 0 };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) throw new Error('Ya existe un producto con ese código');
        throw error;
    } finally {
        if (conexion) conexion.release();
    }
}
module.exports.crearProducto = crearProducto;

async function editarProducto(id, datos) {
    if (!Number.isInteger(id) || id <= 0) throw errorProducto('El ID del producto no es válido');
    const permitidos = ['nombre', 'descripcion', 'categoria_id', 'codigo', 'stock_minimo'];
    if (!datos || typeof datos !== 'object' || Array.isArray(datos) || !Object.keys(datos).length) throw errorProducto('Enviá al menos un campo editable');
    if (Object.keys(datos).some(campo => !permitidos.includes(campo))) throw errorProducto('La solicitud contiene campos desconocidos o no editables');
    const cambios = {};
    for (const campo of Object.keys(datos)) {
        if (campo === 'codigo' || campo === 'nombre') cambios[campo] = validarTexto(datos, campo, campo === 'codigo' ? 50 : 150, true);
        if (campo === 'descripcion') cambios[campo] = validarTexto(datos, campo, 16000);
        if (campo === 'stock_minimo') cambios[campo] = validarDecimal(datos[campo], campo);
        if (campo === 'categoria_id') {
            if (!['string', 'number'].includes(typeof datos[campo])) throw errorProducto('La categoría no es válida');
            cambios[campo] = validarCategoria(datos[campo]);
        }
    }
    let conexion;
    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        const actuales = await conexion.query('SELECT id FROM productos WHERE id = ? FOR UPDATE', [id]);
        if (!actuales.length) throw errorProducto('Producto no encontrado', 404);
        if (Object.hasOwn(cambios, 'categoria_id')) {
            const categorias = await conexion.query('SELECT id FROM categorias WHERE id = ?', [cambios.categoria_id]);
            if (!categorias.length) throw errorProducto('Categoría no encontrada');
        }
        if (Object.hasOwn(cambios, 'codigo')) {
            const duplicados = await conexion.query('SELECT id FROM productos WHERE codigo = ? AND id <> ? LIMIT 1', [cambios.codigo, id]);
            if (duplicados.length) throw errorProducto('Ya existe un producto con ese código', 409);
        }
        const campos = Object.keys(cambios);
        await conexion.query(`UPDATE productos SET ${campos.map(campo => campo + ' = ?').join(', ')}, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?`, [...Object.values(cambios), id]);
        const productos = await conexion.query(`
            SELECT p.*, c.nombre AS categoria,
                COALESCE((SELECT SUM(l.stock_actual) FROM lotes l WHERE l.producto_id = p.id AND l.estado = 'activo'), 0) AS stock_actual
            FROM productos p INNER JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?
        `, [id]);
        await conexion.commit();
        return productos[0];
    } catch (error) {
        if (conexion) await conexion.rollback();
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) throw errorProducto('Ya existe un producto con ese código', 409);
        if (error.errno === 1452) throw errorProducto('Categoría no encontrada');
        throw error;
    } finally {
        if (conexion) conexion.release();
    }
}
module.exports.editarProducto = editarProducto;

async function cambiarEstadoProducto(id, datos) {
 if (!Number.isSafeInteger(id) || id <= 0) throw errorProducto('El ID del producto no es válido');
 if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).length !== 1 || !Object.hasOwn(datos, 'estado') || !['activo', 'inactivo'].includes(datos.estado)) throw errorProducto('Enviá únicamente estado: activo o inactivo');
 let conexion;
 try {
  conexion = await pool.getConnection();
  await conexion.beginTransaction();
  const actual = await require('./producto-operacion').bloquearProducto(conexion, id);
  if (actual.estado !== datos.estado) await conexion.query('UPDATE productos SET estado = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = ?', [datos.estado, id]);
  const productos = await conexion.query(`SELECT p.*, c.nombre AS categoria,
   COALESCE((SELECT SUM(l.stock_actual) FROM lotes l WHERE l.producto_id = p.id AND l.estado = 'activo'), 0) AS stock_actual
   FROM productos p INNER JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?`, [id]);
  await conexion.commit();
  return productos[0];
 } catch (error) {
  if (conexion) await conexion.rollback();
  throw error;
 } finally { if (conexion) conexion.release(); }
}
module.exports.cambiarEstadoProducto = cambiarEstadoProducto;
