export function puedeRegistrarMovimientos(rol) {
  return rol === 'Dueño' || rol === 'Empleado';
}
export const descripcionesRoles = {
  Dueño: 'Acceso completo y administración de usuarios.',
  Empleado: 'Consultas y registro de entradas y salidas. Puede crear un lote dentro de una entrada.',
  Consulta: 'Solo lectura de inventario, historial, alertas, reportes y exportaciones.'
};
