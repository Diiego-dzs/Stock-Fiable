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

module.exports = {
    obtenerAlertasStock
};