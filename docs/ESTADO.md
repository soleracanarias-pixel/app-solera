# APP SOLERA — estado actual (31/10/2026, tras el PASO 6: vales, roles y admin)

Radiografía sacada del código del repositorio (`main`, PASO 6) y de una lectura de la hoja
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
| `backend/Code.gs` | Backend de Google Apps Script. Se pega a mano en el editor de Apps Script de la hoja "APP SOLERA" y se publica como aplicación web. |
| `CLAUDE.md` | Reglas para Claude: app en pruebas, no tocar los ficheros activos de SOLERA, partes y almacén separados, códigos de obra Mercadona = zonero, cómo publicar. |
| `PENDIENTES.md` | Lista de cosas pedidas y aún no hechas. |
| `README.md` | Una línea de descripción. |
| `docs/ESTADO.md` | Este documento. |

---

## 2) PESTAÑAS DE LA HOJA "APP SOLERA"

`asegurarHojas_()` crea las pestañas que falten y añade al final las columnas que falten (versión de esquema `ESQUEMA = '9'`, guardada en las propiedades del script). Se ejecuta en cada llamada a la API (si el esquema cambió) y, forzada, en `instalar()`.

| Pestaña | Columnas exactas | Quién la escribe |
|---|---|---|
| **CONFIG** | `clave, valor` | A mano; el código actualiza los contadores. |
| **TRABAJADORES** | `codigo, nombre, categoria, pin, activo, encargado, rol` | A mano. `rol` = admin / encargado / oficial; `instalar()` lo rellena donde esté vacío (999 = admin; encargado=SI → encargado; resto → oficial). |
| **OBRAS** | `codigo, nombre, cliente, activa` | A mano. |
| **MATERIALES** | `codigo, nombre, unidad, stock_min, activo, orden, categoria` | A mano (`orden` = orden de las sugerencias, lo más usado primero). La hoja real tiene además `veces_partes` y `compras_2026` (informativas). |
| **PARTES** | `id, numero, fecha, obra_codigo, obra, cliente, creado_por, trabajadores, total_horas, trabajos, materiales, medios, observaciones, firmado, firmante, pdf_url, fotos, creado_en, origen, firmado_en, copia_enviada_a, copia_enviada_en, copia_error` | `crearParte_`. |
| **PARTES_LINEAS** | `id, numero, fecha, obra, trabajador_codigo, trabajador, categoria, horas, horas_extra, firmado` | `crearParte_`, una fila por trabajador. |
| **MOVIMIENTOS** (líneas del almacén de materiales) | `id, fecha, tipo, material_codigo, material, cantidad, unidad, obra, parte_numero, usuario, nota, creado_en, fotos, numero, hora, persona, linea, anulado` | `vale_`: una fila por línea, con el nº del vale y `linea` 1, 2, 3…; `anularVale_` pone `anulado = SI`. Las filas antiguas (sin `linea`) se quedan como estaban. |
| **VALES** | `numero, fecha, hora, tipo, obra, usuario, persona, nota, fotos, proveedor, albaran, n_lineas, anulado, anulado_por, anulado_en, motivo_anulacion, creado_en, id` | `vale_` (una fila por vale) y `anularVale_`. `id` = id del móvil, para no duplicar al reenviar. |
| **STOCK** | `codigo, nombre, unidad, entradas, salidas, stock, stock_min, aviso` | Fórmulas `ARRAYFORMULA` (las pone `instalar()` si está vacía). Entradas = ENTRADA + DEVOLUCION + RECUPERADO; salidas = SALIDA; sin las líneas anuladas (`instalar()` las rehace siempre); `aviso` = "PEDIR" si `stock_min > 0` y `stock <= stock_min`. |
| **FIRMANTES** | `nombre, email, obra_ultima, veces, actualizado_en` | `guardarFirmante_` (libreta de firmantes para la copia por correo). |
| **POR_OBRA** | `obra, material_codigo, material, unidad, salido, devuelto, gastado, recuperado` | `porObra_` (se rehace tras cada vale con obra y tras anular; se escribe por nombre de columna). `gastado = salido − devuelto − recuperado`, sin anulados. |
| **HERR_TIPOS** | `prefijo, tipo, orden` | A mano. Hoy tiene 19 tipos: RAP, RAG, ALA, BAT, MAR, AND, RUB, AMA, MPI, VEN, TRO, FOC, TAL, ESC, COR, CAR, ATO, COM y LIJ. |
| **HERRAMIENTAS** | `codigo, tipo, activo, alta_fecha, alta_por` | `altaHerramienta_` (una fila por máquina: BAT-01…). |
| **HERR_MOV** | `id, fecha, tipo, herramienta_codigo, herramienta, cantidad, unidad, obra, usuario, nota, creado_en, fotos, numero, hora, persona` | `movimiento_` con clase HER. |
| **HERR_DONDE** | `codigo, herramienta, donde, quien, desde, ultimo_mov, foto` | `herrDonde_(true)`: se rehace tras cada movimiento de herramienta. |

- La hoja tiene además una pestaña **"Hoja 1"** vacía, que el código no usa.

**Claves de CONFIG que usa el código:**

| Clave | Para qué | Valor hoy en la hoja |
|---|---|---|
| `TOKEN` | Contraseña de la API (debe coincidir con `config.js`). | puesto |
| `CARPETA_PARTES_ID` | Carpeta de Drive `CLIENTES\PARTES\APP`, raíz de los PDF de los partes, `ALMACEN/<MES>` y `HERRAMIENTAS/<MES>`. | puesto |
| `SIGUIENTE_NUMERO` | Próximo nº de parte (empieza en 90001). | 90002 |
| `SIGUIENTE_MOV` | Próximo nº de vale de almacén (A0003, A0004…; un número por vale). | 3 |
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
| `login` | `codigo, pin` | `{ ok, trabajador:{codigo, nombre, categoria, encargado, rol} }` o error "Trabajador no encontrado" / "PIN incorrecto". El PIN se compara rellenando con ceros a 4 cifras. | Sí |
| `bootstrap` | — | `{ ok, trabajadores[{codigo,nombre,categoria,rol}], obras[{codigo,nombre,cliente}], materiales[{codigo,nombre,unidad,stock_min}]` (ordenados por `orden`), `stock[{codigo,nombre,unidad,stock,stock_min}], otros[{nombre,veces,ultimo}]` (líneas OTRO sin anular), ` herramientas[{codigo,tipo,nombre,donde,quien,desde,ultimo_mov,foto}], herrTipos[{prefijo,nombre}], firmantes[{nombre,email}]` (por nº de veces), `hora }`. Solo activos. | Sí ("Actualizar listas" y al arrancar) |
| `crearParte` | `parte:{id, fecha, obra, obraNombre, trabajadores[{codigo,nombre,categoria,horas,extra}], trabajos, materiales[{codigo,nombre,unidad,cantidad}], medios, observaciones, firma (dataURL), firmante, firmanteEmail, firmadoEn, fotos[dataURL], creadoPor, creadoEn}` | `{ ok, numero, pdf_url, copia_enviada_a, copia_error }`. Si el `id` ya existe: `{ ok, repetido:true, … }` con lo guardado. | Sí |
| `vale` | `vale:{id, tipo:'SALIDA'|'DEVOLUCION'|'RECUPERADO'|'ENTRADA', obra, persona, nota, fotos[dataURL], albaranArchivo (foto o PDF), proveedor, albaran, lineas[{material, materialNombre, unidad, cantidad}], fecha, hora, usuario, auth:{codigo,pin}}` | `{ ok, numero, fotos[urls], n_lineas }`. Si el `id` ya existe: `{ ok, repetido:true, numero }`. ENTRADA (compra) exige `auth` de un admin, proveedor y albarán; SALIDA/DEVOLUCION/RECUPERADO exigen obra; RECUPERADO exige comentario. | Sí (almacén de materiales) |
| `vales` | `auth:{codigo,pin}` (admin), `filtros:{desde, hasta (aaaa-mm-dd), trabajador, tipo, obra}` | `{ ok, vales[{numero, fecha, hora, tipo, obra, usuario, persona, nota, proveedor, albaran, n_lineas, fotos[], anulado, anulado_por, anulado_en, motivo_anulacion, lineas[{linea, material_codigo, material, cantidad, unidad, anulado}]}] }`, el más nuevo primero (máx. 300). | Sí (pantalla Vales) |
| `anularVale` | `auth` (admin), `numero`, `motivo` (obligatorio) | `{ ok, numero }`. Marca el vale y sus líneas como anulados; nunca borra. | Sí (pantalla Vales) |
| `movimiento` | `mov:{id, clase:'MAT'|'HER', tipo:'ENTRADA'|'SALIDA'|'DEVOLUCION', material, materialNombre, cantidad, obra, nota, fotos[dataURL], fecha, hora, usuario, persona, tipoHer, codigoNuevo}` | `{ ok, numero, fotos[urls], herramienta, cambiado }`. Si el `id` ya existe: `{ ok, repetido:true, numero }`. | Sí para herramientas; para materiales solo lo que quedara pendiente en los móviles (los vales usan `vale`). |
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

**Roles en el servidor:** `vales`, `anularVale` y el `vale` de tipo ENTRADA llaman a `exigirAdmin_(auth)`, que comprueba código, PIN y `rol = admin` en TRABAJADORES. Si no, error "Solo el administrador puede hacer esto". De momento encargado = oficial en permisos.

**Funciones solo para el editor:**
- `instalar()`: crea las pestañas, rellena CONFIG si está vacía y pone las fórmulas de STOCK.
- `exportarCSV()`: rehace el CSV a mano.

---

## 4) PANTALLAS Y ROLES

**Roles** (columna `rol` de TRABAJADORES; el servidor los comprueba):
- **admin:** ve además el botón **COMPRA** y la pestaña **Vales**, y en "Ver stock" los materiales metidos como OTRO pendientes de dar de alta.
- **encargado** y **oficial** (de momento iguales): ME LLEVO, DEVUELVO y ENCONTRÉ MATERIAL, Herramientas y Enviados.
- **"SOLERA Almacén"** oculta la pestaña Parte. La app **SOLERA** enseña Parte a todos.

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

**Almacén** (cada formulario es un **vale** con varias líneas):
- **Botones grandes:** ⬆ ME LLEVO · ↩ DEVUELVO · 🔎 ENCONTRÉ MATERIAL · 🧾 COMPRA (solo admin).
- **El formulario se abre justo debajo**, con:
  - Fecha y hora del móvil.
  - Líneas de material (sugerencias o texto libre = OTRO) con cantidad, y "+ otra línea".
  - Obra (en ME LLEVO, DEVUELVO y ENCONTRÉ, aquí como "obra de procedencia").
  - Persona: "¿Quién se lo lleva / lo devuelve / lo encontró?".
  - Comentario: obligatorio en ENCONTRÉ.
  - Fotos opcionales.
  - En COMPRA: proveedor y nº de albarán o factura (obligatorios) y el albarán como foto o fichero (jpg, png o pdf).
- **📦 Ver stock (plegado):**
  - Buscador y stock por material: rojo si es negativo; "pedir" solo con mínimo puesto.
  - Al tocar un material: sus 10 últimos movimientos, con "Vale Nº", fecha, hora, tipo, cantidad, obra, quién se lo lleva o lo devuelve, quién lo anotó, comentario y fotos.

**Herramientas** (en las dos apps; solo aparece si el servidor devuelve `herramientas`):
- **Botones:** ⬆ Llevar a obra · ↩ Devolver · ⬇ Alta en el almacén.
- **Siempre una a una** (sin cantidad) y **con foto obligatoria**.
- **Llevar a obra / Devolver:**
  - Se elige la máquina por su número (BAT-01 · BATIDORA) o "TIPO · sin número (se le da uno nuevo)".
  - Al devolver, la obra donde estaba sale puesta.
- **Alta:** se elige el tipo.
- **Máquina nueva** (alta o "sin número"): la app enseña en el momento **"Número para esta máquina: BAT-03 ✍️ Escríbelo con el rotulador en la máquina y haz la foto donde se vea"**.
- **🔧 ¿Dónde están las herramientas?** (plegado): cada máquina con 📍 obra o "En almacén", quién la tiene y desde cuándo. Al tocarla, su historial.

**Vales** (solo admin; pantalla más ancha en el ordenador):
- Filtros por fechas, trabajador, tipo y obra; lista del más nuevo al más viejo.
- Al tocar un vale: sus líneas (OTRO marcado), proveedor y albarán, comentario y adjuntos.
- **ANULAR** con motivo obligatorio: queda tachado como "ANULADO por … el …: motivo".

**Enviados:**
- **"Pendientes de enviar":** con el error si falló ("reintentar") y el botón "Enviar ahora".
- **Histórico** (los 50 últimos en ese móvil):
  - **Partes:** nº, obra, firmado o no, "copia enviada a …" o "copia no enviada", y enlace al PDF.
  - **Almacén:** "Nº A000n · Vale · ME LLEVO · 2 líneas · obra" y la hora.
  - **Herramientas:** "→ número BAT-0n", o "⚠️ CAMBIADO" si el servidor cambió el número.
- **Envío automático:** cada minuto y al recuperar la conexión.

---

## 5) ALMACÉN HOY

- **Vales:** un formulario = un vale con varias líneas.
  - El servidor da **un número por vale** (A0003, A0004…, contador `SIGUIENTE_MOV`, con el bloqueo del script).
  - Todas las líneas llevan ese número en MOVIMIENTOS (`numero` y `linea`).
  - La cabecera va en VALES.
- **Tipos** (en pantalla → en la hoja):
  - **ME LLEVO** → SALIDA.
  - **DEVUELVO** → DEVOLUCION.
  - **ENCONTRÉ MATERIAL** → RECUPERADO: obra de procedencia y comentario obligatorios, foto opcional, sin proveedor ni albarán.
  - **COMPRA** → ENTRADA: solo admin, con proveedor y albarán obligatorios y el adjunto (foto o PDF).
- **Fotos y albarán** en Drive, en `CLIENTES\PARTES\APP\ALMACEN\<MES>\` ("DD-MM-AAAA A0006 ENTRADA Proveedor Albarán.pdf"). Los enlaces van en `fotos` de VALES y de sus líneas.
- **Anular:** solo admin y con motivo. Marca el vale y sus líneas; nunca se borra nada.
- **Stock** = ENTRADA + DEVOLUCION + RECUPERADO − SALIDA, sin anulados (en la app y en la pestaña STOCK).
  - Lo metido como OTRO no cuenta: el admin lo ve como "pendiente de dar de alta en MATERIALES".
  - Sigue sin inventario inicial.
- **POR_OBRA:** salido, devuelto, recuperado y gastado (salido − devuelto − recuperado), sin anulados.
- **Herramientas:** no cambian en este paso (una a una, HERR_MOV y HERR_DONDE).
- **Los partes no tocan el almacén.**

| Pedido | Estado |
|---|---|
| Entradas por compra solo para admin | **Hecho** (botón solo admin y comprobación en el servidor). |
| Retirada / devolución para todos | **Hecho.** |
| Entrada "recuperado" sin albarán | **Hecho** (ENCONTRÉ MATERIAL). |
| Vales numerados con varias líneas | **Hecho.** Las filas antiguas de MOVIMIENTOS no se migran. |

---

## 6) VERSIONES

- **Publicado en Apps Script:** el `Code.gs` del 30/10 (commit `07569b5`, `ESQUEMA = '8'`), según lo que dijo Mateo ("HECHO"). No está verificado desde aquí.
- **Sin publicar:** el `Code.gs` del **PASO 6** (vales, roles, admin; `ESQUEMA = '9'`). Para activarlo:
  1. Pegar el `Code.gs` nuevo en Apps Script y guardar.
  2. **Ejecutar `instalar`**: crea VALES y las columnas `rol`, `linea`, `anulado` y `recuperado`, pone los roles y rehace las fórmulas de STOCK.
  3. **Implementar → Gestionar implementaciones → ✎ → Versión nueva.**
  - **No hay permisos nuevos:** usa lo mismo (hojas, Drive y Gmail).
- **Mientras tanto:** la web nueva ya está en GitHub Pages, pero los vales que se hagan se quedan en "Pendientes" con error hasta publicar. No se pierden: se envían solos después.

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
- **Roles solo de almacén:** las altas de herramientas y los partes siguen abiertos a todos.
- **Las acciones de admin envían el PIN** guardado en el móvil (por HTTPS) para que el servidor compruebe el rol. Si el móvil no lo tiene (por ejemplo, siempre entró con huella en otro móvil), pide salir y entrar con el PIN.
- **POR_OBRA puede dar "gastado" negativo** si se devuelve o recupera de una obra sin salida registrada antes (no hay inventario inicial).
- **Herramientas:** el número lo propone el móvil. Si dos personas numeran a la vez, el servidor da el siguiente y avisa con "⚠️ CAMBIADO", y hay que corregir el número escrito en la máquina.
- **Obras sin código del zonero:** las que no son de Mercadona (BALD, RUF, SF, MANT) llevan códigos propios.

**Pendientes (de `PENDIENTES.md`):**
- **Parte:**
  - Quitar las horas extra del parte (solo horas en bruto; afecta a la pantalla, el PDF, PARTES_LINEAS y el CSV). *Esperando OK.*
  - A la vez, elegir PEÓN / OFICIAL por trabajador en cada parte (solo para el cliente, no para nóminas). *Esperando OK.*
- **Almacén:**
  - Varios almacenes: de momento uno (no cambiar ahora).
  - Diferenciar permisos de encargado y oficial (hoy iguales).
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
