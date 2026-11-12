const API_LOCAL = 'http://localhost:3000/api';

export function resolverApiUrl(valor) {
  if (valor === undefined) return API_LOCAL;
  const invalida = () => new Error('VITE_API_URL debe ser una URL absoluta HTTP/HTTPS, sin credenciales, consulta ni fragmento.');
  if (typeof valor !== 'string' || !valor.trim()) throw invalida();
  const texto = valor.trim();
  if (!/^https?:\/\//i.test(texto) || /[\\?#]/.test(texto) || [...texto].some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)) throw invalida();
  let url;
  try { url = new URL(texto); } catch { throw invalida(); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.hostname.includes('*') || url.username || url.password || texto.split('/')[2].includes('@')) throw invalida();
  return url.href.replace(/\/+$/, '');
}

// Vite injects this public value at build time. Optional access also permits pure Node tests.
export const API_URL = resolverApiUrl(import.meta.env?.VITE_API_URL);
