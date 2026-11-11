// Independent structural contract, manually checked against the approved six-table DDL.
// No fixtures, driver, dotenv or executable SQL.
const columna = (nombre, tipo, nullable = false, defecto = null) => ({ nombre, tipo, nullable, defecto,
    auto: nombre === 'id', charset: /^(varchar|text)/.test(tipo) ? 'utf8mb4' : null,
    collation: /^(varchar|text)/.test(tipo) ? 'utf8mb4_unicode_ci' : null });
const id = () => columna('id', 'int unsigned');
const fkId = nombre => columna(nombre, 'int unsigned');
const fecha = nombre => columna(nombre, 'datetime', false, { clase: 'timestamp', valor: '0' });
const texto = valor => ({ clase: 'texto', valor });
const numero = valor => ({ clase: 'numero', valor });
const indice = (nombre, columnas, unico = false) => ({ nombre, columnas, unico, tipo: 'BTREE' });
const fk = (nombre, campo, tabla) => ({ nombre, campo, tabla, columna: 'id', actualizacion: 'RESTRICT', borrado: 'RESTRICT', local: true });
const tabla = (nombre, columnas, indices = [], foraneas = []) => ({ nombre, motor: 'InnoDB', charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci', columnas, indices: [indice('PRIMARY', ['id'], true), ...indices], foraneas });
const stock = nombre => columna(nombre, 'decimal(10,2)', false, numero('0'));

module.exports = [
    tabla('categorias', [id(), columna('nombre', 'varchar(100)'), columna('descripcion', 'varchar(255)', true)],
        [indice('uk_categorias_nombre', ['nombre'], true)]),
    tabla('usuarios', [id(), columna('nombre', 'varchar(100)'), columna('email', 'varchar(150)'),
        columna('contrasena', 'varchar(255)'), columna('rol', 'varchar(30)', false, texto('Dueño')),
        columna('activo', 'tinyint', false, numero('1')), fecha('fecha_creacion')],
        [indice('uk_usuarios_email', ['email'], true)]),
    tabla('productos', [id(), columna('codigo', 'varchar(50)'), columna('nombre', 'varchar(150)'),
        columna('descripcion', 'text', true), columna('marca', 'varchar(100)', true), fkId('categoria_id'),
        stock('precio_compra'), stock('precio_venta'), stock('stock_minimo'),
        columna('estado', 'varchar(20)', false, texto('activo')), fecha('fecha_creacion'), fecha('fecha_actualizacion')],
        [indice('uk_productos_codigo', ['codigo'], true), indice('idx_productos_categoria', ['categoria_id'])],
        [fk('fk_productos_categoria', 'categoria_id', 'categorias')]),
    tabla('lotes', [id(), fkId('producto_id'), columna('codigo_lote', 'varchar(100)', true),
        columna('fecha_vencimiento', 'date', true), stock('stock_actual'), columna('estado', 'varchar(20)', false, texto('activo'))],
        [indice('idx_lotes_producto', ['producto_id'])], [fk('fk_lotes_producto', 'producto_id', 'productos')]),
    tabla('movimientos_stock', [id(), fkId('producto_id'), columna('usuario_id', 'int unsigned', true),
        columna('tipo', 'varchar(20)'), columna('cantidad', 'decimal(10,2)'), columna('motivo', 'varchar(100)'),
        columna('observacion', 'varchar(255)', true), fecha('fecha')],
        [indice('idx_movimientos_producto', ['producto_id']), indice('idx_movimientos_usuario', ['usuario_id'])],
        [fk('fk_movimientos_producto', 'producto_id', 'productos'), fk('fk_movimientos_usuario', 'usuario_id', 'usuarios')]),
    tabla('movimientos_lotes', [id(), fkId('movimiento_id'), fkId('lote_id'), columna('cantidad', 'decimal(10,2)')],
        [indice('idx_movimientos_lotes_movimiento', ['movimiento_id']), indice('idx_movimientos_lotes_lote', ['lote_id'])],
        [fk('fk_movimientos_lotes_movimiento', 'movimiento_id', 'movimientos_stock'), fk('fk_movimientos_lotes_lote', 'lote_id', 'lotes')])
];
