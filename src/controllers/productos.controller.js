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