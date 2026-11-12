const { test } = require('node:test');
const assert = require('node:assert/strict');
const cors = require('cors');
const { resolverOrigenes, crearOpcionesCors } = require('../src/config/cors');
const configuracion = import('../frontend/src/configuracion.js');

test('API local predeterminada conserva ruta /api y módulo centralizado', async () => {
    const { resolverApiUrl, API_URL } = await configuracion;
    assert.equal(resolverApiUrl(undefined), 'http://localhost:3000/api');
    assert.equal(API_URL, 'http://localhost:3000/api');
});

test('API personalizada HTTP/HTTPS normaliza barras finales sin agregar ni quitar /api', async () => {
    const { resolverApiUrl } = await configuracion;
    for (const [entrada, salida] of [
        [' https://api.example.invalid/api/// ', 'https://api.example.invalid/api'],
        ['http://127.0.0.1:4000/api/', 'http://127.0.0.1:4000/api'],
        ['https://api.example.invalid/inventario/api/v1/', 'https://api.example.invalid/inventario/api/v1'],
        ['https://api.example.invalid/', 'https://api.example.invalid'],
        ['HTTPS://API.EXAMPLE.INVALID:443/api', 'https://api.example.invalid/api']
    ]) assert.equal(resolverApiUrl(entrada), salida);
});

test('API rechaza formatos inválidos, secretos en URL y valores explícitamente vacíos sin filtrarlos al error', async () => {
    const { resolverApiUrl } = await configuracion;
    for (const valor of ['', ' ', null, true, [], {}, '/api', '//example.invalid/api', 'ftp://example.invalid/api',
        'localhost:3000/api', 'https://', 'https://example.invalid:99999/api',
        'https://cuenta:secreto-simulado@example.invalid/api', 'https://example.invalid/api?token=secreto-simulado',
        'https://example.invalid/api#fragmento', 'https://example.invalid/api?', 'https://example.invalid/api#',
        'https://example.invalid/mi ruta', 'https:\\example.invalid/api', 'https://@example.invalid/api', 'https://*.invalid/api']) {
        assert.throws(() => resolverApiUrl(valor), error => error.message.includes('VITE_API_URL') && !error.message.includes('secreto-simulado'));
    }
});

test('CORS predeterminado permite solo localhost:5173 y la lista personalizada lo reemplaza', () => {
    assert.deepEqual(resolverOrigenes(undefined), ['http://localhost:5173']);
    assert.deepEqual(resolverOrigenes('https://app.example.invalid, https://admin.example.invalid'),
        ['https://app.example.invalid', 'https://admin.example.invalid']);
    assert.deepEqual(resolverOrigenes('https://APP.example.invalid:443,https://app.example.invalid'), ['https://app.example.invalid']);
    assert.ok(Object.isFrozen(resolverOrigenes(undefined)));
});

test('CORS rechaza comodines, rutas, listas incompletas, tipos inválidos y credenciales', () => {
    for (const valor of ['', ' ', null, true, [], '*', 'null', 'https://*.example.invalid', 'https://app.example.invalid/',
        'https://app.example.invalid/ruta', 'https://app.example.invalid/ruta/..', 'https://app.example.invalid/../', 'https://app.example.invalid?x=1',
        'https://app.example.invalid#', 'https://user:secreto-simulado@app.example.invalid',
        'https://app.example.invalid,', ',https://app.example.invalid', 'http://localhost:5173,,https://app.example.invalid',
        'file:///ruta', 'https://', 'https://app.example.invalid:65536', 'https://app.example.invalid\\ruta']) {
        assert.throws(() => resolverOrigenes(valor), error => error.message.includes('CORS_ORIGINS') && !error.message.includes('secreto-simulado'));
    }
});

test('CORS compara orígenes completos sin reflejar prefijos, subdominios ni puertos distintos', () => {
    const opciones = crearOpcionesCors('https://app.example.invalid');
    for (const [origen, esperado] of [
        ['https://app.example.invalid', true], ['http://app.example.invalid', false],
        ['https://app.example.invalid:444', false], ['https://app.example.invalid.evil.invalid', false],
        ['https://sub.app.example.invalid', false], ['http://localhost:5173', false], ['null', false], [undefined, false]
    ]) opciones.origin(origen, (error, permitido) => { assert.equal(error, null); assert.equal(permitido, esperado); });
});

function peticion(opciones, origen, method = 'OPTIONS') {
    const cabeceras = {}, resultado = { siguiente: false, terminado: false, statusCode: 200 };
    const res = { setHeader:(k,v)=>{cabeceras[k.toLowerCase()] = v;}, getHeader:k=>cabeceras[k.toLowerCase()],
        end:()=>{resultado.terminado=true;}, get statusCode(){return resultado.statusCode;}, set statusCode(v){resultado.statusCode=v;} };
    cors(opciones)({method,headers:{origin:origen,'access-control-request-method':'PATCH','access-control-request-headers':'authorization,content-type'}},res,
        error=>{assert.ifError(error);resultado.siguiente=true;});
    return { ...resultado, cabeceras };
}

test('middleware real conserva preflight Authorization y no habilita credenciales ni orígenes ajenos', () => {
    const opciones = crearOpcionesCors(undefined);
    const permitido = peticion(opciones, 'http://localhost:5173');
    assert.equal(permitido.statusCode, 204);
    assert.equal(permitido.cabeceras['access-control-allow-origin'], 'http://localhost:5173');
    assert.match(permitido.cabeceras['access-control-allow-headers'], /authorization/);
    assert.equal(permitido.cabeceras['access-control-allow-credentials'], undefined);
    for (const origen of ['https://otro.example.invalid', undefined, 'null']) {
        const r = peticion(opciones, origen, 'GET');
        assert.equal(r.siguiente, true);
        assert.equal(r.cabeceras['access-control-allow-origin'], undefined);
    }
});
