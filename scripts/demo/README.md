# Instalación de demostración — Fase A

Estos comandos locales preparan exclusivamente una base de demostración nueva.
**`instalar.js` fue validado exitosamente contra MariaDB 11.4.9 en un contenedor
temporal; `primer-dueno.js` todavía no fue validado en una terminal interactiva real.**
No constituyen un instalador de producción. Ejecutarlos requiere autorización explícita y validar previamente
el destino. No crean bases, cuentas del motor ni endpoints públicos.

Estas herramientas son opcionales para la exposición. La aplicación existente
utilizará sus usuarios funcionales de Dueño, Empleado y Consulta: no se migran,
reinicializan ni modifican esas cuentas. No es necesario ejecutar el bootstrap
ni el controlador interactivo para utilizar la aplicación ya preparada.

## Requisitos y configuración separada

Instalar las dependencias existentes de la raíz. Un administrador debe preparar
previamente una base vacía llamada exactamente `stock_fiable_demo`, en un servidor
local de demostración, con un usuario MariaDB exclusivo. No reutilizar la base ni
las credenciales habituales del proyecto. Los comandos no crean esa base ni el
usuario del motor. La preparación en contenedor desechable fue comprobada; la
instalación completa desde cero fuera de ese entorno sigue pendiente.

Proporcionar al proceso, mediante un mecanismo local seguro, estas variables:

| Variable | Finalidad |
| --- | --- |
| `DEMO_DB_HOST` | Solo se admite `127.0.0.1`, `localhost` o `::1`. |
| `DEMO_DB_PORT` | Puerto explícito del servidor de demostración. |
| `DEMO_DB_NAME` | Debe ser exactamente `stock_fiable_demo`. |
| `DEMO_DB_USER` | Usuario exclusivo para instalar y usar esta demostración. |
| `DEMO_DB_PASSWORD` | Contraseña de conexión; no utilizar argumentos ni commits. |

No se leen archivos `.env`, variables `DB_*` ni configuración de la aplicación.
No se guarda configuración ni credenciales en archivos. El directorio de scripts
y `tests/integracion/fixtures/schema.js` deben estar disponibles: de ese módulo se
importa solamente el arreglo `tablas`, no se ejecuta `prepararSchema()` ni se usan
fixtures. Las seis tablas conservan tipos, relaciones e índices aprobados,
InnoDB y utf8mb4. No se importan dumps.

La restricción de nombre y host previene errores, pero no demuestra por sí sola
que el servidor local sea ajeno a producción: el operador debe verificar puerto,
propiedad y permisos antes de autorizar. No usar estas herramientas si una base
real comparte ese nombre. Los clientes del sistema deben permanecer detenidos
durante el bootstrap.

## 1. Instalar el esquema y categorías ficticias

Desde la raíz, solo después de la autorización:

```sh
node scripts/demo/instalar.js --autorizar-demo --confirmar-base stock_fiable_demo
```

Verifica la base conectada y obtiene un bloqueo consultivo compartido por ambos
comandos. Rechaza bases con tablas o vistas existentes. Crea las seis tablas y
carga tres categorías ficticias en una transacción, sin asignar IDs manualmente.
No crea productos, lotes, movimientos ni usuarios de aplicación.

El DDL de MariaDB puede confirmar cambios implícitamente. Un fallo puede dejar
tablas creadas: se informa instalación posiblemente incompleta y cuántas tablas
fueron confirmadas. No se borra nada ni se intenta reparar automáticamente; el
siguiente intento rechazará la base no vacía. Una revisión manual autorizada
debe resolver cualquier instalación parcial antes de continuar.

## 2. Crear el primer Dueño

```sh
node scripts/demo/primer-dueno.js --autorizar-demo --confirmar-base stock_fiable_demo
```

Exige una terminal interactiva, las seis tablas esperadas y `usuarios` vacía.
Solicita nombre, correo y contraseña con confirmación; las dos entradas de
contraseña se ocultan. No admite parámetros de contraseña ni entrada por tubería.
Aplica las reglas existentes de nombre, correo y contraseña (mínimo ocho caracteres,
máximo 72 bytes UTF-8) y normaliza nombre/correo. El rol es siempre Dueño y la cuenta
queda activa. El hash se calcula con bcrypt, costo 12. No se imprimen hashes,
contraseñas ni datos de la cuenta.

El mismo bloqueo consultivo serializa las dos herramientas, y se vuelve a exigir
usuarios vacíos dentro de la transacción antes del INSERT. La segunda ejecución
rechaza cualquier cuenta existente. Esto no impide escrituras de otros clientes
que no respeten ese bloqueo: mantener la aplicación detenida y restringir accesos
durante la instalación. No existe una contraseña inicial pública ni predeterminada.

Se cierran conexiones y se intenta liberar el bloqueo incluso ante errores. Los
errores del driver se omiten para evitar exponer parámetros. Ante un fallo de
comunicación al confirmar una transacción, el resultado puede ser incierto: no
reintentar sin revisar primero la base autorizada. No hay eliminación ni UPDATE
de registros. JavaScript no garantiza borrado físico inmediato de secretos de memoria.

## Verificaciones y límites actuales

La validación real parcial de Fase B terminó con código 0 en 22,67 segundos:

- `instalar.js` creó las seis tablas y las categorías iniciales.
- Un comparador independiente verificó columnas, tipos, defaults, índices,
  claves foráneas, InnoDB, charset y collation contra MariaDB 11.4.9 temporal.
- Se comprobaron exactamente las tres categorías ficticias previstas y usuarios vacíos.
- Una segunda instalación fue rechazada sin modificar el esquema ni los datos.
- Se cerraron las conexiones y se eliminó el contenedor propio, verificando su identidad.

Las pruebas `tests/bootstrap-demo.test.js` usan exclusivamente adaptadores falsos:
no requieren Docker, no cargan dotenv y no conectan a MariaDB. Forman parte de
`npm test`. No verifican todavía el comportamiento del motor, permisos DDL,
contención real, ni el ocultamiento de contraseña en una terminal real Windows/Linux.

La creación del primer Dueño y el ocultamiento del prompt siguen pendientes de
validación interactiva real; el controlador opcional solo tiene pruebas simuladas.
Antes de considerar reproducible toda la instalación deberá autorizarse esa prueba
en una base desechable nueva. Después se deberá validar login,
alta de producto, entrada con lote, salida FEFO, reportes y permisos, utilizando
únicamente datos ficticios. Iniciar frontend/backend requiere su configuración
habitual, que estos comandos no modifican; comprobar que apunte a la demostración
y respetar API/CORS locales según el README principal.
