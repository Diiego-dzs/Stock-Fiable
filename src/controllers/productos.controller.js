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
    obtenerStockPorProducto,
    obtenerLotesPorProducto
};
async function crearProducto(req, res) {
    try {
        const producto = await productosService.crearProducto(req.body || {});
        res.status(201).json({ mensaje: 'Producto creado correctamente', producto });
    } catch (error) {
        res.status(error.message.includes('Ya existe') ? 409 : 400).json({ error: error.message });
    }
}
async function crearLote(req, res) {
    try {
        const lote = await require('../services/lotes.service').crearLote(Number(req.params.id), req.body);
        res.status(201).json({ mensaje: 'Lote creado correctamente', lote });
    } catch (error) {
        res.status(error.message === 'Producto no encontrado' ? 404 : 400).json({ error: error.message });
    }
}
module.exports.crearProducto = crearProducto;
module.exports.crearLote = crearLote;

async function editarProducto(req, res) {
    try {
        const producto = await productosService.editarProducto(Number(req.params.id), req.body);
        res.json({ mensaje: 'Producto actualizado correctamente', producto });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo actualizar el producto' });
    }
}
module.exports.editarProducto = editarProducto;
