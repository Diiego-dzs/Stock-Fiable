export default function ProductoFormulario({ valores, onChange, categorias, editando, guardando, onSubmit, onCancelar, sinCambios }) {
  const campo = (nombre, valor) => onChange(actual => ({ ...actual, [nombre]: valor }));
  return <section className="stock-panel producto-formulario" aria-busy={guardando}>
    <h2>{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
    <form className="stock-form" onSubmit={onSubmit}>
      {[['codigo', 'Código', 50], ['nombre', 'Nombre', 150], ...(!editando ? [['marca', 'Marca', 100]] : [])].map(([nombre, etiqueta, max]) => <label key={nombre}>{etiqueta}<input disabled={guardando} maxLength={max} required={nombre !== 'marca'} value={valores[nombre]} onChange={e => campo(nombre, e.target.value)} /></label>)}
      <label className="stock-form-ancho">Descripción<textarea disabled={guardando} rows="3" maxLength="16000" value={valores.descripcion} onChange={e => campo('descripcion', e.target.value)} /></label>
      <label>Categoría<select disabled={guardando} required value={valores.categoria_id} onChange={e => campo('categoria_id', e.target.value)}><option value="">Seleccionar categoría</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      {[...(!editando ? [['precio_compra', 'Precio de compra'], ['precio_venta', 'Precio de venta']] : []), ['stock_minimo', 'Stock mínimo']].map(([nombre, etiqueta]) => <label key={nombre}>{etiqueta}<input disabled={guardando} type="number" min="0" max="99999999.99" step={nombre === 'stock_minimo' ? '1' : '0.01'} required value={valores[nombre]} onChange={e => campo(nombre, e.target.value)} /></label>)}
      {editando && <p className="stock-ayuda stock-form-ancho">El nombre y el código actualizados también se mostrarán en las consultas de movimientos anteriores. Esta edición no cambia cantidades ni lotes.</p>}
      <button className="stock-primario" disabled={guardando || sinCambios}>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}</button>
      <button type="button" className="producto-cancelar" disabled={guardando} onClick={onCancelar}>Cancelar</button>
    </form>
  </section>;
}
