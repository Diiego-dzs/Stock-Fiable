const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');

const camposPublicos = 'id, nombre, email, rol, activo, fecha_creacion';
function errorUsuario(mensaje, status = 400) {
    return Object.assign(new Error(mensaje), { status });
}
function validarUsuario(datos, crear = false) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw errorUsuario('Datos de usuario inválidos');
    const { nombre, email, rol, activo } = datos;
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) throw errorUsuario('El nombre es obligatorio y admite hasta 100 caracteres');
    if (typeof email !== 'string' || email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw errorUsuario('El correo no es válido');
    if (!ROLES.includes(rol)) throw errorUsuario('El rol seleccionado no existe en el catálogo autorizado');
    if (typeof activo !== 'boolean') throw errorUsuario('El estado activo debe ser verdadero o falso');
    if (crear && (typeof datos.contrasena !== 'string' || datos.contrasena.length < 8 || Buffer.byteLength(datos.contrasena, 'utf8') > 72)) throw errorUsuario('La contraseña debe tener al menos 8 caracteres y hasta 72 bytes');
    return { nombre: nombre.trim(), email: email.trim().toLowerCase(), rol, activo };
}
function validarCambio(usuarios, actorId, id, datos) {
    const actor = usuarios.find(u => Number(u.id) === Number(actorId));
    if (!actor || !actor.activo || actor.rol !== 'Dueño') throw errorUsuario('No tienes permisos para administrar usuarios', 403);
    if (!ROLES.includes(datos.rol)) throw errorUsuario('El rol seleccionado no existe en el catálogo autorizado');
    if (id == null) return;
    const actual = usuarios.find(u => Number(u.id) === id);
    if (!actual) throw errorUsuario('Usuario no encontrado', 404);
    if (id === Number(actorId) && (!datos.activo || datos.rol !== 'Dueño')) throw errorUsuario('No podés desactivar tu cuenta ni quitarte el acceso administrativo');
    if (actual.activo && actual.rol === 'Dueño' && (!datos.activo || datos.rol !== 'Dueño') && usuarios.filter(u => u.activo && u.rol === 'Dueño').length <= 1) throw errorUsuario('Debe permanecer al menos un Dueño activo');
}

async function obtenerUsuarioAutenticado(id) {
    if (!Number.isInteger(id) || id <= 0) return null;
    const usuarios = await pool.query(`SELECT ${camposPublicos} FROM usuarios WHERE id = ? LIMIT 1`, [id]);
    return usuarios[0] || null;
}
async function listarUsuarios(filtros = {}) {
    const condiciones = [], params = [];
    if (filtros.busqueda) {
        if (typeof filtros.busqueda !== 'string' || filtros.busqueda.length > 150) throw errorUsuario('Búsqueda inválida');
        condiciones.push("(nombre LIKE ? ESCAPE '=' OR email LIKE ? ESCAPE '=')");
        const texto = `%${filtros.busqueda.trim().replace(/[=%_]/g, v => '=' + v)}%`;
        params.push(texto, texto);
    }
    if (filtros.rol) {
        if (!ROLES.includes(filtros.rol)) throw errorUsuario('Rol inválido');
        condiciones.push('rol = ?'); params.push(filtros.rol);
    }
    if (filtros.activo !== undefined && filtros.activo !== '') {
        if (!['0', '1'].includes(filtros.activo)) throw errorUsuario('Estado inválido');
        condiciones.push('activo = ?'); params.push(Number(filtros.activo));
    }
    return pool.query(`SELECT ${camposPublicos} FROM usuarios ${condiciones.length ? 'WHERE ' + condiciones.join(' AND ') : ''} ORDER BY nombre, id`, params);
}
async function obtenerRoles() {
    return [...ROLES];
}
async function guardarUsuario(actorId, id, datos) {
    const crear = id == null;
    if (!crear && (!Number.isInteger(id) || id <= 0)) throw errorUsuario('ID de usuario inválido');
    const validado = validarUsuario(datos, crear);
    // Hash outside the transaction to keep the lock short. Passwords are never selected or returned.
    const hash = crear ? await bcrypt.hash(datos.contrasena, 12) : null;
    let conexion;
    try {
        conexion = await pool.getConnection();
        await conexion.beginTransaction();
        // All administration operations lock accounts in the same order, including concurrent changes.
        const usuarios = await conexion.query(`SELECT ${camposPublicos} FROM usuarios ORDER BY id FOR UPDATE`);
        validarCambio(usuarios, actorId, id, validado);
        if (crear) {
            const resultado = await conexion.query('INSERT INTO usuarios (nombre, email, contrasena, rol, activo) VALUES (?, ?, ?, ?, ?)', [validado.nombre, validado.email, hash, validado.rol, Number(validado.activo)]);
            id = Number(resultado.insertId);
        } else {
            await conexion.query('UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ? WHERE id = ?', [validado.nombre, validado.email, validado.rol, Number(validado.activo), id]);
        }
        const resultado = await conexion.query(`SELECT ${camposPublicos} FROM usuarios WHERE id = ?`, [id]);
        await conexion.commit();
        return resultado[0];
    } catch (error) {
        if (conexion) await conexion.rollback();
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) throw errorUsuario('Ya existe una cuenta con ese correo', 409);
        throw error;
    } finally {
        if (conexion) conexion.release();
    }
}
module.exports = { listarUsuarios, obtenerRoles, obtenerUsuarioAutenticado, guardarUsuario, validarUsuario, validarCambio };
