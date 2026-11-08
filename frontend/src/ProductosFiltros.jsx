import { FILTROS_PRODUCTOS_INICIALES } from './productos.utils.js';

export default function ProductosFiltros({ filtros, onChange, categorias, cantidad, total }) {
  const cambiar = (campo, valor) => onChange(actual => ({ ...actual, [campo]: valor }));
  return <div className="productos-filtros">
    <div className="productos-filtros-controles" role="search" aria-label="Buscar y filtrar productos">
      <label>Nombre o código<input type="search" value={filtros.busqueda} onChange={e => cambiar('busqueda', e.target.value)} placeholder="Buscar producto" /></label>
      <label>Categoría<select value={filtros.categoria_id} onChange={e => cambiar('categoria_id', e.target.value)}>
        <option value="">Todas las categorías</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select></label>
      <label>Estado del producto<select value={filtros.estado} onChange={e => cambiar('estado', e.target.value)}>
        <option value="">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
      </select></label>
      <label>Estado del stock<select value={filtros.stock} onChange={e => cambiar('stock', e.target.value)}>
        <option value="">Todos</option><option value="normal">Normal</option><option value="bajo">Bajo</option><option value="sin-stock">Sin stock</option>
      </select></label>
      <label>Ordenar por<select value={filtros.orden} onChange={e => cambiar('orden', e.target.value)}>
        <option value="nombre-asc">Nombre A–Z</option><option value="nombre-desc">Nombre Z–A</option>
        <option value="codigo-asc">Código A–Z</option><option value="codigo-desc">Código Z–A</option>
        <option value="stock-asc">Stock: menor a mayor</option><option value="stock-desc">Stock: mayor a menor</option>
      </select></label>
      <button type="button" onClick={() => onChange({ ...FILTROS_PRODUCTOS_INICIALES })}>Limpiar filtros</button>
    </div>
    <p aria-live="polite" aria-atomic="true">{cantidad} de {total} productos</p>
  </div>;
}
