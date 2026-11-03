export function agruparAlertas(stock, vencimientos, dias) {
  return {
    sinStock: stock.filter(p => p.alerta === 'SIN_STOCK'),
    stockBajo: stock.filter(p => p.alerta === 'STOCK_BAJO'),
    proximos: vencimientos.filter(l => Number(l.dias_restantes) >= 0 && Number(l.dias_restantes) <= dias),
    vencidos: vencimientos.filter(l => l.alerta === 'VENCIDO')
  };
}

export function fechaVencimiento(valor) {
  // Preserve the calendar date sent by MariaDB, without a browser timezone shift.
  const fecha = String(valor || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha.split('-').reverse().join('/') : '-';
}
