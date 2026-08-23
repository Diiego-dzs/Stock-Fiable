const stockService = require('../services/stock.service');

async function obtenerAlertasStock(req, res) {
    try {
        const alertas = await stockService.obtenerAlertasStock();

        res.json(alertas);

    } catch (error) {
        console.error(
            'Error al obtener alertas de stock:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener las alertas de stock'
        });
    }
}

async function obtenerStockGeneral(req, res) {
    try {
        const stock = await stockService.obtenerStockGeneral();

        res.json(stock);

    } catch (error) {
        console.error(
            'Error al obtener el stock general:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener el stock general'
        });
    }
}

async function obtenerResumenStock(req, res) {
    try {
        const resumen = await stockService.obtenerResumenStock();

        res.json(resumen);

    } catch (error) {
        console.error(
            'Error al obtener el resumen de stock:',
            error.message
        );

        res.status(500).json({
            error: 'Error al obtener el resumen de stock'
        });
    }
}

module.exports = {
    obtenerAlertasStock,
    obtenerStockGeneral,
    obtenerResumenStock
};