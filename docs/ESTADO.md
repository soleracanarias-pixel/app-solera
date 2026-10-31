# APP SOLERA — estado actual (31/10/2026)

Radiografía sacada del código del repositorio (`main`, commit `07569b5`) y de una lectura de la hoja
"APP SOLERA" hecha el 31/10/2026. La app está **EN PRUEBAS**: no toca ningún fichero activo de SOLERA.

---

## 1) FICHEROS

| Fichero | Qué hace |
|---|---|
| `index.html` | La app entera (HTML + CSS + JS en un solo fichero). Pantallas: entrar, Parte, Almacén, Herramientas y Enviados. Con `?modo=almacen` arranca en Almacén, oculta la pestaña Parte y la cabecera pone "SOLERA · ALMACÉN". Guarda datos en el móvil (IndexedDB: `cola`, `hist`, `kv`) y funciona sin cobertura. |
| `almacen/index.html` | App instalable **"SOLERA Almacén"**. Tiene su propia carpeta y ámbito para poder instalarse aparte; dentro carga `../index.html?modo=almacen` en un iframe (con permisos de cámara y de huella). |
| `almacen.html` | Dirección antigua: redirige a `almacen/`. |
| `config.js` | URL de la API (Apps Script `/exec`), TOKEN y `VERSION: '1.0'`. |
| `sw.js` | Service worker, caché `solera-v5`: primero la red (sin caché HTTP) y, si no hay red, la copia guardada. Cachea index, config, manifests, iconos y `almacen/`. |
| `manifest.json` | PWA "SOLERA Partes y Almacén": `id` y `scope` = `./index.html`, `start_url` = `./index.html`, iconos `icon-192/512.png`. |
| `manifest-almacen.json` | PWA "SOLERA Almacén": `id`, `scope` y `start_url` = `./almacen/`, iconos `icon-almacen-192/512.png`. |
| `icon-192.png`, `icon-512.png` | Icono de SOLERA. |
| `icon-almacen-192.png`, `icon-almacen-512.png` | Icono de SOLERA con la etiqueta "ALMACÉN". |
| `backend/Code.gs` | Backend de Google Apps Script (539 líneas). Se pega a mano en el editor de Apps Script de la hoja "APP SOLERA" y se publica como aplicación web. |
| `CLAUDE.md` | Reglas para Claude: app en pruebas, no tocar los ficheros activos de SOLERA, partes y almacén separados, códigos de obra Mercadona = zonero, cómo publicar. |
| `PENDIENTES.md` | Lista de cosas pedidas y aún no hechas. |
| `README.md` | Una línea de descripción. |
| `docs/ESTADO.md` | Este documento. |

---

## 2) PESTAÑAS DE LA HOJA "APP SOLERA"

`asegurarHojas_()` crea las pestañas que falten y añade al final las columnas que falten (versión de esquema `ESQUEMA = '8'`, guardada en las propiedades del script). Se ejecuta en cada llamada a la API (si el esquema cambió) y, forzada, en `instalar()`.

| Pestaña | Columnas exactas | Quién la escribe |
|---|---|---|
| **CONFIG** | `clave, valor` | A mano; el código actualiza los contadores. |
| **TRABAJADORES** | `codigo, nombre, categoria, pin, activo, encargado` | A mano. |
| **OBRAS** | `codigo, nombre, cliente, activa` | A mano. |
| **MATERIALES** | `codigo, nombre, unidad, stock_min, activo, orden, categoria` | A mano (`orden` = orden de las sugerencias, lo más usado primero). La hoja real tiene además `veces_partes` y `compras_2026` (informativas). |
| **PARTES** | `id, numero, fecha, obra_codigo, obra, cliente, creado_por, trabajadores, total_horas, trabajos, materiales, medios, observaciones, firmado, firmante, pdf_url, fotos, creado_en, origen, firmado_en, copia_enviada_a, copia_enviada_en, copia_error` | `crearParte_`. |
| **PARTES_LINEAS** | `id, numero, fecha, obra, trabajador_codigo, trabajador, categoria, horas, horas_extra, firmado` | `crearParte_`, una fila por trabajador. |
| **MOVIMIENTOS** (almacén de materiales) | `id, fecha, tipo, material_codigo, material, cantidad, unidad, obra, parte_numero, usuario, nota, creado_en, fotos, numero, hora, persona` | `movimiento_` con clase MAT. |
| **STOCK** | `codigo, nombre, unidad, entradas, salidas, stock, stock_min, aviso` | Fórmulas `ARRAYFORMULA` (las pone `instalar()` si está vacía). Entradas = ENTRADA + DEVOLUCION; salidas = SALIDA; `aviso` = "PEDIR" si `stock_min > 0` y `stock <= stock_min`. |
| **FIRMANTES** | `nombre, email, obra_ultima, veces, actualizado_en` | `guardarFirmante_` (libreta de firmantes para la copia por correo). |
| **POR_OBRA** | `obra, material_codigo, material, unidad, salido, devuelto, gastado` | `porObra_` (se rehace tras cada salida o devolución de material). |
| **HERR_TIPOS** | `prefijo, tipo, orden` | A mano. Hoy tiene 19 tipos: RAP, RAG, ALA, BAT, MAR, AND, RUB, AMA, MPI, VEN, TRO, FOC, TAL, ESC, COR, CAR, ATO, COM y LIJ. |
| **HERRAMIENTAS** | `codigo, tipo, activo, alta_fecha, alta_por` | `altaHerramienta_` (una fila por máquina: BAT-01…). |
| **HERR_MOV** | `id, fecha, tipo, herramienta_codigo, herramienta, cantidad, unidad, obra, usuario, nota, creado_en, fotos, numero, hora, persona` | `movimiento_` con clase HER. |
| **HERR_DONDE** | `codigo, herramienta, donde, quien, desde, ultimo_mov, foto` | `herrDonde_(true)`: se rehace tras cada movimiento de herramienta. |

- **No existe ninguna pestaña VALES.** El código no tiene vales.
- La hoja tiene además una pestaña **"Hoja 1"** vacía, que el código no usa.

**Claves de CONFIG que usa el código:**

| Clave | Para qué | Valor hoy en la hoja |
|---|---|---|
| `TOKEN` | Contraseña de la API (debe coincidir con `config.js`). | puesto |
| `CARPETA_PARTES_ID` | Carpeta de Drive `CLIENTES\PARTES\APP`, raíz de los PDF de los partes, `ALMACEN/<MES>` y `HERRAMIENTAS/<MES>`. | puesto |
| `SIGUIENTE_NUMERO` | Próximo nº de parte (empieza en 90001). | 90002 |
| `SIGUIENTE_MOV` | Próximo nº de movimiento de material (A0001…). | 3 |
| `SIGUIENTE_HERR` | Próximo nº de movimiento de herramienta (H0001…). Se crea solo la primera vez. | no existe aún |
| `CARPETA_CSV_ID` | Carpeta donde se rehace `PARTES APP 2026.csv`. **Vacío = CSV desactivado.** | vacío |
| `AVISOS_EMAIL` | Destinatario de los avisos de stock mínimo. | soleracanarias@gmail.com |
| `EMPRESA` | Texto de la cabecera del PDF del parte. | puesto |

**Propiedades del script:** `ESQUEMA` y `AVISO_STOCK_<codigo>` (SI/NO, para avisar solo una vez al cruzar el mínimo).

---

## 3) ACCIONES DE LA API

- **Entrada común:** `doPost` recibe JSON `{ action, token, … }`.
- **Antes de cada acción:** llama a `asegurarHojas_()` y comprueba el `token` (si no coincide: `{ ok:false, error:'Token incorrecto' }`).
- **Errores:** cualquier excepción devuelve `{ ok:false, error }`.
- **Bloqueo:** `crearParte` y `movimiento` esperan el bloqueo del script (30 s) para no pisarse.
- **`doGet`:** devuelve `{ ok:true, app:'APP SOLERA', hora }`.

| action | Recibe | Devuelve | ¿La usa la app? |
|---|---|---|---|
| `login` | `codigo, pin` | `{ ok, trabajador:{codigo, nombre, categoria, encargado} }` o error "Trabajador no encontrado" / "PIN incorrecto". El PIN se compara rellenando con ceros a 4 cifras. | Sí |
| `bootstrap` | — | `{ ok, trabajadores[{codigo,nombre,categoria}], obras[{codigo,nombre,cliente}], materiales[{codigo,nombre,unidad,stock_min}]` (ordenados por `orden`), `stock[{codigo,nombre,unidad,stock,stock_min}], herramientas[{codigo,tipo,nombre,donde,quien,desde,ultimo_mov,foto}], herrTipos[{prefijo,nombre}], firmantes[{nombre,email}]` (por nº de veces), `hora }`. Solo activos. | Sí ("Actualizar listas" y al arrancar) |
| `crearParte` | `parte:{id, fecha, obra, obraNombre, trabajadores[{codigo,nombre,categoria,horas,extra}], trabajos, materiales[{codigo,nombre,unidad,cantidad}], medios, observaciones, firma (dataURL), firmante, firmanteEmail, firmadoEn, fotos[dataURL], creadoPor, creadoEn}` | `{ ok, numero, pdf_url, copia_enviada_a, copia_error }`. Si el `id` ya existe: `{ ok, repetido:true, … }` con lo guardado. | Sí |
| `movimiento` | `mov:{id, clase:'MAT'|'HER', tipo:'ENTRADA'|'SALIDA'|'DEVOLUCION', material, materialNombre, cantidad, obra, nota, fotos[dataURL], fecha, hora, usuario, persona, tipoHer, codigoNuevo}` | `{ ok, numero, fotos[urls], herramienta, cambiado }`. Si el `id` ya existe: `{ ok, repetido:true, numero }`. | Sí |
| `stock` | — | `{ ok, stock }` (igual que en bootstrap). | No |
| `partes` | `limite` (por defecto 30) | `{ ok, partes[{numero,fecha,obra,total_horas,firmado,pdf_url,creado_por}] }`, el más reciente primero. | No |
| `movimientos` | `material` (código), `clase` | `{ ok, movimientos[{numero,hora,fecha,tipo,cantidad,unidad,obra,usuario,persona,nota,fotos[]}] }`: los 10 últimos de ese material o herramienta, el más reciente primero. | Sí (historial al tocar un material o una herramienta) |

**Qué hace `crearParte` además de guardar:**
- **PDF:** lo genera si hay `CARPETA_PARTES_ID` o correo de copia. Lo guarda en `<carpeta>/<MES>/` y una copia en `<MES>/<OBRA>/`; las fotos van en `<MES>/<OBRA>/FOTOS`.
- **PARTES y PARTES_LINEAS:** escribe una fila en PARTES y una por trabajador en PARTES_LINEAS.
- **Copia por correo:** si el parte va firmado y hay correo, lo manda por Gmail con el PDF y copia a soleracanarias@gmail.com. Anota el resultado o el error en PARTES.
- **Libreta de firmantes:** actualiza FIRMANTES.
- **CSV:** llama a `exportarCSV()`, que no hace nada mientras `CARPETA_CSV_ID` esté vacío.
- **Almacén:** **no toca el almacén.**

**Qué hace `movimiento` además de guardar:**
- **Número:** da A000n (materiales) o H000n (herramientas).
- **Fotos:** las sube a `<CARPETA_PARTES>/ALMACEN/<MES>/` o `/HERRAMIENTAS/<MES>/`, con el nombre "DD-MM-AAAA Nº TIPO MATERIAL COMENTARIO".
- **Material que no está en la lista:** lo guarda con código `OTRO`.
- **Herramientas:** en el alta, o si llega `tipoHer` sin código, crea la máquina con el `codigoNuevo` propuesto por el móvil. Si ese número ya existe, da el siguiente y devuelve `cambiado:true`.
- **Después:** materiales → `avisarStock_` y `porObra_`; herramientas → `herrDonde_(true)`.

**Funciones solo para el editor:**
- `instalar()`: crea las pestañas, rellena CONFIG si está vacía y pone las fórmulas de STOCK.
- `exportarCSV()`: rehace el CSV a mano.

---

## 4) PANTALLAS Y ROLES

**Roles: no hay.**
- Cualquier trabajador con `activo = SI` en TRABAJADORES puede entrar y hacerlo todo.
- La columna `encargado` se lee y se devuelve en `login`, pero la app no la usa para nada.
- `categoria` solo se usa en el parte (PDF y PARTES_LINEAS).
- La única diferencia es de app: **"SOLERA Almacén"** oculta la pestaña Parte. La app **SOLERA** enseña todas.

**Cabecera:**
- Nombre del usuario, estado "Conectado / Sin conexión" y botón **Salir**.
- Franja amarilla **"Hay una versión nueva · toca para actualizar"**: compara la página publicada al volver a la app y cada 10 minutos.

**Entrar:**
- Lista "¿Quién eres?" y teclado de PIN de 4 cifras. Si falla, el PIN se vacía.
- Botón "Actualizar listas".
- **Sin conexión:** deja entrar si ese usuario ya entró antes en ese móvil con el mismo PIN.
- **Dueño del móvil:** tras entrar, el móvil recuerda a su dueño y la pantalla sale con su nombre, con el enlace "¿No eres tú? Cambiar de persona".
- **Huella:** se ofrece activar la entrada con "huella, cara o PIN del móvil" (WebAuthn, solo en el móvil).
  - Con la huella activada, al abrir la app se pide sola; el PIN de la app queda como plan B.
  - Se puede quitar con "Quitar la huella en este móvil".
- **Sin huella:** mientras no se pulse Salir, la app abre directamente.

**Parte** (solo en la app SOLERA):
- **Cabecera del parte:** fecha (se ve como dd/mm/aaaa) y obra, que se escribe con sugerencias ("maj", "merc", nº de tienda).
- **Personal:** filas de trabajador (desplegable), horas y extra, con el total. El que crea el parte va el primero, con 8 h.
- **Trabajos realizados:** texto obligatorio.
- **Materiales usados:** se escriben con sugerencias (lo más usado primero) y cantidad. Lo que no está en la lista va como texto libre (código OTRO).
- **Medios / maquinaria / portes**, observaciones y **fotos** (cámara, varias, reducidas a 1280 px).
- **Conforme del cliente:**
  - Nombre del firmante, con autocompletado de la libreta.
  - "Correo para la copia", que se rellena solo si el firmante es conocido.
  - Firma en pantalla; guarda la hora de la firma.
- **Guardar parte:** si va sin firma, pide confirmación. El parte se guarda en el móvil y se envía cuando hay cobertura. La siguiente vez sale la última obra usada.

**Almacén:**
- **Botones arriba:** ⬇ Entrada · ⬆ Salida a obra · ↩ Devolución de obra.
- **El formulario se abre justo debajo**, con:
  - Fecha y hora del móvil.
  - Material, con sugerencias o texto libre.
  - Cantidad.
  - Obra (en salida y devolución).
  - "¿Quién se lo lleva? / ¿Quién lo devuelve?": por defecto quien anota; se puede elegir otro trabajador.
  - Comentario y fotos (opcionales).
- **📦 Ver stock (plegado):**
  - Buscador y stock por material: rojo si es negativo; "pedir" solo con mínimo puesto.
  - Al tocar un material: sus 10 últimos movimientos, con nº, fecha, hora, tipo, cantidad, obra, quién se lo lleva o lo devuelve, quién lo anotó, comentario y fotos.

**Herramientas** (en las dos apps; solo aparece si el servidor devuelve `herramientas`):
- **Botones:** ⬆ Llevar a obra · ↩ Devolver · ⬇ Alta en el almacén.
- **Siempre una a una** (sin cantidad) y **con foto obligatoria**.
- **Llevar a obra / Devolver:**
  - Se elige la máquina por su número (BAT-01 · BATIDORA) o "TIPO · sin número (se le da uno nuevo)".
  - Al devolver, la obra donde estaba sale puesta.
- **Alta:** se elige el tipo.
- **Máquina nueva** (alta o "sin número"): la app enseña en el momento **"Número para esta máquina: BAT-03 ✍️ Escríbelo con el rotulador en la máquina y haz la foto donde se vea"**.
- **🔧 ¿Dónde están las herramientas?** (plegado): cada máquina con 📍 obra o "En almacén", quién la tiene y desde cuándo. Al tocarla, su historial.

**Enviados:**
- **"Pendientes de enviar":** con el error si falló ("reintentar") y el botón "Enviar ahora".
- **Histórico** (los 50 últimos en ese móvil):
  - **Partes:** nº, obra, firmado o no, "copia enviada a …" o "copia no enviada", y enlace al PDF.
  - **Almacén:** nº A000n, tipo, cantidad, material y hora.
  - **Herramientas:** "→ número BAT-0n", o "⚠️ CAMBIADO" si el servidor cambió el número.
- **Envío automático:** cada minuto y al recuperar la conexión.

---

## 5) ALMACÉN HOY

- **Tipos de movimiento:** `ENTRADA`, `SALIDA` (a obra) y `DEVOLUCION` (de obra), para materiales (MOVIMIENTOS) y herramientas (HERR_MOV). En herramientas la ENTRADA es el **alta** de una máquina nueva.
- **Vales: no existen.** Cada movimiento es **una sola línea** (un material o una herramienta), con su propio número.
- **Numeración:**
  - Materiales: **A0001, A0002…** (contador `SIGUIENTE_MOV`).
  - Herramientas: movimientos **H0001…** (`SIGUIENTE_HERR`) y máquinas **PREFIJO-NN** (BAT-01…).
  - El número lo pone el servidor al recibir el movimiento; el número de máquina lo propone el móvil.
- **Fotos:**
  - Materiales: opcionales.
  - Herramientas: obligatorias.
  - Se guardan en Drive con los enlaces en la columna `fotos`.
- **Quién:**
  - `usuario` = quien lo anota.
  - `persona` = quien se lo lleva o lo devuelve (vacío en entradas).
- **Fecha y hora:** las del móvil al abrir el formulario.
- **Cálculo del stock:**
  - Materiales: `stock = ENTRADA + DEVOLUCION − SALIDA`, por código, solo materiales activos de MATERIALES.
    - Lo de código OTRO no cuenta.
    - No hay inventario inicial: el stock empieza en 0 y puede quedar en negativo.
    - La pestaña STOCK calcula lo mismo con fórmulas.
  - Herramientas: no hay stock por cantidad. Cada máquina está "en ALMACÉN" o en una obra según su **último movimiento** (HERR_DONDE).
- **POR_OBRA** (materiales): salido, devuelto y gastado por obra. Es control interno.
- **Los partes no tocan el almacén** (regla de `CLAUDE.md`).
- **Aviso de stock mínimo:** correo a `AVISOS_EMAIL` al cruzar `stock_min`. Hoy no salta porque `stock_min` está vacío en todos.

**Qué falta respecto a lo pedido:**

| Pedido | Estado hoy |
|---|---|
| Entradas por compra **solo para admin** | **No está.** Cualquier trabajador puede hacer una Entrada (no hay roles). |
| Retirada / devolución **para todos** | **Sí**: Salida a obra y Devolución de obra están para cualquier usuario. |
| Entrada **"recuperado" sin albarán** | **No hay tipo propio.** Solo existe "Entrada" genérica, con comentario y foto opcionales (ni albarán ni proveedor son obligatorios). |
| **Vales numerados con varias líneas** | **No está.** Cada movimiento es de un solo material, con nº A000n. No hay pestaña VALES ni agrupación de líneas. |

---

## 6) VERSIONES

- **`backend/Code.gs` publicado en Apps Script:** según el último aviso, el 30/10/2026 hacia las 16:25 se pidió a Mateo publicar el `Code.gs` de **539 líneas** (commit `07569b5`, "Herramientas: el número se da en el momento…", `ESQUEMA = '8'`). Mateo contestó **"HECHO"**.
  - **No está verificado desde aquí:** este entorno no puede llamar a la API de Apps Script. No se sabe el número de "Versión" que dio Apps Script.
  - La hoja sí tiene las pestañas HERR_MOV y HERR_DONDE (creadas por `instalar` con el esquema 8), pero **HERR_MOV está vacía**: aún no hay ningún movimiento de herramientas que confirme que el servidor usa esa versión.
- **Cambios del repositorio sin publicar en Apps Script:** **ninguno.** El último cambio de `backend/Code.gs` es el `07569b5`.
- **Web (`index.html`, `sw.js`, manifests, `almacen/`):** se publica sola con GitHub Pages en cada commit a `main`. El último despliegue confirmado en GitHub es el de `62d16b1` (30/10, 16:11); los posteriores (`de68794`, `b703dc1`, `07569b5`) se despliegan igual en ~1 minuto. Los móviles cogen la versión nueva al cerrar y abrir la app, o con la franja "Hay una versión nueva".

---

## 7) FALLOS CONOCIDOS Y PENDIENTES

**Fallos o situaciones conocidas:**
- **Huella:** en el móvil de Mateo "da error siempre". No está resuelto: la app enseña ahora el motivo del error y se puede quitar, pero falta ver ese motivo en un móvil real.
- **Instalar las dos apps a la vez** (SOLERA y SOLERA Almacén) exige desinstalar y reinstalar SOLERA una vez (se cambió su ámbito). No está comprobado en un Android real.
- **Datos de prueba en la hoja:**
  - El **parte 90001** sigue en PARTES (1 fila) y PARTES_LINEAS (2 filas). Sus PDF están en la papelera de Drive. El sistema de permisos no deja a Claude borrar filas.
  - **MOVIMIENTOS** tiene 4 filas de prueba:
    - La salida "Desde parte" del 90001 (CEM25, un código que ya no está en MATERIALES).
    - Una ENTRADA de ARE-BOL sin número (anterior a la numeración).
    - **A0001** (ENTRADA MOR-GRI 25).
    - **A0002** (SALIDA DIS-DIA 8 a Majuelos, que deja el disco diamante en −8).
  - Las A0001 y A0002 no tienen `persona` porque son anteriores a esa columna.
- **Columna PIN** de TRABAJADORES sin formato de texto (bloqueado por permisos). No afecta: el login rellena con ceros.
- **El comentario de cabecera de `Code.gs`** (paso 3 de instalación) aún lista solo 9 pestañas; las nuevas las crea igualmente `instalar()`.
- **Sin roles:** cualquiera puede hacer entradas y altas.
- **Herramientas:** el número lo propone el móvil. Si dos personas numeran a la vez, el servidor da el siguiente y avisa con "⚠️ CAMBIADO", y hay que corregir el número escrito en la máquina.
- **Obras sin código del zonero:** las que no son de Mercadona (BALD, RUF, SF, MANT) llevan códigos propios.

**Pendientes (de `PENDIENTES.md`):**
- **Parte:**
  - Quitar las horas extra del parte (solo horas en bruto; afecta a la pantalla, el PDF, PARTES_LINEAS y el CSV). *Esperando OK.*
  - A la vez, elegir PEÓN / OFICIAL por trabajador en cada parte (solo para el cliente, no para nóminas). *Esperando OK.*
- **Almacén:**
  - Varios almacenes: de momento uno (no cambiar ahora).
  - Lo pedido y aún no hecho (sección 5): entradas de compra solo para admin, entrada "recuperado" y vales numerados con varias líneas.
- **App:**
  - Probar la huella en móviles reales.
  - Foto para reconocer el material (por decidir).
- **Herramientas:** rotulador ahora (Edding 750 / uni PX-20). Más adelante, pegatinas con QR (Brother con cinta TZe-S o imprenta), el PDF de pegatinas desde HERRAMIENTAS y escanear el QR desde la app.
- **Entrada de material desde la foto de una factura o albarán:** NO en la app del móvil; es para Mateo o Gregorio, aparte.
- **En la hoja (lo hace Mateo):**
  - Borrar el parte 90001 y las filas de prueba.
  - Poner la categoría del trabajador 22 (Jesús Enrique Herrera).
  - Rellenar `stock_min`.
- **Al acabar las pruebas:**
  - Activar el CSV (`CARPETA_CSV_ID` = carpeta APP).
  - Revisar los artículos de proveedor de `MATERIALES APP.csv`.
