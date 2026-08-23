1234
import { useEffect, useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
    const [token, setToken] = useState(null);
    const [usuario, setUsuario] = useState(null);
    const [resumen, setResumen] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        iniciarSesion();
    }, []);

    async function iniciarSesion() {
        try {
            const respuesta = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'prueba@stock.com',
                    contrasena: '1234'
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(datos.error || 'Error al iniciar sesión');
            }

            setToken(datos.token);
            setUsuario(datos.usuario);

            await obtenerResumen(datos.token);

        } catch (error) {
            console.error(error);
            setError(error.message);
        }
    }

    async function obtenerResumen(tokenActual) {
        try {
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

        } catch (error) {
            console.error(error);
            setError(error.message);
        }
    }

    function cerrarSesion() {
        setToken(null);
        setUsuario(null);
        setResumen(null);
    }

    if (error) {
        return (
            <div className="app">
                <main className="main">
                    <div className="card">
                        <h2>Error</h2>
                        <p>{error}</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!token || !resumen) {
        return (
            <div className="app">
                <main className="main">
                    <div className="card">
                        <h2>Cargando...</h2>
                        <p>Conectando con Stock Fiable.</p>
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

                        <p>
                            {resumen.total_productos}
                        </p>

                        <small>
                            Productos registrados
                        </small>
                    </div>

                    <div className="card">
                        <h3>Unidades en stock</h3>

                        <p>
                            {resumen.unidades_totales}
                        </p>

                        <small>
                            Unidades disponibles
                        </small>
                    </div>

                    <div className="card">
                        <h3>Stock bajo</h3>

                        <p>
                            {resumen.productos_stock_bajo}
                        </p>

                        <small>
                            Productos que necesitan reposición
                        </small>
                    </div>

                    <div className="card">
                        <h3>Sin stock</h3>

                        <p>
                            {resumen.productos_sin_stock}
                        </p>

                        <small>
                            Productos sin unidades disponibles
                        </small>
                    </div>

                    <div className="card">
                        <h3>Stock normal</h3>

                        <p>
                            {resumen.productos_stock_normal}
                        </p>

                        <small>
                            Productos con stock suficiente
                        </small>
                    </div>

                    <div className="card">
                        <h3>Movimientos</h3>

                        <p>
                            Entradas y salidas
                        </p>

                        <small>
                            Consultar movimientos de stock
                        </small>
                    </div>

                </section>

            </main>

        </div>
    );
}

export default App;
