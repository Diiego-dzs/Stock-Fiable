# Infraestructura MariaDB aislada — Fase 1

**Esta fase prepara archivos; no autoriza ejecutar el contenedor.** No ejecutar el
script de integración hasta recibir autorización específica. `npm test` continúa
ejecutando solamente las pruebas existentes con mocks, sin Docker.

## Requisitos para una ejecución futura

- Node 24 y dependencias existentes instaladas.
- Docker con contenedores Linux, accesible en el contexto local `default`.
- Sin `DOCKER_HOST`, `DOCKER_CONTEXT`, `DOCKER_TLS_VERIFY` ni `DOCKER_CERT_PATH`.
- Permiso posterior para descargar/iniciar la imagen y crear datos sintéticos.

Imagen oficial: `docker.io/library/mariadb:11.4.9`.
Digest verificado mediante el endpoint de manifiestos del registro oficial:
`sha256:54ac814d243128263e18cf818f7abb611bf43a7a95ce8aa102d18f527b1516d1`.
La referencia utilizada combina versión y digest; no utiliza `latest`.

## Comando futuro, sujeto a autorización

```sh
npm run test:integracion -- --ejecutar
```

Sin `--ejecutar`, el proceso termina antes de invocar Docker. No admite parámetros
de host, puerto, usuario, contraseña, imagen o base externos. Importar los módulos
o ejecutar `node --check` no abre conexiones ni inicia Docker.

## Aislamiento y ciclo de vida

1. Se verifica el contexto `default`: solo socket Unix local estándar o named pipe
   local de Docker Desktop. Otros sockets/contextos se rechazan deliberadamente.
2. Se generan nombre/base/hostname/etiqueta únicos y contraseñas aleatorias en memoria.
3. Se descarga la imagen fijada y se crea un contenedor propio, sin bind mounts ni
   volúmenes persistentes: `/var/lib/mysql` utiliza tmpfs de 512 MiB.
4. El puerto 3306 se publica en un puerto dinámico exclusivamente de `127.0.0.1`.
5. Se inicia el contenedor y se espera `healthcheck.sh --connect --innodb_initialized`,
   con plazo máximo. No se permite crear el pool antes de un estado saludable.
6. Antes de cada adquisición de conexión se verifica ID, etiqueta, imagen,
   hostname, almacenamiento, salud y puerto mediante `docker inspect`.
7. La primera consulta de cada conexión verifica `DATABASE()` y `@@hostname`.
   Las escrituras se permiten únicamente después de confirmar la identidad.
8. Se crean seis tablas en una base vacía. Una base con tablas preexistentes se
   rechaza sin borrar nada. Se cargan categoría, usuario, producto y lote sintéticos;
   el lote comienza con stock cero y no se fabrican movimientos históricos.
9. Se inyecta el pool real en `require.cache` antes de importar servicios. No se
   ejecutan `src/config/db.js` ni dotenv. Se requiere proceso exclusivo: no compartir
   el bootstrap con las pruebas unitarias ni importar previamente los servicios.
10. Se cierran conexiones y pool y se retira la inyección. Finalmente se detiene y
    elimina solo el contenedor cuyo ID completo y etiquetas se vuelven a verificar.
    No se ejecutan limpiezas globales, `prune`, eliminación de bases ni de volúmenes.

El usuario `sf_test` pertenece exclusivamente a la base generada. El administrador
de la imagen se usa solo durante su inicialización; no se usa como usuario del pool.
Las contraseñas no se escriben en archivos ni se incluyen en argumentos de comandos
o logs. Docker conserva su configuración de entorno mientras exista el contenedor;
quien controle el daemon puede inspeccionarla. Son credenciales sintéticas efímeras.

## Esquema

`fixtures/schema.js` reproduce columnas, nulabilidad, defaults, PK autoincrementales,
claves únicas, índices y FK aprobados para `categorias`, `usuarios`, `productos`,
`lotes`, `movimientos_stock` y `movimientos_lotes`. Usa InnoDB, utf8mb4 y
utf8mb4_unicode_ci. No agrega CHECK, ENUM, índices compuestos o cascadas.
Los contadores autoincrementales parten de una base nueva, no de los valores del dump.
No se lee ni importa SQL histórico. El hash de la cuenta sintética se genera desde
una contraseña aleatoria desechada; no representa una credencial real ni sirve para
probar login de producción.

## API del helper y siguientes fases

`crearEntorno()` recibe una capacidad de verificación del ejecutor y devuelve:
`preparar`, `conConexion`, `transaccion`, `inyectarServicios`, `pool` y `cerrar`.
El pool inyectado conserva consultas reales; no simula resultados de MariaDB.
Las transacciones de servicios siguen bajo control de los servicios. No envolverlas
en una transacción externa esperando revertir conexiones independientes.

En Fase 1 el comando futuro solo prepara y destruye la infraestructura; **no hay
todavía pruebas reales de concurrencia ni afirmación de éxito de esas pruebas**.
La matriz de precisión, rollback, concurrencia, timeouts y deadlocks se incorporará
en una fase posterior. No se modificó el workflow CI actual.

## Fallos y limpieza

SIGINT/SIGTERM solicitan cancelación y el bloque `finally` intenta cerrar recursos.
Se comprueba cancelación después de crear y antes de inspeccionar, iniciar,
conectar y preparar; también entre consultas del esquema. La limpieza conserva
inspecciones propias aunque se haya cancelado el trabajo. No se interrumpen de
forma instantánea comandos o consultas que ya estén en curso.

Si `create` falla sin devolver ID, se busca únicamente el nombre completo aleatorio
generado por esa ejecución. Debe existir exactamente un candidato: se comprueban
ID completo, nombre exacto, etiqueta de propiedad, hostname e imagen con digest.
Antes de detener y de eliminar se vuelve a comprobar la identidad por ID. Ante
ambigüedad o imposibilidad de verificar se solicita revisión manual sin borrar.

El helper registra adquisiciones pendientes y vuelve a comprobar cierre/cancelación
después de cada espera antes de entregar conexiones. `cerrar()` comparte una única
promesa, espera adquisiciones y liberaciones asíncronas y finalmente cierra el pool.
Los errores de liberación se registran y se propagan; si además había un error
principal, este se conserva y los fallos secundarios quedan en `erroresLimpieza`.
El ejecutor informa etapa, identificador sintético y necesidad de revisión manual,
sin imprimir errores originales, secretos ni salida completa de Docker.

La ejecución consulta configuración local Docker y hereda el entorno del proceso
para invocar su CLI. No lee `.env`, no usa variables `DB_*` y no construye conexiones
con credenciales del proyecto. Solo transmite al contenedor las cuatro variables
`MARIADB_*` sintéticas que genera para la ejecución.

Si Docker deja de responder, el proceso es terminado a la fuerza, o el daemon
termina de crear el contenedor después de una recuperación fallida, puede quedar
un recurso temporal. El ejecutor falla y nunca intenta borrar recursos que no pueda identificar.
No se garantiza limpieza frente a SIGKILL, caída del host o pérdida del daemon.
Una recuperación manual requiere identificar el nombre `sf_it_*`, la etiqueta
`stock-fiable.integration` y el ID; no debe utilizarse limpieza global.

El contexto Docker local y el host se consideran confiables: estas comprobaciones
previenen errores accidentales, no defienden contra un administrador malicioso.

## Pruebas unitarias simuladas del ciclo de vida

```sh
node --test tests/integracion/ciclo-vida.test.js
```

Son pruebas con adaptadores Docker y pools falsos: no invocan Docker, no importan
la configuración de conexión habitual y no conectan a MariaDB. No ejecutar el
script `test:integracion` para verificarlas. Permanecen separadas de `npm test`.
