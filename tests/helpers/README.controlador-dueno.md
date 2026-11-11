# Validación interactiva del primer Dueño en MariaDB desechable

**Herramienta preparada, aún sin ejecución real. Requiere autorización explícita.**
Es opcional y no es un requisito para ejecutar la aplicación existente ni para
la exposición. Se utilizarán los usuarios funcionales existentes de Dueño, Empleado
y Consulta; no se migran, reinicializan ni modifican esas cuentas. El controlador
todavía no fue ejecutado en una terminal real y no es necesario hacerlo para la entrega.

No modifica instaladores, autenticación ni la configuración habitual. Sus pruebas
simuladas forman parte de `npm test` y no ejecutan Docker ni SQL real.

## Preparación humana

Abrir una terminal integrada **PowerShell** de VS Code en la raíz del repositorio.
No usar el panel Salida, redirecciones, tuberías, grabadores ni transcripciones.
El controlador no habilita transcripciones y no puede detectar todas las grabaciones
externas. Usar únicamente nombre/correo ficticios y una contraseña desechable nueva.

Comprobar rama y estado con `git status` y verificar que los archivos sean los
revisados. Node 24, dependencias existentes y Docker Desktop con motor Linux deben
estar disponibles. Docker debe ser accesible mediante el PATH de esa terminal;
su ubicación depende de la instalación local. No se prescribe una ruta de cuenta
Windows ni se modifica el PATH permanente. Desde la raíz del proyecto, comprobar:

```powershell
node -e "console.log({entradaInteractiva:!!process.stdin.isTTY,salidaInteractiva:!!process.stdout.isTTY})"
```

Ambos valores deben ser `true`. La comprobación TTY es necesaria, pero el ocultamiento
real del prompt de VS Code/Windows todavía requiere validación manual.

## Comando futuro autorizado

```powershell
node tests/helpers/controlador-dueno-demo.js --ejecutar
```

Sin argumento exacto y TTY real, se detiene antes de invocar Docker. No acepta
contraseñas de Dueño por argumentos, archivos, entorno ni entrada redirigida.

## Pasos automáticos

1. Rechazar variables Docker de redirección; inspeccionar contexto `default`, socket
   local estándar y motor Linux. No cambiar el contexto activo.
2. Obtener MariaDB 11.4.9 con el digest aprobado; crear nombre/hostname/etiqueta
   únicos, credenciales de conexión sintéticas en memoria y base `stock_fiable_demo`.
3. Usar tmpfs de 512 MiB y puerto dinámico solo en `127.0.0.1`, sin bind mounts ni
   volúmenes persistentes. Verificar ID completo, nombre, hostname, etiqueta e imagen.
4. Esperar salud y verificar puerto antes de cada conexión/control de proceso hijo.
   Cada conexión de diagnóstico verifica `DATABASE()` y `@@hostname`.
5. Ejecutar `instalar.js`, comprobar esquema con el verificador independiente,
   categorías exactas y usuarios vacíos. Cerrar cada conexión de diagnóstico.
6. Ejecutar el CLI original `primer-dueno.js` heredando directamente la terminal:
   el controlador no conecta una tubería, captura ni registra su contraseña.

Las variables `DEMO_DB_*` solo se proporcionan a los hijos temporales. Se eliminan
de ese entorno configuraciones DB/MARIADB/DEMO previas y precargas Node. La contraseña
en `DEMO_DB_PASSWORD` es **solo de conexión a MariaDB**, no la del Dueño.
No se lee `.env`, ni se utilizan dumps o bases existentes.

## Intervención humana

Responder a nombre y correo con identidad ficticia. Introducir la contraseña
únicamente en el prompt oculto original y repetirla en su confirmación. No compartirla
en chat ni pegarla en comandos o variables. Cancelar con Ctrl+C si aparece el texto
de la contraseña o si se detecta cualquier problema. La autenticación no se modifica.

El proceso interactivo tiene un límite de diez minutos; el instalador, de un minuto.
Ante cancelación se solicita terminar al hijo y se espera su cierre antes de limpiar.
Al cerrar el hijo interactivo se intenta restaurar el modo raw previo de la terminal.

## Comprobaciones finales y limpieza

Después del CLI se exige exactamente un Dueño activo y un hash bcrypt con costo 12.
El hash se examina en memoria y nunca se imprime. Luego se prueba el rechazo de la
**función original exportada `crearDueno`**, no se vuelve a pedir la contraseña al
usuario ni se lanza un segundo CLI. Se usa un marcador ficticio válido, sin crear
credenciales: el rechazo debe ocurrir antes de hash e INSERT. Un callback de prueba
impide calcular un hash si esa guarda no funciona. Se exige el mensaje de rechazo
esperado y se compara la cuenta antes/después íntegramente en memoria.

En `finally` se cierran conexiones y se detiene/elimina únicamente el contenedor
propio, reinspeccionando ID y marcas de identidad antes de cada acción. Se confirma
ausencia mediante la etiqueta exacta de ejecución. No se eliminan imágenes ni se
usa `prune`. Si no se puede demostrar identidad o completar limpieza, se informa el
identificador sintético para revisión manual, sin eliminar recursos ambiguos.

Los diagnósticos no incluyen errores originales, credenciales ni hashes. El hijo
original muestra sus prompts y los datos ficticios que la persona escribe en campos
no secretos; no introducir datos personales reales. No se crean archivos de registro.

## Límites pendientes

El host y daemon local deben ser confiables. El contexto local no protege contra
un administrador malicioso. Cancelar no interrumpe instantáneamente comandos o
conexiones ya en curso. SIGKILL, cierre abrupto de terminal/host o caída del daemon
pueden impedir la limpieza; un create que termine tardíamente podría dejar un
recurso que requiere revisión manual. No repetir sin revisar la ejecución anterior.
El controlador no valida login ni toda la demostración y no prueba el segundo CLI
completo: comprueba su guarda original de inicialización contra la base real aislada.
La validación previa del instalador y del esquema en MariaDB temporal no equivale
a haber ejecutado este controlador ni a validar la creación interactiva del Dueño.
