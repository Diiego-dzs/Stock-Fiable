require('dotenv').config();

const movimientosRoutes = require('./routes/movimientos.routes');

const express = require('express');

const categoriasRoutes = require('./routes/categorias.routes');
const productosRoutes = require('./routes/productos.routes');
const stockRoutes = require('./routes/stock.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        mensaje: 'Stock Fiable API funcionando'
    });
});

app.use('/api/categorias', categoriasRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
    console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
});