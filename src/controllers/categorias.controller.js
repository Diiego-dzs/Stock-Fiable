const categoriasService = require('../services/categorias.service');

async function obtenerCategorias(req, res) {
    try {
        const categorias = await categoriasService.obtenerCategorias();

        res.json(categorias);

    } catch (error) {
        console.error('Error al obtener categorías:', error.message);

        res.status(500).json({
            error: 'Error al obtener las categorías'
        });
    }
}

module.exports = {
    obtenerCategorias
};