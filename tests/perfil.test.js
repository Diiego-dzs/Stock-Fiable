const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
let cuenta = { id: 1, nombre: 'Cuenta', email: 'cuenta@example.test', rol: 'Dueño', activo: 1, contrasena: 'hash-que-no-debe-devolverse' };
require.cache[require.resolve('../src/config/db')] = { exports: { query: async () => cuenta ? [cuenta] : [] } };

test('perfil autenticado devuelve estado real sin contraseñas ni hashes', async t => {
  const anterior = process.env.JWT_SECRET; process.env.JWT_SECRET = 'secreto-aislado-pruebas-perfil';
  const app = express(); app.use('/api/auth', require('../src/routes/auth.routes'));
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
  const url = `http://127.0.0.1:${server.address().port}/api/auth/me`;
  const token = jwt.sign({ id: 1, rol: 'Dueño' }, process.env.JWT_SECRET);
  const consultar = () => fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await fetch(url)).status, 401);
  for (const rol of ['Dueño', 'Empleado', 'Consulta']) {
    cuenta.rol = rol;
    const res = await consultar(); assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
    const { usuario } = await res.json(); assert.equal(usuario.rol, rol);
    assert.deepEqual(Object.keys(usuario).sort(), ['activo', 'email', 'id', 'nombre', 'rol']);
  }
  cuenta.activo = 0; assert.equal((await consultar()).status, 401);
  cuenta = null; assert.equal((await consultar()).status, 401);
});
