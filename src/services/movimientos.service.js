const pool = require('../config/db');

async function registrarEntrada({
    producto_id,
    usuario_id,
    cantidad,
    motivo,
    observacion,
    lote_id
}) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        // 1. Verificar que el producto exista
        const productos = await conexion.query(`
            SELECT id
            FROM productos
            WHERE id = ?
        `, [producto_id]);

        if (productos.length === 0) {
            throw new Error('Producto no encontrado');
        }

        // 2. Verificar que el lote exista y pertenezca al producto
        const lotes = await conexion.query(`
            SELECT
                id,
                producto_id,
                stock_actual
            FROM lotes
            WHERE id = ?
              AND producto_id = ?
            FOR UPDATE
        `, [lote_id, producto_id]);

        if (lotes.length === 0) {
            throw new Error(
                'El lote no existe o no pertenece al producto'
            );
        }

        // 3. Registrar movimiento principal
        const resultadoMovimiento = await conexion.query(`
            INSERT INTO movimientos_stock (
                producto_id,
                usuario_id,
                tipo,
                cantidad,
                motivo,
                observacion
            )
            VALUES (?, ?, 'ENTRADA', ?, ?, ?)
        `, [
            producto_id,
            usuario_id || null,
            cantidad,
            motivo,
            observacion || null
        ]);

        const movimientoId = Number(resultadoMovimiento.insertId);

        // 4. Registrar movimiento del lote
        await conexion.query(`
            INSERT INTO movimientos_lotes (
                movimiento_id,
                lote_id,
                cantidad
            )
            VALUES (?, ?, ?)
        `, [
            movimientoId,
            lote_id,
            cantidad
        ]);

        // 5. Actualizar stock del lote
        await conexion.query(`
            UPDATE lotes
            SET stock_actual = stock_actual + ?
            WHERE id = ?
        `, [
            cantidad,
            lote_id
        ]);

        await conexion.commit();

        return {
            movimiento_id: movimientoId,
            producto_id,
            lote_id,
            tipo: 'ENTRADA',
            cantidad
        };

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        throw error;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function registrarSalida({
    producto_id,
    usuario_id,
    cantidad,
    motivo,
    observacion
}) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        // 1. Verificar que el producto exista
        const productos = await conexion.query(`
            SELECT
                id,
                nombre
            FROM productos
            WHERE id = ?
        `, [producto_id]);

        if (productos.length === 0) {
            throw new Error('Producto no encontrado');
        }

        // 2. Buscar lotes con stock, ordenados por FEFO
        const lotes = await conexion.query(`
            SELECT
                id,
                codigo_lote,
                fecha_vencimiento,
                stock_actual
            FROM lotes
            WHERE producto_id = ?
              AND stock_actual > 0
              AND estado = 'activo'
            ORDER BY
                fecha_vencimiento ASC,
                id ASC
            FOR UPDATE
        `, [producto_id]);

        // 3. Comprobar stock disponible
        const stockDisponible = lotes.reduce(
            (total, lote) => total + Number(lote.stock_actual),
            0
        );

        if (stockDisponible < cantidad) {
            throw new Error(
                `Stock insuficiente. Disponible: ${stockDisponible}`
            );
        }

        // 4. Registrar movimiento principal
        const resultadoMovimiento = await conexion.query(`
            INSERT INTO movimientos_stock (
                producto_id,
                usuario_id,
                tipo,
                cantidad,
                motivo,
                observacion
            )
            VALUES (?, ?, 'SALIDA', ?, ?, ?)
        `, [
            producto_id,
            usuario_id || null,
            cantidad,
            motivo,
            observacion || null
        ]);

        const movimientoId = Number(resultadoMovimiento.insertId);

        // 5. Repartir la salida utilizando FEFO
        let cantidadPendiente = Number(cantidad);
        const lotesUtilizados = [];

        for (const lote of lotes) {
            if (cantidadPendiente <= 0) {
                break;
            }

            const stockLote = Number(lote.stock_actual);

            const cantidadSalida = Math.min(
                cantidadPendiente,
                stockLote
            );

            // Registrar movimiento del lote
            await conexion.query(`
                INSERT INTO movimientos_lotes (
                    movimiento_id,
                    lote_id,
                    cantidad
                )
                VALUES (?, ?, ?)
            `, [
                movimientoId,
                lote.id,
                cantidadSalida
            ]);

            // Descontar stock
            await conexion.query(`
                UPDATE lotes
                SET stock_actual = stock_actual - ?
                WHERE id = ?
            `, [
                cantidadSalida,
                lote.id
            ]);

            lotesUtilizados.push({
                lote_id: lote.id,
                codigo_lote: lote.codigo_lote,
                cantidad: cantidadSalida
            });

            cantidadPendiente -= cantidadSalida;
        }

        // 6. Confirmar toda la operación
        await conexion.commit();

        return {
            movimiento_id: movimientoId,
            producto_id,
            tipo: 'SALIDA',
            cantidad,
            lotes: lotesUtilizados
        };

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        throw error;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerMovimientos() {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const movimientos = await conexion.query(`
            SELECT
                m.id,
                m.producto_id,
                p.codigo,
                p.nombre AS producto,
                m.usuario_id,
                m.tipo,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.fecha
            FROM movimientos_stock m
            INNER JOIN productos p
                ON p.id = m.producto_id
            ORDER BY
                m.fecha DESC,
                m.id DESC
        `);

        return movimientos;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerMovimientosPorProducto(productoId) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const movimientos = await conexion.query(`
            SELECT
                m.id,
                m.producto_id,
                p.codigo,
                p.nombre AS producto,
                m.usuario_id,
                m.tipo,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.fecha
            FROM movimientos_stock m
            INNER JOIN productos p
                ON p.id = m.producto_id
            WHERE m.producto_id = ?
            ORDER BY
                m.fecha DESC,
                m.id DESC
        `, [productoId]);

        return movimientos;

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

async function obtenerMovimientoPorId(movimientoId) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const movimientos = await conexion.query(`
            SELECT
                m.id,
                m.producto_id,
                p.codigo,
                p.nombre AS producto,
                m.usuario_id,
                m.tipo,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.fecha
            FROM movimientos_stock m
            INNER JOIN productos p
                ON p.id = m.producto_id
            WHERE m.id = ?
        `, [movimientoId]);

        if (movimientos.length === 0) {
            throw new Error('Movimiento no encontrado');
        }

        const movimiento = movimientos[0];

        const lotes = await conexion.query(`
            SELECT
                ml.lote_id,
                l.codigo_lote,
                l.fecha_vencimiento,
                ml.cantidad
            FROM movimientos_lotes ml
            INNER JOIN lotes l
                ON l.id = ml.lote_id
            WHERE ml.movimiento_id = ?
            ORDER BY
                l.fecha_vencimiento ASC,
                ml.lote_id ASC
        `, [movimientoId]);

        return {
            movimiento,
            lotes
        };

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
}

module.exports = {
    registrarEntrada,
    registrarSalida,
    obtenerMovimientos,
    obtenerMovimientosPorProducto,
    obtenerMovimientoPorId
};