const { MAX_CENTESIMAS, errorMovimiento, centesimas, decimalSQL, validarMovimiento } = require('./movimientos.validaciones');
const { bloquearProductoActivo } = require('./producto-operacion');
const pool = require('../config/db');
const { validarLote, insertarLote } = require('./lotes.service');

async function registrarEntrada(datos) {
    let { producto_id, usuario_id, cantidad: cantidadExacta, motivo, observacion, lote_id, nuevo_lote } = validarMovimiento(datos, true);
    const cantidad = decimalSQL(cantidadExacta);
    if (nuevo_lote !== undefined) {
        try { validarLote(nuevo_lote); }
        catch (error) { throw errorMovimiento(error.message); }
    }
    let conexion;

    try {
        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        await bloquearProductoActivo(conexion, producto_id);

        if (nuevo_lote !== undefined) {
            lote_id = (await insertarLote(conexion, producto_id, nuevo_lote)).id;
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
              AND estado = 'activo'
            FOR UPDATE
        `, [lote_id, producto_id]);

        if (lotes.length === 0) {
            throw errorMovimiento(
                'El lote no existe, no está activo o no pertenece al producto'
            );
        }

        if (centesimas(lotes[0].stock_actual, true) + cantidadExacta > MAX_CENTESIMAS) throw errorMovimiento('La entrada supera la capacidad máxima del lote', 409);

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
            cantidad: Number(cantidad)
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

async function registrarSalida(datos) {
    const { producto_id, usuario_id, cantidad: cantidadExacta, motivo, observacion } = validarMovimiento(datos, false);
    const cantidad = decimalSQL(cantidadExacta);
    let conexion;

    try {
        conexion = await pool.getConnection();

        await conexion.beginTransaction();

        await bloquearProductoActivo(conexion, producto_id);

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
            (total, lote) => total + centesimas(lote.stock_actual, true),
            0n
        );

        if (stockDisponible < cantidadExacta) {
            throw errorMovimiento(`Stock insuficiente. Disponible: ${decimalSQL(stockDisponible)}`, 409);
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
        let cantidadPendiente = cantidadExacta;
        const lotesUtilizados = [];

        for (const lote of lotes) {
            if (cantidadPendiente <= 0n) {
                break;
            }

            const stockLote = centesimas(lote.stock_actual, true);

            const cantidadSalidaExacta = cantidadPendiente < stockLote ? cantidadPendiente : stockLote;
            const cantidadSalida = decimalSQL(cantidadSalidaExacta);

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
                cantidad: Number(cantidadSalida)
            });

            cantidadPendiente -= cantidadSalidaExacta;
        }

        if (cantidadPendiente !== 0n) throw errorMovimiento('No se pudo completar la distribución FEFO', 500);

        // 6. Confirmar toda la operación
        await conexion.commit();

        return {
            movimiento_id: movimientoId,
            producto_id,
            tipo: 'SALIDA',
            cantidad: Number(cantidad),
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

async function obtenerMovimientos(filtros = {}) {
    let conexion;

    try {
        conexion = await pool.getConnection();

        const condiciones = [];
        const parametros = [];

        // Filtrar desde una fecha
        if (filtros.fecha_desde) {
            condiciones.push('m.fecha >= ?');
            parametros.push(`${filtros.fecha_desde} 00:00:00`);
        }

        // Filtrar hasta una fecha
        if (filtros.fecha_hasta) {
            condiciones.push('m.fecha <= ?');
            parametros.push(`${filtros.fecha_hasta} 23:59:59`);
        }

        // Filtrar por tipo de movimiento
        if (filtros.tipo) {
            condiciones.push('m.tipo = ?');
            parametros.push(filtros.tipo);
        }

        // Filtrar por producto
        if (filtros.producto_id) {
            condiciones.push('m.producto_id = ?');
            parametros.push(Number(filtros.producto_id));
        }

        let consultaBase = `
            FROM movimientos_stock m
            INNER JOIN productos p
                ON p.id = m.producto_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
        `;

        if (condiciones.length > 0) {
            consultaBase += `
                WHERE ${condiciones.join(' AND ')}
            `;
        }

        // Obtener cantidad total de movimientos
        const resultadoTotal = await conexion.query(`
            SELECT COUNT(*) AS total
            ${consultaBase}
        `, parametros);

        const total = Number(resultadoTotal[0].total);

        // Paginación
        const pagina = Number(filtros.pagina) || 1;
        const limite = Number(filtros.limite) || 10;

        const offset = (pagina - 1) * limite;

        // Obtener movimientos de la página actual
        const movimientos = await conexion.query(`
            SELECT
                m.id,
                m.producto_id,
                p.codigo,
                p.nombre AS producto,
                m.usuario_id,
                u.nombre AS usuario_responsable,
                m.tipo,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.fecha
            ${consultaBase}
            ORDER BY
                m.fecha DESC,
                m.id DESC
            ${filtros.exportar ? '' : 'LIMIT ? OFFSET ?'}
        `, [
            ...parametros,
            ...(filtros.exportar ? [] : [limite, offset])
        ]);

        const totalPaginas = Math.ceil(total / limite);

        return {
            pagina,
            limite,
            total,
            total_paginas: totalPaginas,
            movimientos
        };

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
                u.nombre AS usuario_responsable,
                m.tipo,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.fecha
            FROM movimientos_stock m
            INNER JOIN productos p
                ON p.id = m.producto_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
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
                u.nombre AS usuario_responsable,
                m.tipo,
                m.cantidad,
                m.motivo,
                m.observacion,
                m.fecha
            FROM movimientos_stock m
            INNER JOIN productos p
                ON p.id = m.producto_id
            LEFT JOIN usuarios u ON u.id = m.usuario_id
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
