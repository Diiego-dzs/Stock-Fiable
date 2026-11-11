# Verificador de esquema de demostración

`verificar-esquema-demo.js` exporta `verificarEsquema(conexion)` y
`compararMetadatos(meta)`. No es un instalador ni abre conexiones. Importarlo no
carga dotenv, credenciales, pools ni servicios. La referencia estructural explícita
está en `demo-esquema.esperado.js`, separada del instalador y de las fixtures.

Solo ejecuta cuatro SELECT sobre `information_schema` de la base seleccionada.
El llamador debe verificar previamente identidad del contenedor, base y puerto,
y cerrar su conexión en `finally`. El verificador no prueba la identidad del destino,
no lee filas de aplicación y no comprueba categorías ni usuarios iniciales.

## Comandos previstos

Pruebas simuladas sin conexión:

```sh
node --test tests/verificador-esquema-demo.test.js
```

Para una futura validación real autorizada, el ejecutor aislado podrá importar:

```js
const { verificarEsquema } = require('./tests/helpers/verificar-esquema-demo');
// conexion debe pertenecer al contenedor temporal previamente identificado.
const resultado = await verificarEsquema(conexion);
if (!resultado.valido) {
    console.error(JSON.stringify(resultado.diferencias));
    throw new Error('Esquema no compatible');
}
```

No hay un comando autónomo de conexión, para evitar conexiones accidentales.
No imprimir la conexión, sus opciones, metadatos crudos ni errores originales del
driver. El adaptador devuelve errores genéricos sin incorporar el error del driver.

## Comparaciones

- Exige las seis tablas y el orden de columnas del contrato aprobado.
- Conserva precisión/escala decimal, UNSIGNED, nulabilidad, longitudes y atributos.
- Ignora únicamente anchos de visualización de INT/TINYINT y normaliza DATETIME(0).
- Distingue null/NULL de metadatos (NULL SQL) del literal entre comillas `'NULL'`.
- Normaliza defaults numéricos con cadenas y BigInt, sin tolerancias ni redondeo.
- Mantiene caso y espacios de defaults textuales; normaliza CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP() y CURRENT_TIMESTAMP(0), sin ignorar precisión distinta.
- Exige PK, índices UNIQUE/secundarios, columnas ordenadas, BTREE sin prefijos
  ni orden descendente y relaciones con la misma base y reglas RESTRICT.
- Exige InnoDB, charset y collation de tablas y columnas textuales.

Los diagnósticos contienen únicamente tabla, objeto, propiedad, esperado y obtenido.
Los defaults textuales desconocidos se omiten del diagnóstico aunque se comparan
íntegramente en memoria. No se imprime información de usuarios, secretos ni entorno.

## Límites

El verificador aprobó la comparación estructural contra MariaDB 11.4.9 en un
contenedor temporal durante la validación parcial de Fase B. Se comprobaron las
seis tablas, columnas, tipos, defaults, índices, claves foráneas, motor, charset
y collation. Esa ejecución también comprobó las categorías y usuarios vacíos
mediante verificaciones separadas, fuera del alcance de este módulo.

Conserva pruebas con metadatos simulados para equivalencias y diferencias reales.
El resultado no certifica otras versiones o configuraciones del motor. Cada nueva
ejecución real requiere autorización explícita. El contrato manual debe mantenerse
sincronizado con cualquier cambio aprobado de esquema.
No verifica permisos del usuario del motor, triggers, rutinas, datos, contadores
AUTO_INCREMENT ni el comportamiento transaccional o del login. No certifica una
instalación de producción ni sustituye comprobar las categorías y primer Dueño.
