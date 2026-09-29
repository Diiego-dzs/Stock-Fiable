import { useState } from 'react';

const API_URL = 'http://localhost:3000/api';

const MOTIVOS = {
    ENTRADA: [
        'Compra a proveedor',
        'Devolución de cliente',
        'Ajuste de inventario'
    ],
    SALIDA: [
        'Venta',
        'Vencimiento',
        'Rotura o daño',
        'Ajuste de inventario'
    ]
};

function MovimientosStock({ token, productos, onMovimientoRegistrado }) {
    const [tipo, setTipo] = useState('ENTRADA');

    const [productoId, setProductoId] = useState('');
    const [loteId, setLoteId] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [motivo, setMotivo] = useState('');
    const [observacion, setObservacion] = useState('');

    const [lotes, setLotes] = useState([]);
    const [cargandoLotes, setCargandoLotes] = useState(false);

    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [resultado, setResultado] = useState(null);

    const lotesActivos = lotes.filter(
        (lote) => lote.estado === 'activo'
    );

    const stockDisponible = lotesActivos.reduce(
        (total, lote) => total + Number(lote.stock_actual),
        0
    );

    async function cargarLotes(id) {
        setCargandoLotes(true);
        setError('');

        try {
            const respuesta = await fetch(
                `${API_URL}/productos/${id}/lotes`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error || 'Error al obtener los lotes'
                );
            }

            setLotes(datos);

        } catch (error) {
            console.error(error);
            setError(error.message);

        } finally {
            setCargandoLotes(false);
        }
    }

    function cambiarTipo(nuevoTipo) {
        setTipo(nuevoTipo);
        setLoteId('');
        setMotivo('');
        setError('');
        setResultado(null);
    }

    function cambiarProducto(id) {
        setProductoId(id);
        setLoteId('');
        setResultado(null);
        setLotes([]);

        if (id) {
            cargarLotes(id);
        }
    }

    function limpiarFormulario() {
        setLoteId('');
        setCantidad('');
        setMotivo('');
        setObservacion('');
    }

    async function registrarMovimiento(event) {
        event.preventDefault();

        setError('');
        setResultado(null);

        if (tipo === 'SALIDA' && Number(cantidad) > stockDisponible) {
            setError(
                `Stock insuficiente. Disponible: ${stockDisponible}`
            );
            return;
        }

        const cuerpo = {
            producto_id: Number(productoId),
            cantidad: Number(cantidad),
            motivo: motivo.trim(),
            observacion: observacion.trim() || null
        };

        if (tipo === 'ENTRADA') {
            cuerpo.lote_id = Number(loteId);
        }

        const ruta = tipo === 'ENTRADA' ? 'entrada' : 'salida';

        setEnviando(true);

        try {
            const respuesta = await fetch(
                `${API_URL}/movimientos/${ruta}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(cuerpo)
                }
            );

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error || 'Error al registrar el movimiento'
                );
            }

            setResultado(datos);
            limpiarFormulario();

            await cargarLotes(productoId);

            if (onMovimientoRegistrado) {
                await onMovimientoRegistrado();
            }

        } catch (error) {
            console.error(error);
            setError(error.message);

        } finally {
            setEnviando(false);
        }
    }

    const sinLotesParaEntrada =
        tipo === 'ENTRADA' &&
        productoId &&
        !cargandoLotes &&
        lotesActivos.length === 0;

    return (
        <section className="movimientos-section">

            <div className="section-header">
                <h2>Registrar movimiento</h2>
            </div>

            <div className="movimientos-card">

                <div className="movimientos-tabs">
                    <button
                        type="button"
                        className={tipo === 'ENTRADA' ? 'activo' : ''}
                        onClick={() => cambiarTipo('ENTRADA')}
                    >
                        Entrada de stock
                    </button>

                    <button
                        type="button"
                        className={tipo === 'SALIDA' ? 'activo' : ''}
                        onClick={() => cambiarTipo('SALIDA')}
                    >
                        Salida de stock
                    </button>
                </div>

                <form onSubmit={registrarMovimiento}>

                    <div className="form-group">
                        <label htmlFor="movimiento-producto">
                            Producto
                        </label>

                        <select
                            id="movimiento-producto"
                            value={productoId}
                            onChange={(event) =>
                                cambiarProducto(event.target.value)
                            }
                            required
                        >
                            <option value="">
                                Seleccioná un producto
                            </option>

                            {productos.map((producto) => (
                                <option
                                    key={producto.id}
                                    value={producto.id}
                                >
                                    {producto.codigo} - {producto.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {productoId && (
                        <p className="movimientos-stock">
                            {cargandoLotes
                                ? 'Cargando lotes...'
                                : `Stock disponible: ${stockDisponible}`}
                        </p>
                    )}

                    {tipo === 'ENTRADA' && (
                        <div className="form-group">
                            <label htmlFor="movimiento-lote">
                                Lote
                            </label>

                            <select
                                id="movimiento-lote"
                                value={loteId}
                                onChange={(event) =>
                                    setLoteId(event.target.value)
                                }
                                disabled={!productoId || cargandoLotes}
                                required
                            >
                                <option value="">
                                    Seleccioná un lote
                                </option>

                                {lotesActivos.map((lote) => (
                                    <option
                                        key={lote.id}
                                        value={lote.id}
                                    >
                                        {lote.codigo_lote || `Lote ${lote.id}`}
                                        {' · vence '}
                                        {lote.fecha_vencimiento
                                            ? new Date(
                                                lote.fecha_vencimiento
                                            ).toLocaleDateString('es-AR')
                                            : 'sin fecha'}
                                        {' · stock '}
                                        {Number(lote.stock_actual)}
                                    </option>
                                ))}
                            </select>

                            {sinLotesParaEntrada && (
                                <small className="movimientos-ayuda">
                                    Este producto no tiene lotes activos.
                                </small>
                            )}
                        </div>
                    )}

                    {tipo === 'SALIDA' && (
                        <p className="movimientos-ayuda">
                            Las unidades se descuentan automáticamente
                            de los lotes que vencen primero.
                        </p>
                    )}

                    <div className="form-group">
                        <label htmlFor="movimiento-cantidad">
                            Cantidad
                        </label>

                        <input
                            id="movimiento-cantidad"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={cantidad}
                            onChange={(event) =>
                                setCantidad(event.target.value)
                            }
                            placeholder="Ej: 10"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="movimiento-motivo">
                            Motivo
                        </label>

                        <input
                            id="movimiento-motivo"
                            type="text"
                            list="movimiento-motivos"
                            maxLength={100}
                            value={motivo}
                            onChange={(event) =>
                                setMotivo(event.target.value)
                            }
                            placeholder="Elegí o escribí un motivo"
                            required
                        />

                        <datalist id="movimiento-motivos">
                            {MOTIVOS[tipo].map((opcion) => (
                                <option key={opcion} value={opcion} />
                            ))}
                        </datalist>
                    </div>

                    <div className="form-group">
                        <label htmlFor="movimiento-observacion">
                            Observación (opcional)
                        </label>

                        <textarea
                            id="movimiento-observacion"
                            rows={3}
                            maxLength={255}
                            value={observacion}
                            onChange={(event) =>
                                setObservacion(event.target.value)
                            }
                        />
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {resultado && (
                        <div className="success-message">
                            <strong>{resultado.mensaje}</strong>

                            {resultado.movimiento?.lotes?.length > 0 && (
                                <ul>
                                    {resultado.movimiento.lotes.map((lote) => (
                                        <li key={lote.lote_id}>
                                            {lote.codigo_lote || `Lote ${lote.lote_id}`}
                                            {': '}
                                            {lote.cantidad} unidades
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={enviando || sinLotesParaEntrada}
                    >
                        {enviando
                            ? 'Registrando...'
                            : tipo === 'ENTRADA'
                                ? 'Registrar entrada'
                                : 'Registrar salida'}
                    </button>

                </form>

            </div>

        </section>
    );
}

export default MovimientosStock;
