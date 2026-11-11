const { Writable } = require('node:stream');
const readline = require('node:readline');
const { configuracion, conDestino, nombresTablas, validarDueno, TABLAS } = require('./comun');

async function crearDueno(c, datos, hash = (texto, costo) => require('bcryptjs').hash(texto, costo)) {
    const validado = validarDueno(datos.nombre, datos.email, datos.contrasena);
    if (JSON.stringify(await nombresTablas(c)) !== JSON.stringify([...TABLAS].sort())) throw new Error('Se requiere el esquema demo completo, sin tablas adicionales');
    const [previo] = await c.query('SELECT COUNT(*) AS total FROM usuarios');
    if (BigInt(previo.total) !== 0n) throw new Error('La tabla usuarios no está vacía; no se creará otro Dueño inicial');
    const contrasena = await hash(datos.contrasena, 12);
    await c.beginTransaction();
    try {
        // Recheck after hashing. Advisory lock prevents races with the other bootstrap command.
        const usuarios = await c.query('SELECT id FROM usuarios FOR UPDATE');
        if (usuarios.length) throw new Error('La tabla usuarios no está vacía; no se creará otro Dueño inicial');
        await c.query('INSERT INTO usuarios (nombre, email, contrasena, rol, activo) VALUES (?, ?, ?, ?, ?)',
            [validado.nombre, validado.email, contrasena, 'Dueño', 1]);
        await c.commit();
    } catch (error) { await c.rollback(); throw error; }
}

function preguntar(texto, ocultar = false, { input = process.stdin, output = process.stdout, interfaz = readline.createInterface } = {}) {
    if (!input.isTTY || !output.isTTY) return Promise.reject(new Error('Se requiere terminal interactiva; no se aceptan contraseñas por argumentos ni tuberías'));
    return new Promise((resolve, reject) => {
        let terminada = false;
        const salida = new Writable({ write(chunk, encoding, callback) { if (!ocultar) output.write(chunk, encoding); callback(); } });
        const rl = interfaz({ input, output: salida, terminal: true });
        output.write(texto);
        rl.on('SIGINT', () => { terminada = true; rl.close(); output.write('\n'); reject(new Error('Operación cancelada')); });
        rl.on('close', () => { if (!terminada) { terminada = true; reject(new Error('Entrada interrumpida')); } });
        rl.question('', respuesta => { terminada = true; rl.close(); if (ocultar) output.write('\n'); resolve(respuesta); });
    });
}

async function main() {
    const config = configuracion(process.env, process.argv.slice(2));
    const datos = {};
    try {
        datos.nombre = await preguntar('Nombre del primer Dueño de demo: ');
        datos.email = await preguntar('Correo de demostración: ');
        datos.contrasena = await preguntar('Contraseña (entrada oculta): ', true);
        let confirmacion = await preguntar('Repetir contraseña (entrada oculta): ', true);
        if (datos.contrasena !== confirmacion) throw new Error('Las contraseñas no coinciden');
        confirmacion = undefined;
        await conDestino(config, c => crearDueno(c, datos));
        console.log('Primer Dueño de demostración creado. No se muestran credenciales.');
    } finally { datos.contrasena = undefined; }
}
if (require.main === module) main().catch(() => {
    console.error('Creación detenida. Verificar autorización, terminal interactiva, datos válidos y esquema demo con usuarios vacíos. No se sobrescribieron cuentas.');
    process.exitCode = 1;
});
module.exports = { crearDueno, preguntar };
