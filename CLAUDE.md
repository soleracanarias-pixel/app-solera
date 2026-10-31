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
Backend: `backend/Code.gs` se publica en el proyecto de Apps Script 10WOhx5Egs-LIBxwB0I2Y3omVTityZeJhcYBEHCuS564jE2oLFyBw-gsK
(fichero `Código`), en la implementación existente AKfycbxon542bV7Jt6RAfU7SZgfVZoNnHs9OipjbzVr7Rpu0RUT3QJWRr6KS_grmkNE64ELp
(la de config.js), nunca en una nueva. Dos formas:
- clasp (necesita que Mateo inicie sesión): `clasp clone <id>`, copiar Code.gs a Código.js, `clasp push --force`,
  `clasp create-version "<desc>"`, `clasp update-deployment <deploymentId> -V <n>`.
- A mano: pegar, guardar e Implementar → Gestionar implementaciones → ✎ → Versión nueva (nunca "Nueva implementación").
En cada publicación, subir a la vez `VERSION_WEB` (index.html) y `VERSION_SERVIDOR` (Code.gs) al nº de la versión nueva de Apps Script
(la app lo enseña abajo y avisa "actualiza la app" si no coinciden).
Si cambia ESQUEMA, las pestañas y columnas nuevas se crean solas en la primera llamada; `instalar` solo hace falta
para rellenar roles y rehacer las fórmulas de STOCK.
