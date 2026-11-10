const MAX_CENTESIMAS = 9999999999n;
const errorMovimiento = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status });

function centesimas(valor, interno = false) {
    const invalido = () => errorMovimiento(interno ? 'Stock almacenado incompatible con DECIMAL(10,2)' : 'La cantidad debe ser positiva, con hasta dos decimales y no superar 99999999.99', interno ? 500 : 400);
    if (!['number', 'string'].includes(typeof valor) || (typeof valor === 'number' && !Number.isFinite(valor))) throw invalido();
    const texto = typeof valor === 'string' ? valor.trim() : String(valor);
    if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(texto)) throw invalido();
    const [entero, decimal = ''] = texto.split('.');
    const cantidad = BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0'));
    if (cantidad > MAX_CENTESIMAS || (!interno && cantidad === 0n)) throw invalido();
    return cantidad;
}
function decimalSQL(valor) {
    return `${valor / 100n}.${String(valor % 100n).padStart(2, '0')}`;
}
function validarId(valor, campo) {
    if ((typeof valor !== 'number' || !Number.isSafeInteger(valor)) && (typeof valor !== 'string' || !/^[1-9]\d{0,9}$/.test(valor))) throw errorMovimiento(`El ${campo} debe ser un identificador entero positivo`);
    const numero = Number(valor);
    if (numero < 1 || numero > 4294967295) throw errorMovimiento(`El ${campo} está fuera de rango`);
    return numero;
}
function validarMovimiento(datos, entrada) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw errorMovimiento('Datos de movimiento inválidos');
    const producto_id = validarId(datos.producto_id, 'producto_id');
    const cantidad = centesimas(datos.cantidad);
    if (typeof datos.motivo !== 'string' || !datos.motivo.trim() || datos.motivo.trim().length > 100) throw errorMovimiento('El motivo es obligatorio y admite hasta 100 caracteres');
    if (datos.observacion != null && (typeof datos.observacion !== 'string' || datos.observacion.length > 255)) throw errorMovimiento('La observación debe ser texto de hasta 255 caracteres');
    const usuario_id = datos.usuario_id == null ? null : validarId(datos.usuario_id, 'usuario_id');
    let lote_id;
    if (entrada) {
        if (datos.nuevo_lote !== undefined) {
            if (datos.lote_id !== undefined) throw errorMovimiento('Elegí lote_id o nuevo_lote, no ambos');
        } else lote_id = validarId(datos.lote_id, 'lote_id');
    } else if (datos.lote_id !== undefined || datos.nuevo_lote !== undefined) throw errorMovimiento('Las salidas seleccionan los lotes por FEFO');
    return { ...datos, producto_id, usuario_id, lote_id, cantidad, motivo: datos.motivo.trim(), observacion: datos.observacion?.trim() || null };
}
module.exports = { MAX_CENTESIMAS, errorMovimiento, centesimas, decimalSQL, validarId, validarMovimiento };
