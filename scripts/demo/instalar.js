const { configuracion, conDestino, nombresTablas } = require('./comun');
// Reuse only the approved structural definitions, never prepararSchema or fixtures.
const { tablas } = require('../../tests/integracion/fixtures/schema');
const CATEGORIAS = ['Alimentos de demostración', 'Limpieza de demostración', 'Otros de demostración'];

async function instalar(c) {
    if ((await nombresTablas(c)).length) throw new Error('La base debe estar vacía; no se sobrescribirá ningún objeto');
    let creadas = 0;
    try {
        for (const ddl of tablas) { await c.query(ddl); creadas++; }
        await c.beginTransaction();
        try {
            for (const nombre of CATEGORIAS) await c.query('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)', [nombre, 'Categoría ficticia para demostraciones']);
            await c.commit();
        } catch (error) { await c.rollback(); throw error; }
    } catch (_) {
        throw new Error('Instalación posiblemente incompleta (' + creadas + ' tablas confirmadas). El DDL no se revierte automáticamente. Revisar solo la base demo; no se eliminaron objetos.');
    }
    return { tablas: creadas, categorias: CATEGORIAS.length };
}

async function main() {
    const config = configuracion(process.env, process.argv.slice(2));
    console.log('Destino exclusivo: stock_fiable_demo. No se crearán bases ni usuarios MariaDB.');
    const resultado = await conDestino(config, instalar);
    console.log('Esquema instalado: ' + resultado.tablas + ' tablas y ' + resultado.categorias + ' categorías ficticias.');
}
if (require.main === module) main().catch(error => {
    // Never print driver errors, query parameters or environment values.
    console.error('Instalación detenida. ' + (/^(Requiere |Destino |Puerto |Faltan |La base |Otra |Instalación posiblemente)/.test(error.message) ? error.message : 'Fallo de conexión o instalación; revisar el destino demo antes de reintentar.'));
    process.exitCode = 1;
});
module.exports = { instalar, CATEGORIAS };
