import { useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
    const [email, setEmail] = useState('');
    const [contrasena, setContrasena] = useState('');

    const [token, setToken] = useState(null);
    const [usuario, setUsuario] = useState(null);
    const [resumen, setResumen] = useState(null);
    const [productos, setProductos] = useState([]);

    const [productoSeleccionado, setProductoSeleccionado] = useState(null);
    const [lotes, setLotes] = useState([]);

    const [cargando, setCargando] = useState(false);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [error, setError] = useState('');

    async function iniciarSesion(event) {
        event.preventDefault();

        setError('');
        setCargando(true);

        try {
            const respuesta = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    contrasena
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error || 'Error al iniciar sesión'
                );
            }

            setToken(datos.token);
            setUsuario(datos.usuario);

            await obtenerResumen(datos.token);
            await obtenerProductos(datos.token);

        } catch (error) {
            console.error(error);
            setError(error.message);

        } finally {
            setCargando(false);
        }
    }

    async function obtenerResumen(tokenActual) {
        const respuesta = await fetch(
            `${API_URL}/stock/resumen`,
            {
                headers: {
                    Authorization: `Bearer ${tokenActual}`
                }
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error || 'Error al obtener el resumen'
            );
        }

        setResumen(datos);
    }

    async function obtenerProductos(tokenActual) {
        const respuesta = await fetch(
            `${API_URL}/productos`,
            {
                headers: {
                    Authorization: `Bearer ${tokenActual}`
                }
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error || 'Error al obtener los productos'
            );
        }

        setProductos(datos);
    }

    async function verDetalleProducto(producto) {
        setProductoSeleccionado(producto);
        setLotes([]);
        setError('');
        setCargandoDetalle(true);

        try {
            const respuesta = await fetch(
                `${API_URL}/productos/${producto.id}/lotes`,
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
            setCargandoDetalle(false);
        }
    }

    function cerrarDetalle() {
        setProductoSeleccionado(null);
        setLotes([]);
        setError('');
    }

    function cerrarSesion() {
        setToken(null);
        setUsuario(null);
        setResumen(null);
        setProductos([]);
        setProductoSeleccionado(null);
        setLotes([]);
        setEmail('');
        setContrasena('');
        setError('');
    }

    if (!token) {
        return (
            <div className="app">
                <main className="login-container">

                    <div className="login-card">

                        <h1>Stock Fiable</h1>

                        <p className="login-subtitle">
                            Sistema de gestión de stock
                        </p>

                        <form onSubmit={iniciarSesion}>

                            <div className="form-group">
                                <label htmlFor="email">
                                    Email
                                </label>

                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) =>
                                        setEmail(event.target.value)
                                    }
                                    placeholder="Ingresá tu email"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="contrasena">
                                    Contraseña
                                </label>

                                <input
                                    id="contrasena"
                                    type="password"
                                    value={contrasena}
                                    onChange={(event) =>
                                        setContrasena(event.target.value)
                                    }
                                    placeholder="Ingresá tu contraseña"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="login-button"
                                disabled={cargando}
                            >
                                {cargando
                                    ? 'Ingresando...'
                                    : 'Iniciar sesión'}
                            </button>

                        </form>

                    </div>

                </main>
            </div>
        );
    }

    if (!resumen) {
        return (
            <div className="app">
                <main className="main">
                    <div className="card">
                        <h2>Cargando...</h2>
                        <p>
                            Obteniendo información del inventario.
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app">

            <header className="header">

                <div>
                    <h1>Stock Fiable</h1>
                    <p>Sistema de gestión de stock</p>
                </div>

                <div className="user-info">

                    <span>
                        {usuario?.nombre} ({usuario?.rol})
                    </span>

                    <button
                        type="button"
                        onClick={cerrarSesion}
                    >
                        Cerrar sesión
                    </button>

                </div>

            </header>

            <main className="main">

                <section className="welcome">

                    <h2>Panel principal</h2>

                    <p>
                        Bienvenido al sistema de gestión de inventario.
                    </p>

                </section>

                <section className="dashboard">

                    <div className="card">
                        <h3>Productos</h3>
                        <p>{resumen.total_productos}</p>
                        <small>
                            Productos registrados
                        </small>
                    </div>

                    <div className="card">
                        <h3>Unidades en stock</h3>
                        <p>{resumen.unidades_totales}</p>
                        <small>
                            Unidades disponibles
                        </small>
                    </div>

                    <div className="card">
                        <h3>Stock bajo</h3>
                        <p>{resumen.productos_stock_bajo}</p>
                        <small>
                            Productos que necesitan reposición
                        </small>
                    </div>

                    <div className="card">
                        <h3>Sin stock</h3>
                        <p>{resumen.productos_sin_stock}</p>
                        <small>
                            Productos sin unidades disponibles
                        </small>
                    </div>

                    <div className="card">
                        <h3>Stock normal</h3>
                        <p>{resumen.productos_stock_normal}</p>
                        <small>
                            Productos con stock suficiente
                        </small>
                    </div>

                </section>

                <section className="products-section">

                    <div className="section-header">
                        <h2>Productos</h2>

                        <span>
                            {productos.length} registrados
                        </span>
                    </div>

                    <div className="products-table-container">

                        <table className="products-table">

                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Producto</th>
                                    <th>Marca</th>
                                    <th>Categoría</th>
                                    <th>Precio venta</th>
                                    <th>Stock mínimo</th>
                                    <th>Estado</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>

                            <tbody>

                                {productos.map((producto) => (
                                    <tr key={producto.id}>

                                        <td>
                                            {producto.codigo}
                                        </td>

                                        <td>
                                            {producto.nombre}
                                        </td>

                                        <td>
                                            {producto.marca || '-'}
                                        </td>

                                        <td>
                                            {producto.categoria || '-'}
                                        </td>

                                        <td>
                                            ${Number(
                                                producto.precio_venta
                                            ).toLocaleString('es-AR')}
                                        </td>

                                        <td>
                                            {producto.stock_minimo}
                                        </td>

                                        <td>
                                            {producto.estado}
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="detail-button"
                                                onClick={() =>
                                                    verDetalleProducto(producto)
                                                }
                                            >
                                                Ver detalle
                                            </button>
                                        </td>

                                    </tr>
                                ))}

                            </tbody>

                        </table>

                    </div>

                </section>

                {productoSeleccionado && (
                    <section className="product-detail">

                        <div className="detail-header">

                            <div>
                                <h2>
                                    {productoSeleccionado.nombre}
                                </h2>

                                <p>
                                    Código: {productoSeleccionado.codigo}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="close-detail-button"
                                onClick={cerrarDetalle}
                            >
                                Cerrar
                            </button>

                        </div>

                        <div className="detail-info">

                            <div className="detail-card">
                                <span>Stock actual</span>
                                <strong>
                                    {productoSeleccionado.stock_actual ?? '-'}
                                </strong>
                            </div>

                            <div className="detail-card">
                                <span>Stock mínimo</span>
                                <strong>
                                    {productoSeleccionado.stock_minimo}
                                </strong>
                            </div>

                            <div className="detail-card">
                                <span>Estado</span>
                                <strong>
                                    {productoSeleccionado.estado}
                                </strong>
                            </div>

                        </div>

                        <h3>Lotes</h3>

                        {cargandoDetalle ? (
                            <p className="secondary-text">
                                Cargando lotes...
                            </p>
                        ) : lotes.length === 0 ? (
                            <p className="secondary-text">
                                Este producto no tiene lotes registrados.
                            </p>
                        ) : (
                            <div className="lots-table-container">

                                <table className="lots-table">

                                    <thead>
                                        <tr>
                                            <th>Lote</th>
                                            <th>Fecha de vencimiento</th>
                                            <th>Cantidad</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {lotes.map((lote) => (
                                            <tr key={lote.id}>

                                                <td>
                                                    {lote.numero_lote || lote.lote || '-'}
                                                </td>

                                                <td>
                                                    {lote.fecha_vencimiento
                                                        ? new Date(
                                                            lote.fecha_vencimiento
                                                        ).toLocaleDateString('es-AR')
                                                        : '-'}
                                                </td>

                                                <td>
                                                    {lote.cantidad ?? lote.stock ?? 0}
                                                </td>

                                                <td>
                                                    {lote.estado || 'VIGENTE'}
                                                </td>

                                            </tr>
                                        ))}

                                    </tbody>

                                </table>

                            </div>
                        )}

                    </section>
                )}

            </main>

        </div>
    );
}

export default App;