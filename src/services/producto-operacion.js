// Acquire the product row before any lot lock or insertion.
async function bloquearProducto(conexion, id) {
 const productos = await conexion.query('SELECT id, estado FROM productos WHERE id = ? FOR UPDATE', [id]);
 if (!productos.length) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
 return productos[0];
}
async function bloquearProductoActivo(conexion, id) {
 const producto = await bloquearProducto(conexion, id);
 if (producto.estado !== 'activo') throw Object.assign(new Error('El producto está inactivo. Reactivalo antes de registrar movimientos o crear lotes.'), { status: 409 });
 return producto;
}
module.exports = { bloquearProducto, bloquearProductoActivo };
