# APP SOLERA — pendientes

Cosas pedidas que todavía NO se han hecho. Se borran de aquí cuando estén hechas.

## App
- **Quitar las horas extra del parte.** Solo horas en bruto (una casilla de horas por trabajador).
  Las extras las calcula la oficina; el parte es para el cliente. Afecta a la pantalla del parte,
  al PDF (columna "Extra"), a PARTES_LINEAS (horas_extra) y al CSV. *(Pedido 30/10/2026, esperar OK para hacerlo.)*
- **A la vez: elegir la categoría de cada trabajador en el parte (PEÓN / OFICIAL).** Depende del día o del
  trabajo: a veces un peón hace de oficial y al revés. Por defecto, la de la hoja TRABAJADORES. Es solo para
  el cliente (PDF y facturación), NO cuenta para nóminas ni cambia TRABAJADORES. *(Pedido 30/10/2026, esperar OK.)*
- Publicado hasta herramientas con averías, reparador y OK (versión 15, 31/10/2026). Pendiente: permisos propios para encargado (hoy = trabajador + Ver stock).
- Compras: estado PENDIENTE_LEER (albaranes que se meten sin líneas para leerlos después); hoy todo CONFIRMADA.
- Probar la huella en los móviles reales (si da error, la app enseña el motivo: pasárselo a Claude).
- Foto para reconocer el material (propuesta; decidir con Fable si se hace y con qué servicio).
- Herramientas: de momento se numeran con ROTULADOR (Edding 750 / uni PX-20) al hacer la foto.
  Más adelante: pegatinas con QR (rotuladora Brother con cinta TZe-S o imprenta), PDF de pegatinas
  desde HERRAMIENTAS (el 📷 de Herramientas ya lee el código de la máquina en QR).
- **Meter material desde la foto de una factura o albarán: NO en la app del móvil.** Es para Mateo o Gregorio,
  como algo aparte (de momento, pasándole la foto a Claude; más adelante, quizá una app de escritorio
  ligada al sistema). *(30/10/2026)*

- **Hacer el primer inventario** de cada almacén (Mateo lo abre y reparte categorías). Probar antes el escáner en un Android y un iPhone.
- Códigos de barras: se dan de alta al escanear (los artículos de proveedor no traen EAN).
- Rellenar en REPARADORES el teléfono y el correo de Bernabé.

## Hoja APP SOLERA (lo hace Mateo)
- Categoría del trabajador 22, Jesús Enrique Herrera.
- Rellenar `stock_min` en MATERIALES para que salten los avisos de stock.

## Al acabar las pruebas
- Activar el CSV: poner en CONFIG `CARPETA_CSV_ID` = `1Zjj8Guqk55MsSyEYoxnNd75mlfTr-Hhe` (carpeta CLIENTES\PARTES\APP).
- Revisar los artículos de proveedor de `MATERIALES APP.csv` (algunos cruces no son exactos).
