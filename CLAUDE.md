# APP SOLERA — reglas para Claude

La app está EN PRUEBAS. Hasta que Mateo diga lo contrario:

- **No tocar los Excel, CSV, hojas ni carpetas activos de SOLERA** (DATOS PARTES LEIDOS 2026, zonero,
  control de proveedores, precios_proveedores, certificaciones, etc.). Solo se pueden LEER.
- Solo se escribe en: la hoja "APP SOLERA", el código de este repositorio y la carpeta de Drive
  `CLIENTES\PARTES\APP` (lo que crea la propia app).
- Los datos de la app no se mezclan con los reales: el CSV de la app (`PARTES APP 2026.csv`) está
  desactivado (`CARPETA_CSV_ID` vacío en CONFIG) y, cuando se active, va a la carpeta APP, nunca al maestro.
- Los códigos de obra de Mercadona son los del ZONERO (nº de tienda).
- **Los partes son una cosa y el almacén otra.** El parte es lo que se cobra al cliente (como una factura):
  sus materiales NO tocan el almacén. El almacén (Entrada, Salida a obra, Devolución de obra) es solo
  control de stock interno. No volver a ligarlos.
- Borrar datos o ficheros: solo con permiso explícito de Mateo.

Pendientes: ver `PENDIENTES.md`.

## Mapa de ficheros
- `index.html`: solo el HTML de las pantallas (más un `<script>` pequeño en la cabecera: MODO_ALMACEN y manifest). Carga
  `config.js`, luego **por este orden** `js/base.js`, `js/parte.js`, `js/almacen.js`, `js/inventario.js`, `js/herramientas.js`,
  `js/admin.js` y al final `arrancar()`. Son scripts normales que comparten el ámbito global: un fichero solo puede usar AL CARGAR
  lo de los anteriores (dentro de funciones, cualquier cosa). `npm test` (tests/web.test.js) lo comprueba, y también que no haya
  nombres repetidos, nada sin declarar ni funciones huérfanas.
- `css/app.css`: todos los estilos.
- `js/base.js`: CFG, `VERSION_WEB`, `$`, IndexedDB (`DB`), estado `S`, toast/preguntar, iconos (`ico`), API, login, dueño del móvil
  y huella, permisos (rolActual, puede…), cambiar de pantalla, listas y buscador, fotos, "Preparar para ir sin cobertura", la cola
  (sincronizar, banda amarilla, Enviados, Me he equivocado), aviso de versión nueva y `arrancar()`.
- `js/parte.js`: parte de trabajo (trabajadores, materiales, firmantes, firma, guardar).
- `js/almacen.js`: vales (ME LLEVO, DEVUELVO, ENCONTRÉ, COMPRA, TRASPASO), Ver stock, lector y códigos de barras (EAN).
- `js/inventario.js`: inventario como evento (contar, entregar, abrir, revisar y cerrar).
- `js/herramientas.js`: reparaciones, pegatinas, andamios y ¿Dónde queda una máquina?
- `js/admin.js`: pestaña Vales (buscar, completar, revisar, anular) y Resumen. Deja `window.SOLERA_TEST` para las pruebas.
- `sw.js`: caché para abrir sin cobertura. **Si se añade un fichero, meterlo en FICHEROS y subir CACHE.** El aviso de versión
  nueva compara index.html, css/app.css y js/*.js (`FICHEROS_APP` en base.js).
- `backend/Code.gs`: servidor (Apps Script).
- `tests/`: `npm test` (correr.js) → `servidor.test.js` (stock de todos los tipos y anulación, permisos, numeración, inventario,
  disparadores y copia), `qr.test.js` (pegatinas) y `web.test.js` (estructura del front). `arnes.js`: los dobles y una app de prueba.
Backend: `backend/Code.gs` se publica en el proyecto de Apps Script 10WOhx5Egs-LIBxwB0I2Y3omVTityZeJhcYBEHCuS564jE2oLFyBw-gsK
(fichero `Código`), en la implementación existente AKfycbxon542bV7Jt6RAfU7SZgfVZoNnHs9OipjbzVr7Rpu0RUT3QJWRr6KS_grmkNE64ELp
(la de config.js), nunca en una nueva. Dos formas:
- clasp (necesita que Mateo inicie sesión): `clasp clone <id>`, copiar Code.gs a Código.js, `clasp push --force`,
  `clasp create-version "<desc>"`, `clasp update-deployment <deploymentId> -V <n>`.
- A mano: pegar, guardar e Implementar → Gestionar implementaciones → ✎ → Versión nueva (nunca "Nueva implementación").
**Antes de publicar, `npm install` (la primera vez) y `npm test`: tiene que salir "0 mal".** Las pruebas (`tests/`) cargan
`backend/Code.gs` con dobles en memoria (`tests/arnes.js`: hojas, Drive, correo, HtmlService, propiedades, lock, disparadores y
Utilities), nunca con la hoja real; y comprueban la estructura de `js/*.js` y el QR de las pegatinas (jsqr). Si se cambia algo del
stock, los permisos, la numeración o el inventario, añadir su prueba en `tests/servidor.test.js`.
En cada publicación, subir a la vez `VERSION_WEB` (index.html) y `VERSION_SERVIDOR` (Code.gs) al nº de la versión nueva de Apps Script
(la app lo enseña abajo y avisa "actualiza la app" si no coinciden).
Si cambia ESQUEMA, las pestañas y columnas nuevas se crean solas en la primera llamada; `instalar` solo hace falta
para rellenar roles y rehacer las fórmulas de STOCK.
