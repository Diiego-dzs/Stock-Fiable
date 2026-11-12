# Stock Fiable v1.0

Stock Fiable es un sistema de gestión de inventario con productos, lotes,
entradas y salidas, alertas y reportes. Incluye autenticación y permisos por rol.
Las salidas distribuyen las cantidades entre lotes mediante la lógica FEFO
(primero en vencer, primero en salir) implementada en el sistema.

Esta versión fue validada funcionalmente y cuenta con pruebas automatizadas.
Está configurada para desarrollo local: **no se presenta como una instalación
lista para producción**. La instalación completa desde cero en otra computadora
todavía debe verificarse, incluida la preparación de la base y del primer Dueño.

## Tecnologías utilizadas

- React 19 y Vite 8 para la interfaz.
- Node.js y Express 5 para la API.
- MariaDB para persistencia y transacciones de inventario.
- JWT para autenticación y bcryptjs para contraseñas.
- Generación de CSV y Excel mediante las utilidades del proyecto y `write-excel-file`.
- Pruebas con el ejecutor nativo de Node.js y análisis estático con Oxlint.
- GitHub Actions para verificaciones de integración continua.

## Requisitos del sistema

- Git.
- Node.js 24.x y npm, versión de Node utilizada en CI.
- Una instancia MariaDB y una base exclusiva para la aplicación, con su esquema
  compatible y un usuario con los permisos necesarios.
- Un navegador moderno.
- Para pruebas reales aisladas: Docker Desktop con motor Linux y CLI accesible
  desde el proceso de Node. Docker no es necesario para la suite habitual.

MariaDB 11.4.9 fue utilizada en el entorno de integración aislado. Esto no
representa una certificación de compatibilidad con todas las versiones del motor.

## Instalación de dependencias

Clonar el repositorio e instalar las dependencias desde sus archivos de bloqueo:

```sh
git clone https://github.com/Diiego-dzs/Stock-Fiable.git
cd Stock-Fiable
npm ci
cd frontend
npm ci
cd ..
```

Se requieren ambas instalaciones, también para pruebas de la raíz que utilizan
herramientas del frontend. No configurar `NODE_ENV=production` para ejecutar las
verificaciones de desarrollo. En PowerShell, si `npm.ps1` está bloqueado, utilizar
`npm.cmd` en lugar de `npm`.

## Variables de entorno

El backend carga su configuración mediante dotenv. Preparar un archivo `.env`
local en la raíz, sin versionarlo ni compartir sus valores. Las variables usadas son:

| Variable | Finalidad |
| --- | --- |
| `DB_HOST` | Dirección del servidor MariaDB de la aplicación. |
| `DB_PORT` | Puerto de MariaDB. |
| `DB_USER` | Usuario de conexión a la base. |
| `DB_PASSWORD` | Contraseña de ese usuario. |
| `DB_NAME` | Nombre de la base destinada a Stock Fiable. |
| `JWT_SECRET` | Secreto privado para firmar y verificar tokens. |
| `PORT` | Puerto HTTP del backend; si se omite, se utiliza 3000. |
| `CORS_ORIGINS` | Orígenes HTTP/HTTPS autorizados, separados por comas; si se omite, solo `http://localhost:5173`. |

No reutilizar secretos de otras instalaciones ni incluir credenciales reales en
documentación, capturas, fixtures o commits. La raíz incluye `.env.example`, sin
credenciales y con secretos vacíos, como referencia de nombres y configuración local.
No copiarlo sobre un `.env` existente ni reemplazar las credenciales que ya funcionan.

El frontend admite `VITE_API_URL`, documentada en `frontend/.env.example`. Si no
se define, utiliza `http://localhost:3000/api`. Debe ser una URL absoluta HTTP/HTTPS
sin credenciales, consulta ni fragmento. Se eliminan barras finales sin quitar
la ruta `/api`; por ejemplo, `https://api.example.invalid/api/` se convierte en
`https://api.example.invalid/api`. Una variable definida pero vacía o inválida
produce un error de configuración; no se sustituye silenciosamente por localhost.

**Las variables `VITE_*` son públicas y se incorporan a la compilación.** No colocar
contraseñas, tokens ni `JWT_SECRET` en ellas. Cambiar `VITE_API_URL` requiere reiniciar
Vite en desarrollo o volver a compilar la interfaz para una entrega estática.

## Preparación de MariaDB

La aplicación utiliza las tablas `categorias`, `usuarios`, `productos`, `lotes`,
`movimientos_stock` y `movimientos_lotes`. Las relaciones, índices y tipos de
cantidades deben ser compatibles con los servicios; las cantidades almacenadas
utilizan `DECIMAL(10,2)`.

**No existe todavía un procedimiento documentado y verificado de instalación
inicial de la base ni de creación del primer usuario Dueño.** La administración
de usuarios requiere una cuenta Dueño autenticada y no resuelve ese primer acceso.
No se proporciona una contraseña inicial ni una cuenta predeterminada.

Antes de una demostración en otra computadora se debe preparar y validar, de
forma controlada, una base nueva con el esquema compatible, categorías y una
cuenta Dueño cuya contraseña esté protegida con bcrypt. Ese procedimiento sigue
pendiente; los comandos de ejecución siguientes presuponen una base ya preparada.

No importar dumps históricos como mecanismo de instalación o demostración:
pueden contener datos personales o información sensible. El esquema y las
fixtures de `tests/integracion` pertenecen exclusivamente al entorno temporal
de pruebas; **no son un instalador ni una base de demostración persistente**.

## Ejecución del backend y frontend

Con dependencias, configuración y base preparadas, abrir dos terminales.

En la raíz, iniciar la API:

```sh
npm start
```

En otra terminal, iniciar la interfaz:

```sh
cd frontend
npm run dev
```

La configuración actual utiliza:

- API predeterminada: `http://localhost:3000/api`, centralizada en `frontend/src/configuracion.js`.
- CORS predeterminado: `http://localhost:5173`, configurado mediante `src/config/cors.js`.
- Backend: puerto 3000 por defecto.

Utilizar el origen local permitido. Si Vite ocupa otro puerto, se cambia `PORT`,
se accede desde otra computadora o se utiliza otro dominio, la configuración
no se adapta automáticamente. Configurar `VITE_API_URL` en el entorno del frontend
y `CORS_ORIGINS` en el backend según corresponda; cambiar solo `PORT` no actualiza
las otras dos opciones. Sin definir las nuevas variables se conserva el uso local.

### Preparación para un futuro dominio privado

Esta etapa agrega configuración, pruebas y ejemplos: **no se ha desplegado ningún
servicio ni se han abierto puertos**. La exposición sigue siendo local y utiliza
los usuarios existentes, sin migrarlos ni modificar su autenticación o permisos.

Para un futuro entorno autorizado, los nombres de ejemplo siguientes ilustran la
configuración; no representan servicios existentes:

```text
Frontend: VITE_API_URL=https://api.example.invalid/api
Backend:  CORS_ORIGINS=https://app.example.invalid
```

`CORS_ORIGINS` acepta una lista explícita, por ejemplo
`https://app.example.invalid,https://admin.example.invalid`. Solo indicar orígenes
(esquema, host y puerto cuando corresponda), sin barra final ni rutas. Se rechazan
comodines, credenciales, consultas, fragmentos, elementos vacíos y valores inválidos.
Los orígenes se canonicalizan como URLs; la comprobación de cada solicitud es exacta,
sin coincidencias parciales o por subdominio. Una lista personalizada **reemplaza**
el valor local: localhost no se agrega automáticamente. Reiniciar el backend después
de cambiarla. No es necesario modificar CORS para la exposición local actual.

CORS controla el acceso de navegadores a las respuestas; no reemplaza JWT ni hace
privada la API. Las peticiones sin Origin conservan las validaciones habituales del
backend. No se habilitan cookies ni se cambia el envío de tokens Bearer.

Antes de conectar la aplicación a Internet se requiere HTTPS para interfaz y API,
una base online independiente con usuario y secretos propios, permisos mínimos y
una revisión específica de proxy, acceso privado, protección de login y respaldos.
No apuntar el servidor online a la base local ni reutilizar automáticamente cuentas,
credenciales o dumps históricos. No utilizar Vite de desarrollo para publicar la
aplicación. La parametrización actual no certifica que esté lista para producción.

Para generar la interfaz compilada:

```sh
cd frontend
npm run build
```

`npm run preview`, desde `frontend`, permite previsualizar esa compilación, pero
su origen puede diferir del permitido por CORS. No constituye un despliegue de
producción ni garantiza acceso a la API con la configuración actual.

## Roles y permisos

| Funcionalidad | Dueño | Empleado | Consulta |
| --- | --- | --- | --- |
| Consultar Panel, productos, lotes e historial | Sí | Sí | Sí |
| Consultar alertas, reportes y exportaciones | Sí | Sí | Sí |
| Registrar entradas y salidas | Sí | Sí | No |
| Crear lote dentro de una entrada | Sí | Sí | No |
| Crear, editar, activar o desactivar productos | Sí | No | No |
| Crear lotes de forma independiente | Sí | No | No |
| Administrar usuarios y roles | Sí | No | No |

Los permisos se verifican en el backend, además de limitar las acciones de la
interfaz. Las peticiones autenticadas comprueban el estado y rol vigentes de la
cuenta; la interfaz sincroniza la sesión y sus permisos. Las cuentas desactivadas
no pueden operar. La administración protege el acceso del propio Dueño y la
permanencia del último Dueño activo.

## Funcionalidades principales

- Panel con siete indicadores, distribución de stock, últimos cinco movimientos,
  prioridades de reposición y vencimientos.
- Alta y edición de productos; activación y desactivación sin eliminar existencias,
  lotes ni historial.
- Búsqueda por nombre o código, filtros combinados por categoría, estado y stock,
  seis ordenamientos y contador de resultados.
- Gestión de lotes y creación de un lote durante una entrada, en la misma transacción.
- Entradas y salidas con stock validado, bloqueos de filas y distribución FEFO.
  Los productos inactivos no admiten movimientos ni nuevos lotes independientes.
- Interfaz de movimientos con cantidades enteras; los servicios admiten cantidades
  válidas con hasta dos decimales y calculan en centésimas exactas.
- Alertas de stock bajo, sin stock, lotes próximos a vencer y vencidos, con ventanas
  de 7, 15 y 30 días. Se conservan los vencimientos de existencias inactivas.
- Reportes de stock, movimientos y vencimientos; exportaciones CSV y Excel que
  respetan filtros y contemplan la paginación, con protección frente a fórmulas.
- Usuarios y roles, autenticación, recuperación de sesión y navegación responsive.

## Pruebas automatizadas

### Suite habitual y calidad

Con dependencias de raíz y frontend instaladas:

```sh
npm test
cd frontend
npm run lint
npm run build
cd ..
git diff --check
```

La suite habitual (`tests/*.test.js`) utiliza mocks y no requiere Docker ni una
conexión a MariaDB real. Las últimas verificaciones locales aprobaron 99 pruebas,
lint, build y comprobación de diferencias.

GitHub Actions se ejecuta en Pull Requests hacia `main` y en pushes a `main`, con
Ubuntu 24.04 y Node 24.x. Instala ambos proyectos con `npm ci`, ejecuta `npm test`,
lint, build y comprueba que no cambien archivos versionados. **El CI actual no
ejecuta las pruebas de integración reales ni las pruebas simuladas anidadas.**

### Pruebas simuladas de la infraestructura

Desde la raíz, sin Docker ni acceso a MariaDB:

```sh
node --test tests/integracion/ciclo-vida.test.js tests/integracion/precision.simulada.test.js
```

Las últimas verificaciones aprobaron 15 pruebas simuladas, que cubren ciclo de
vida, cancelación, cierre, inyección de fallos y comparación decimal exacta.

### Integración real con MariaDB aislada

**Requiere Docker y autorización explícita para cada ejecución.** No se ejecuta
como parte de `npm test`. Consultar primero la
[guía de integración](tests/integracion/README.md) para los requisitos y el aislamiento.

Comando verificado en PowerShell, desde la raíz:

```powershell
npm.cmd run test:integracion -- --ejecutar
```

El ejecutor selecciona explícitamente el contexto Docker `default`, obtiene una
imagen oficial fijada por digest, crea credenciales y datos sintéticos, usa
almacenamiento efímero y publica un puerto dinámico solo en `127.0.0.1`. No utiliza
`.env`, credenciales de la aplicación ni dumps históricos. Verifica la identidad
antes de conectarse y antes de retirar su contenedor.

La primera ejecución real de infraestructura fue exitosa. Posteriormente,
**los nueve escenarios reales de Fase 2A aprobaron**: precisión decimal, cantidades
pequeñas sucesivas, límites de `DECIMAL(10,2)`, FEFO e integridad del rollback ante
fallos controlados. La ejecución terminó con código 0 en 57,27 segundos y se
verificó el cierre de conexiones y la retirada del contenedor.

Estos resultados no validan concurrencia real, deadlocks ni caídas del servidor.

## Limitaciones conocidas y mejoras futuras

- Verificar la instalación completa desde cero en otra computadora.
- Preparar un procedimiento seguro y reproducible de creación de esquema,
  categorías iniciales y primer Dueño, sin datos históricos ni credenciales públicas.
- Probar operaciones simultáneas, deadlocks, tiempos de espera y caídas del motor
  en una base aislada.
- Evaluar incorporar la integración aislada al CI como etapa independiente.
- Validar la configuración parametrizada de API y CORS en el futuro entorno privado,
  manteniendo la exposición local independiente.
- Definir y verificar despliegue, HTTPS, gestión de secretos, respaldos y restauración
  antes de considerar un uso en producción.

## Colaboración mediante ramas y Pull Requests

1. Nunca trabajar directo en `main`.
2. Crear una rama por tarea: `feature/...`, `fix/...`, `docs/...`.
3. Subir la rama y abrir un Pull Request para que otro lo revise.

Ejecutar las verificaciones correspondientes al alcance del cambio y describir
sus resultados y limitaciones en el Pull Request. No incluir credenciales,
archivos `.env`, dumps con datos, respaldos ni archivos personales.
