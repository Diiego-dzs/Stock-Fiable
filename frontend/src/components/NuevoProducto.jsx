import { useState } from 'react';

const API_URL = 'http://localhost:3000/api';

function NuevoProducto({ token, categorias, onProductoCreado }) {
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [marca, setMarca] = useState('');
    const [categoriaId, setCategoriaId] = useState('');
    const [precioCompra, setPrecioCompra] = useState('');
    const [precioVenta, setPrecioVenta] = useState('');
    const [stockMinimo, setStockMinimo] = useState('');
    const [estado, setEstado] = useState('activo');

    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [resultado, setResultado] = useState(null);

    function limpiarFormulario() {
        setCodigo('');
        setNombre('');
        setDescripcion('');
        setMarca('');
        setCategoriaId('');
        setPrecioCompra('');
        setPrecioVenta('');
        setStockMinimo('');
        setEstado('activo');
    }

    async function crearProducto(event) {
        event.preventDefault();

        setError('');
        setResultado(null);

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
                `${API_URL}/productos`,
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
                    datos.error || 'Error al crear el producto'
                );
            }

            setResultado(datos);
            limpiarFormulario();

            if (onProductoCreado) {
                await onProductoCreado();
            }

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
                <h2>Nuevo producto</h2>
            </div>

            <div className="movimientos-card">

                <form onSubmit={crearProducto}>

                    <div className="form-group">
                        <label htmlFor="producto-codigo">
                            Código
                        </label>

                        <input
                            id="producto-codigo"
                            type="text"
                            maxLength={50}
                            value={codigo}
                            onChange={(event) =>
                                setCodigo(event.target.value)
                            }
                            placeholder="Ej: PROD-001"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-nombre">
                            Nombre
                        </label>

                        <input
                            id="producto-nombre"
                            type="text"
                            maxLength={150}
                            value={nombre}
                            onChange={(event) =>
                                setNombre(event.target.value)
                            }
                            placeholder="Nombre del producto"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-categoria">
                            Categoría
                        </label>

                        <select
                            id="producto-categoria"
                            value={categoriaId}
                            onChange={(event) =>
                                setCategoriaId(event.target.value)
                            }
                            required
                        >
                            <option value="">
                                Seleccioná una categoría
                            </option>

                            {categorias.map((categoria) => (
                                <option
                                    key={categoria.id}
                                    value={categoria.id}
                                >
                                    {categoria.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-marca">
                            Marca (opcional)
                        </label>

                        <input
                            id="producto-marca"
                            type="text"
                            maxLength={100}
                            value={marca}
                            onChange={(event) =>
                                setMarca(event.target.value)
                            }
                            placeholder="Marca del producto"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-descripcion">
                            Descripción (opcional)
                        </label>

                        <textarea
                            id="producto-descripcion"
                            rows={3}
                            value={descripcion}
                            onChange={(event) =>
                                setDescripcion(event.target.value)
                            }
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-precio-compra">
                            Precio de compra
                        </label>

                        <input
                            id="producto-precio-compra"
                            type="number"
                            min="0"
                            step="0.01"
                            value={precioCompra}
                            onChange={(event) =>
                                setPrecioCompra(event.target.value)
                            }
                            placeholder="0.00"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-precio-venta">
                            Precio de venta
                        </label>

                        <input
                            id="producto-precio-venta"
                            type="number"
                            min="0"
                            step="0.01"
                            value={precioVenta}
                            onChange={(event) =>
                                setPrecioVenta(event.target.value)
                            }
                            placeholder="0.00"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-stock-minimo">
                            Stock mínimo
                        </label>

                        <input
                            id="producto-stock-minimo"
                            type="number"
                            min="0"
                            step="0.01"
                            value={stockMinimo}
                            onChange={(event) =>
                                setStockMinimo(event.target.value)
                            }
                            placeholder="0"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="producto-estado">
                            Estado
                        </label>

                        <select
                            id="producto-estado"
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

                    {resultado && (
                        <div className="success-message">
                            <strong>{resultado.mensaje}</strong>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-button"
                        disabled={enviando}
                    >
                        {enviando
                            ? 'Creando...'
                            : 'Crear producto'}
                    </button>

                </form>

            </div>

        </section>
    );
}

export default NuevoProducto;
