const ORIGEN_LOCAL = 'http://localhost:5173';

function resolverOrigenes(valor) {
    if (valor === undefined) return Object.freeze([ORIGEN_LOCAL]);
    const invalida = () => new Error('CORS_ORIGINS debe contener orígenes HTTP/HTTPS exactos separados por comas, sin rutas, credenciales, comodines, consultas ni fragmentos.');
    if (typeof valor !== 'string' || !valor.trim()) throw invalida();
    const origenes = valor.split(',').map(parte => {
        const texto = parte.trim();
        if (!/^https?:\/\/[^/]+$/i.test(texto) || /[\\*?#@]/.test(texto) || [...texto].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)) throw invalida();
        let url;
        try { url = new URL(texto); } catch { throw invalida(); }
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.hostname.includes('*') || url.username || url.password || url.pathname !== '/') throw invalida();
        return url.origin;
    });
    return Object.freeze([...new Set(origenes)]);
}

function crearOpcionesCors(valor) {
    const permitidos = new Set(resolverOrigenes(valor));
    return {
        origin(origen, callback) {
            // CORS only controls browser response access. Authentication remains in the routes.
            callback(null, typeof origen === 'string' && permitidos.has(origen));
        }
    };
}

module.exports = { resolverOrigenes, crearOpcionesCors };
