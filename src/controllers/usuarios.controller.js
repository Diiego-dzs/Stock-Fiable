const service = require('../services/usuarios.service');
function responderError(res, error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo completar la operación de usuarios' });
}
async function listar(req, res) {
    try { res.json(await service.listarUsuarios(req.query)); }
    catch (error) { responderError(res, error); }
}
async function roles(req, res) {
    try { res.json(await service.obtenerRoles()); }
    catch (error) { responderError(res, error); }
}
async function crear(req, res) {
    try { res.status(201).json({ mensaje: 'Usuario creado correctamente', usuario: await service.guardarUsuario(req.usuario.id, null, req.body) }); }
    catch (error) { responderError(res, error); }
}
async function editar(req, res) {
    try { res.json({ mensaje: 'Usuario actualizado correctamente', usuario: await service.guardarUsuario(req.usuario.id, Number(req.params.id), req.body) }); }
    catch (error) { responderError(res, error); }
}
module.exports = { listar, roles, crear, editar };
