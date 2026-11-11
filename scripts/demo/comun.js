// No dotenv, application pool or connection is loaded on import.
const BASE = 'stock_fiable_demo';
const TABLAS = ['categorias', 'usuarios', 'productos', 'lotes', 'movimientos_stock', 'movimientos_lotes'];

function configuracion(env, args) {
    if (args.length !== 3 || args[0] !== '--autorizar-demo' || args[1] !== '--confirmar-base' || args[2] !== BASE) throw new Error('Requiere --autorizar-demo --confirmar-base ' + BASE);
    if (env.DEMO_DB_NAME !== BASE || !['127.0.0.1', 'localhost', '::1'].includes(env.DEMO_DB_HOST)) throw new Error('Destino de demostración no permitido');
    if (!/^[1-9]\d{0,4}$/.test(env.DEMO_DB_PORT || '') || Number(env.DEMO_DB_PORT) > 65535) throw new Error('Puerto de demostración inválido');
    if (!env.DEMO_DB_USER || !env.DEMO_DB_PASSWORD) throw new Error('Faltan credenciales exclusivas de demostración');
    return { host: env.DEMO_DB_HOST, port: Number(env.DEMO_DB_PORT), user: env.DEMO_DB_USER,
        password: env.DEMO_DB_PASSWORD, database: BASE, multipleStatements: false,
        connectTimeout: 5000, socketTimeout: 15000 };
}

async function conDestino(opciones, tarea, conectar = opts => require('mariadb').createConnection(opts)) {
    let conexion, bloqueo = false, error, resultado;
    try {
        conexion = await conectar(opciones);
        const [destino] = await conexion.query('SELECT DATABASE() AS db');
        if (destino.db !== BASE) throw new Error('La base conectada no es la demostración autorizada');
        // Both commands serialize bootstrap work on the same database, including empty users.
        const [lock] = await conexion.query('SELECT GET_LOCK(?, 5) AS adquirido', [BASE + ':bootstrap']);
        if (Number(lock.adquirido) !== 1) throw new Error('Otra inicialización está en curso');
        bloqueo = true;
        resultado = await tarea(conexion);
    } catch (e) { error = e; }
    finally {
        if (bloqueo) try { await conexion.query('SELECT RELEASE_LOCK(?)', [BASE + ':bootstrap']); }
        catch (e) { if (!error) error = e; else error.limpiezaFallida = true; }
        if (conexion) try { await conexion.end(); }
        catch (e) { if (!error) error = e; else error.limpiezaFallida = true; }
    }
    if (error) throw error;
    return resultado;
}

async function nombresTablas(c) {
    return Array.from(await c.query('SHOW FULL TABLES'), fila => Object.values(fila)[0]).sort();
}

function validarDueno(nombre, email, contrasena) {
    // Same field rules as validarUsuario(..., true); role and active are fixed here.
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) throw new Error('Nombre obligatorio: máximo 100 caracteres');
    if (typeof email !== 'string' || email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Correo inválido');
    if (typeof contrasena !== 'string' || contrasena.length < 8 || Buffer.byteLength(contrasena, 'utf8') > 72) throw new Error('Contraseña: al menos 8 caracteres y hasta 72 bytes UTF-8');
    return { nombre: nombre.trim(), email: email.trim().toLowerCase() };
}

module.exports = { BASE, TABLAS, configuracion, conDestino, nombresTablas, validarDueno };
