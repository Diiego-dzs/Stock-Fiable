const productosService = require('../services/productos.service');

async function obtenerProductos(req, res) {
    try {
        const productos = await productosService.obtenerProductos();

        res.json(productos);

    } catch (error) {
        console.error('Error al obtener productos:', error.message);

        res.status(500).json({
            error: 'Error al obtener los productos'
        });
    }
}

async function crearProducto(req, res) {
    try {
        const {
            codigo,
            nombre,
            descripcion,
            marca,
            categoria_id,
            precio_compra,
            precio_venta,
            stock_minimo,
            estado
        } = req.body;

        if (!codigo || !codigo.trim() || !nombre || !nombre.trim()) {
            return res.status(400).json({
                error: 'El código y el nombre son obligatorios'
            });
        }

        const categoriaId = Number(categoria_id);

        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
            return res.status(400).json({
                error: 'La categoría no es válida'
            });
        }

        const datos = {
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() || null : null,
            marca: marca ? marca.trim() || null : null,
            categoria_id: categoriaId,
            precio_compra: Number(precio_compra) || 0,
            precio_venta: Number(precio_venta) || 0,
            stock_minimo: Number(stock_minimo) || 0,
            estado: estado === 'inactivo' ? 'inactivo' : 'activo'
        };

        const producto = await productosService.crearProducto(datos);

        res.status(201).json({
            mensaje: 'Producto creado correctamente',
            producto
        });

    } catch (error) {
        if (error.errno === 1062) {
            return res.status(409).json({
                error: 'Ya existe un producto con ese código'
            });
        }

        if (error.errno === 1452) {
            return res.status(400).json({
                error: 'La categoría seleccionada no existe'
            });
        }

        console.error('Error al crear producto:', error.message);

        res.status(500).json({
            error: 'Error al crear el producto'
        });
    }
}

async function actualizarProducto(req, res) {
    try {
        const productoId = Number(req.params.id);

        if (!Number.isInteger(productoId) || productoId <= 0) {
            return res.status(400).json({
                error: 'El ID del producto no es válido'
            });
        }

        const {
            codigo,
            nombre,
            descripcion,
            marca,
            categoria_id,
            precio_compra,
            precio_venta,
            stock_minimo,
            estado
        } = req.body;

        if (!codigo || !codigo.trim() || !nombre || !nombre.trim()) {
            return res.status(400).json({
                error: 'El código y el nombre son obligatorios'
            });
        }

        if (codigo.trim().length > 50 || nombre.trim().length > 150) {
            return res.status(400).json({
                error: 'El código (máx. 50) o el nombre (máx. 150) son demasiado largos'
            });
        }

        if (marca && marca.trim().length > 100) {
            return res.status(400).json({
                error: 'La marca no puede superar los 100 caracteres'
            });
        }

        const categoriaId = Number(categoria_id);

        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
            return res.status(400).json({
                error: 'La categoría no es válida'
            });
        }

        const precioCompra = Number(precio_compra) || 0;
        const precioVenta = Number(precio_venta) || 0;
        const stockMinimo = Number(stock_minimo) || 0;

        if (precioCompra < 0 || precioVenta < 0 || stockMinimo < 0) {
            return res.status(400).json({
                error: 'Los precios y el stock mínimo no pueden ser negativos'
            });
        }

        const datos = {
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() || null : null,
            marca: marca ? marca.trim() || null : null,
            categoria_id: categoriaId,
            precio_compra: precioCompra,
            precio_venta: precioVenta,
            stock_minimo: stockMinimo,
            estado: estado === 'inactivo' ? 'inactivo' : 'activo'
        };

        const producto =
            await productosService.actualizarProducto(productoId, datos);

        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }

        res.json({
            mensaje: 'Producto actualizado correctamente',
            producto
        });

    } catch (error) {
        if (error.errno === 1062) {
            return res.status(409).json({
                error: 'Ya existe otro producto con ese código'
            });
        }

        if (error.errno === 1452) {
            return res.status(400).json({
                error: 'La categoría seleccionada no existe'
            });
        }

        console.error('Error al actualizar producto:', error.message);

        res.status(500).json({
            error: 'Error al actualizar el producto'
        });
    }
}

async function obtenerStockPorProducto(req, res) {
    try {
        const productoId = Number(req.params.id);

        if (!Number.isInteger(productoId) || productoId <= 0) {
            return res.status(400).json({
                error: 'El ID del producto no es válido'
            });
        }

        const resultado =
            await productosService.obtenerStockPorProducto(productoId);

        if (!resultado) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }

        res.json(resultado);

    } catch (error) {
        console.error(
            'Error al obtener stock del producto:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener el stock del producto'
        });
    }
}

async function obtenerLotesPorProducto(req, res) {
    try {
        const productoId = Number(req.params.id);

        if (!Number.isInteger(productoId) || productoId <= 0) {
            return res.status(400).json({
                error: 'El ID del producto no es válido'
            });
        }

        const lotes =
            await productosService.obtenerLotesPorProducto(productoId);

        res.json(lotes);

    } catch (error) {
        console.error(
            'Error al obtener lotes del producto:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener los lotes del producto'
        });
    }
}

module.exports = {
    obtenerProductos,
    crearProducto,
    actualizarProducto,
    obtenerStockPorProducto,
    obtenerLotesPorProducto
};