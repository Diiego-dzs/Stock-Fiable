const { prepararSchema } = require('../fixtures/schema');
function conservarError(principal, limpieza) {
    if (!principal) return limpieza;
    (principal.erroresLimpieza ||= []).push(limpieza);
    return principal;
}

// Importing this module never loads dotenv, creates a pool or opens a connection.
async function crearEntorno({ verificar, database, user, password, marcador, signal }, crearPool = opciones => require('mariadb').createPool(opciones)) {
    const cancelar = () => { if (signal?.aborted) throw new Error('Ejecución cancelada'); };
    if (typeof verificar !== 'function' || !/^sf_it_[a-f0-9]{24}$/.test(database) || marcador !== database) throw new Error('Identidad temporal inválida');
    cancelar();
    const destino = await verificar();
    cancelar();
    if (destino.host !== '127.0.0.1' || !Number.isInteger(destino.port) || destino.port < 1 || destino.port > 65535 || destino.hostname !== database) throw new Error('Destino fuera del contenedor autorizado');
    const pool = crearPool({ host: destino.host, port: destino.port, database, user, password,
        connectionLimit: 5, minimumIdle: 0, connectTimeout: 5000, acquireTimeout: 10000,
        decimalAsNumber: false, multipleStatements: false });
    let cerrado = false, cierre, restaurar, interceptor;
    const conexiones = new Set(), pendientes = new Set(), liberaciones = new Set(), fallosLiberacion = [];
    function comprobar() { cancelar(); if (cerrado) throw new Error('Entorno cerrado'); }
    function obtenerConexion() {
        const tarea = (async () => {
            comprobar();
            const actual = await verificar();
            comprobar();
            if (actual.host !== destino.host || actual.port !== destino.port || actual.hostname !== destino.hostname) throw new Error('El destino temporal cambió');
            const conexion = await pool.getConnection();
            const consultar = conexion.query.bind(conexion);
            conexion.query = async (sql, params) => {
                comprobar();
                if (interceptor) await interceptor(sql, params);
                return consultar(sql, params);
            };
            const registro = { conexion, promesa: null };
            const original = conexion.release.bind(conexion);
            function liberar() {
                if (registro.promesa) return registro.promesa;
                registro.promesa = Promise.resolve().then(original);
                liberaciones.add(registro.promesa);
                registro.promesa.then(() => { conexiones.delete(registro); liberaciones.delete(registro.promesa); }, error => {
                    conexiones.delete(registro); liberaciones.delete(registro.promesa); fallosLiberacion.push(error);
                });
                return registro.promesa;
            }
            conexion.release = liberar;
            conexion.end = liberar;
            conexiones.add(registro);
            try {
                comprobar();
                const [identidad] = await conexion.query('SELECT DATABASE() AS db, @@hostname AS hostname');
                comprobar();
                if (identidad.db !== database || identidad.hostname !== database) throw new Error('Identidad MariaDB no autorizada');
                return conexion;
            } catch (error) {
                try { await liberar(); } catch (limpieza) { conservarError(error, limpieza); }
                throw error;
            }
        })();
        pendientes.add(tarea);
        tarea.then(() => pendientes.delete(tarea), () => pendientes.delete(tarea));
        return tarea;
    }
    async function conConexion(tarea) {
        const conexion = await obtenerConexion();
        let resultado, error;
        try { comprobar(); resultado = await tarea(conexion); } catch (e) { error = e; }
        try { await conexion.release(); } catch (limpieza) { error = conservarError(error, limpieza); }
        if (error) throw error;
        return resultado;
    }
    const exclusivo = { getConnection: obtenerConexion, query: (sql, params) => conConexion(c => c.query(sql, params)) };
    return {
        pool: exclusivo, conConexion,
        async esperarLiberaciones() {
            await Promise.allSettled([...liberaciones]);
            if (fallosLiberacion.length) throw fallosLiberacion[0];
            if (pendientes.size || conexiones.size) throw new Error('Quedaron conexiones pendientes');
        },
        async conInterceptor(antesConsulta, tarea) {
            comprobar();
            if (interceptor || conexiones.size || pendientes.size) throw new Error('La inyección exige un entorno exclusivo sin conexiones');
            interceptor = antesConsulta;
            try { return await tarea(); }
            finally { interceptor = undefined; }
        },
        preparar: () => conConexion(c => prepararSchema(c, marcador, comprobar)),
        transaccion: tarea => conConexion(async c => {
            comprobar(); await c.beginTransaction();
            try { comprobar(); const resultado = await tarea(c); comprobar(); await c.commit(); return resultado; }
            catch (error) { try { await c.rollback(); } catch (limpieza) { conservarError(error, limpieza); } throw error; }
        }),
        inyectarServicios() {
            comprobar();
            const rutaDb = require.resolve('../../../src/config/db');
            const rutaServicios = require('node:path').resolve(__dirname, '../../../src/services') + require('node:path').sep;
            if (restaurar || require.cache[rutaDb] || Object.keys(require.cache).some(ruta => ruta.startsWith(rutaServicios))) throw new Error('Inyectar antes de importar configuración o servicios, en un proceso exclusivo');
            require.cache[rutaDb] = { id: rutaDb, filename: rutaDb, loaded: true, exports: exclusivo };
            restaurar = () => {
                delete require.cache[rutaDb];
                for (const ruta of Object.keys(require.cache)) if (ruta.startsWith(rutaServicios)) delete require.cache[ruta];
            };
            return { movimientos: require('../../../src/services/movimientos.service'), productos: require('../../../src/services/productos.service'), lotes: require('../../../src/services/lotes.service'), stock: require('../../../src/services/stock.service') };
        },
        cerrar() {
            if (cierre) return cierre;
            cerrado = true;
            cierre = (async () => {
                let error;
                try { if (restaurar) restaurar(); } catch (e) { error = e; }
                await Promise.allSettled([...pendientes]);
                await Promise.allSettled([...conexiones].map(r => r.conexion.release()));
                await Promise.allSettled([...liberaciones]);
                for (const fallo of fallosLiberacion) error = conservarError(error, fallo);
                try { await pool.end(); } catch (e) { error = conservarError(error, e); }
                if (error) throw error;
            })();
            return cierre;
        }
    };
}
module.exports = { crearEntorno, conservarError };
