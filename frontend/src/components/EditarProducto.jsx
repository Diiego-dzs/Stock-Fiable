import { useState } from 'react';

const API_URL = 'http://localhost:3000/api';

function EditarProducto({ token, producto, categorias, onGuardado, onCancelar }) {
    const [codigo, setCodigo] = useState(producto.codigo ?? '');
    const [nombre, setNombre] = useState(producto.nombre ?? '');
    const [descripcion, setDescripcion] = useState(producto.descripcion ?? '');
    const [marca, setMarca] = useState(producto.marca ?? '');
    const [categoriaId, setCategoriaId] = useState(String(producto.categoria_id));
    const [precioCompra, setPrecioCompra] = useState(String(producto.precio_compra ?? ''));
    const [precioVenta, setPrecioVenta] = useState(String(producto.precio_venta ?? ''));
    const [stockMinimo, setStockMinimo] = useState(String(producto.stock_minimo ?? ''));
    const [estado, setEstado] = useState(producto.estado ?? 'activo');

    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');

    async function guardarCambios(event) {
        event.preventDefault();

        setError('');

        const cuerpo = {
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            marca: marca.trim() || null,
            categoria_id: Number(categoriaId),
            precio_compra: Number(precioCompra) || 0,
            precio_venta: Number(precioVenta) || 0,
            stock_minimo: Number(stockMinimo) || 0,
            estado
        };

        setEnviando(true);

        try {
            const respuesta = await fetch(
                `${API_URL}/productos/${producto.id}`,
                {
                    method: 'PUT',
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
                    datos.error || 'Error al actualizar el producto'
                );
            }

            await onGuardado(datos.producto);

        } catch (error) {
            console.error(error);
            setError(error.message);

        } finally {
            setEnviando(false);
        }
    }

    return (
        <section className="movimientos-section">

            <div className="section-header">
                <h2>Editar producto</h2>
            </div>

            <div className="movimientos-card">

                <form onSubmit={guardarCambios}>

                    <div className="form-group">
                        <label htmlFor="editar-codigo">
                            Código
                        </label>

                        <input
                            id="editar-codigo"
                            type="text"
                            maxLength={50}
                            value={codigo}
                            onChange={(event) =>
                                setCodigo(event.target.value)
                            }
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-nombre">
                            Nombre
                        </label>

                        <input
                            id="editar-nombre"
                            type="text"
                            maxLength={150}
                            value={nombre}
                            onChange={(event) =>
                                setNombre(event.target.value)
                            }
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-categoria">
                            Categoría
                        </label>

                        <select
                            id="editar-categoria"
                            value={categoriaId}
                            onChange={(event) =>
                                setCategoriaId(event.target.value)
                            }
                            required
                        >
                            {categorias.map((categoria) => (
                                <option
                                    key={categoria.id}
                                    value={String(categoria.id)}
                                >
                                    {categoria.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-marca">
                            Marca (opcional)
                        </label>

                        <input
                            id="editar-marca"
                            type="text"
                            maxLength={100}
                            value={marca}
                            onChange={(event) =>
                                setMarca(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-descripcion">
                            Descripción (opcional)
                        </label>

                        <textarea
                            id="editar-descripcion"
                            rows={3}
                            value={descripcion}
                            onChange={(event) =>
                                setDescripcion(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-precio-compra">
                            Precio de compra
                        </label>

                        <input
                            id="editar-precio-compra"
                            type="number"
                            min="0"
                            step="0.01"
                            value={precioCompra}
                            onChange={(event) =>
                                setPrecioCompra(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-precio-venta">
                            Precio de venta
                        </label>

                        <input
                            id="editar-precio-venta"
                            type="number"
                            min="0"
                            step="0.01"
                            value={precioVenta}
                            onChange={(event) =>
                                setPrecioVenta(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-stock-minimo">
                            Stock mínimo
                        </label>

                        <input
                            id="editar-stock-minimo"
                            type="number"
                            min="0"
                            step="0.01"
                            value={stockMinimo}
                            onChange={(event) =>
                                setStockMinimo(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="editar-estado">
                            Estado
                        </label>

                        <select
                            id="editar-estado"
                            value={estado}
                            onChange={(event) =>
                                setEstado(event.target.value)
                            }
                        >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <div className="form-actions">

                        <button
                            type="submit"
                            className="login-button"
                            disabled={enviando}
                        >
                            {enviando
                                ? 'Guardando...'
                                : 'Guardar cambios'}
                        </button>

                        <button
                            type="button"
                            className="clear-filters-button"
                            onClick={onCancelar}
                            disabled={enviando}
                        >
                            Cancelar
                        </button>

                    </div>

                </form>

            </div>

        </section>
    );
}

export default EditarProducto;
