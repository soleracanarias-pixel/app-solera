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
Backend: `backend/Code.gs` se pega a mano en Apps Script y se publica con
Implementar → Gestionar implementaciones → ✎ → Versión nueva (nunca "Nueva implementación").
