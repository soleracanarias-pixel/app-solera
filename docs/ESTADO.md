# APP SOLERA — estado actual

La app está **EN PRUEBAS** (ver `CLAUDE.md`). Lo pendiente está en `PENDIENTES.md`.

> ⚠️ **Stock ficticio de prueba en LA MATANZA:** AJUSTE **A0004** ("FICTICIO – ANULAR ANTES DEL INVENTARIO REAL", del inventario "INVENTARIO FICTICIO PRUEBAS 31/10/2026", contado por el 990 PRUEBA) y ME LLEVO **A0005** del 990 (CEM-425 en −3). **Hay que anular los dos en Vales antes del primer inventario real.** AGÜIMES y QUIQUIRÁ, sin tocar.

## Ficheros
- `index.html`: la app entera. **Un solo icono instalable: "SOLERA"** (`manifest.json`). `?modo=almacen` sigue funcionando por compatibilidad (arranca en Almacén, sin Parte); `almacen/` ya no se ofrece para instalar, pero sigue abriendo la app para quien lo tenga instalado.
- `sw.js`: guarda la app en el móvil para abrirla sin cobertura (incluye `lib/`).
- `lib/zxing-0.21.3.min.js`: lector de códigos de barras para iPhone (Apache 2.0), dentro de la app.
- `backend/Code.gs`: servidor (Apps Script de la hoja "APP SOLERA"). Repositorio en la **versión 30** (`ESQUEMA = '22'`); publicada en Apps Script la 22 (de la 23 a la 30, pendientes de publicar a mano: en esta sesión no hay clasp).
- **Versión a la vista:** abajo, en pequeño, en la entrada y en la app: "web v30 · servidor 30 · esquema 22". `VERSION_WEB` (index.html) y `VERSION_SERVIDOR` (Code.gs) = nº de versión publicada en Apps Script; se suben a la vez en cada publicación. Si no coinciden, sale "⚠️ actualiza la app" (al tocarlo, recarga).
- `docs/MATERIALES_PROPUESTA.csv`: lista de materiales aprobada (sin precios).

## Interruptores (pestaña CONFIG; se crean a NO)
- **PARTES_ACTIVOS:** con NO, la pestaña Parte solo la ve el admin y la app arranca en Almacén (para todos). Con SI, todos ven Parte y la app arranca en Parte.
- **HUELLA:** con NO, ni se ofrece ni se usa la huella (se entra con el PIN). El código sigue ahí; con SI vuelve a funcionar como antes.

## Pantalla
- Todo lo pulsable mide al menos 48 px de alto (botones, desplegables, campos, enlaces, la barra inferior 56 px).
- Cuando la app va como almacén (PARTES_ACTIVOS = NO o `?modo=almacen`): letra base 18 px, títulos de campo 15 px y ayudas 14 px.
- Cantidades (vales, materiales del parte y andamios) con botones − y + de 48 px a los lados.
- **Lo que el servidor no acepta** (albarán repetido, material que ya no existe, PIN cambiado…; no la falta de cobertura ni los atascos del servidor, que se reintentan solos): queda marcado en la cola y ya no se reintenta solo. Banda amarilla fija bajo la cabecera "⚠️ n no se han podido enviar · toca para ver" → Enviados, donde sale arriba con el motivo en lenguaje llano y dos botones: **Reintentar** (vuelve a la cola, con el PIN actual) y **Avisar a Mateo** (texto opcional; acción `avisoCola` con código + PIN). El servidor lo apunta en VALES como vale **anulado** (no entra en el stock; tipo AVISO si no era un vale) con `revisar = SI` y `nota_revisar` "AVISO de …: … · El servidor dijo: …"; en el móvil sale de la cola (con sus fotos) y pasa a enviados con la etiqueta "avisado". Ya no hay botón "quitar".
- **"Me he equivocado"** (Enviados): en los vales de almacén de HOY que anotó quien ha entrado. Texto opcional ("eran 3 sacos, no 5") y acción `valeRevisar` con código + PIN; el servidor comprueba que es suyo y de hoy, pone `revisar = SI` y apunta en `nota_revisar` "ERROR de … (fecha hora): …". No cambia el stock: Mateo lo corrige (DEVUELVO, anular…).
- **Para revisar:** en Vales, chip rojo REVISAR y casilla "Solo para revisar"; al abrir el vale, la nota y (admin) "Revisado" con texto opcional (acción `valeRevisado`): `revisar` pasa a REVISADO y se apunta quién y cuándo, sin borrar nada. En el Resumen, tarjeta "Para revisar" (lleva a Vales con la casilla puesta).
- **"Letra grande"** en Enviados: lo sube todo un 15 % (se guarda en el móvil).
- **En el ordenador (pantalla de más de 900 px)**, "Ver stock" y "¿Dónde están las herramientas?" salen como **tabla ordenable** (tocar una cabecera ordena; otra vez, al revés) con botón **"Copiar tabla"** (tabulado: se pega en Excel tal cual). En el stock: categoría, material, código, unidad, stock del almacén elegido (o una columna por almacén y el total con "Todos"), mínimo y aviso; al tocar una fila, sus marcas y últimos movimientos. En herramientas: código, máquina, estado, dónde, cantidad (andamios), quién, desde, avería, recibo y OK, con el enlace Historial. En el móvil no cambia nada.

## Quién puede qué (columna `rol` de TRABAJADORES)
- **trabajador** (todos los compañeros, oficiales o peones; la categoría OFICIAL/PEÓN solo se usa en el parte): parte; en Almacén, solo ME LLEVO, DEVUELVO y ENCONTRÉ; en Herramientas, "¿Dónde queda una máquina?" (incluye avería y alta) y Andamios.
- **encargado:** lo mismo que trabajador y además **TRASPASO** y la pestaña **Vales**, donde ve solo sus vales y los de su cuadrilla (los que coincidieron con él en vales, misma obra y día, en los últimos 30 días), sin "contado" ni "había" y sin poder anular (para anular, Mateo). Sigue sin "Ver stock" salvo `ver_stock = SI`. El servidor lo comprueba con código + PIN.
- **admin:** además COMPRA (a almacén o a obra), TRASPASO, Ver stock, Resumen, pestaña Vales (con "Buscar" por nº, material, marca, comentario y proveedor; cada vale enseña su primera línea) y anular, y la pestaña Parte aunque PARTES_ACTIVOS = NO.
- **Columna `ver_stock` = SI** (Mateo, Gregorio y Sergio): "Ver stock". El stock solo llega al móvil (bootstrap, con código + PIN) de admin y de quien tenga ver_stock = SI; al salir se borra del móvil.
- **Inventarios:** los abre, revisa y cierra solo **Mateo (999)**. Cualquiera puede participar si Mateo le asigna categorías.
- **Columna `inventario` = SI** (Mateo y Gregorio): asociar códigos de barras (también fuera de un inventario).
- **Columna `herramientas` = SI** (Mateo, Gregorio y Sergio): entregar al reparador, recibir de reparación, dar el OK a las altas de máquinas y dar de alta o aprobar tipos de pieza de andamio.
- **Columna `historial` = SI** (Mateo, Gregorio y Sergio): botón "Historial" en cada herramienta y en cada tipo de andamio por almacén u obra.
- El servidor lo comprueba con código + PIN. Quien entra solo con huella tiene que entrar una vez con el PIN para compras, traspasos e inventario.

## Resumen (admin, herramientas = SI o inventario = SI)
- Pestaña **Resumen**, la primera al entrar en el ordenador (en el móvil no se abre sola). Necesita conexión.
- Tarjetas con contador (y los primeros nombres) que llevan a su pantalla: stock en negativo, bajo mínimo (`stock_min` de MATERIALES), OTRO sin dar de alta y códigos pendientes (→ Almacén / Ver stock), máquinas pendientes de OK, averiadas y en reparación con los días que lleva (→ Herramientas) e inventarios abiertos (→ Inventario).
- Debajo, **"Últimos 20 movimientos"** de almacén y herramientas: hora, tipo, material o máquina, cantidad, obra o almacén, persona y anotado por (y "móvil de …" si se anotó desde el móvil de otro).

## Avisos automáticos
- **Resumen diario por correo (18:30):** disparador `resumenDiario` (lo crea `instalar()` o, a mano, `instalarDisparadores()` desde el editor). Envía a `AVISOS_EMAIL` de CONFIG (vacío = no envía) y **solo si hay novedades** desde el último envío (firma en ScriptProperties `RESUMEN_DIARIO_FIRMA`): stock en negativo, OTRO sin dar de alta, EAN pendientes, albaranes pendientes de leer, máquinas averiadas, más de 15 días en reparación, altas pendientes de OK e inventarios abiertos. Si no hay nada pendiente no envía.
- **Stock mínimo:** correo al cruzar el `stock_min` (como hasta ahora).

## Móvil de quién y fechas
- **Dueño del móvil:** el primero que entra con su PIN en ese móvil. Si entra otro, el dueño no cambia; se cambia en Enviados ("Este móvil es de … · Este móvil es mío").
- Cada vale, movimiento de máquina y andamios lleva el código del dueño (`movil_de` en VALES, MOVIMIENTOS y HERR_MOV). Si no es quien anota, en Vales, en el Resumen y en el historial de herramientas sale "anotado desde el móvil de <nombre>". No bloquea nada.
- **Fecha y hora** de vales, máquinas y andamios = cuando se abrió el formulario (aunque se envíe más tarde). Cuándo llegó al servidor: `recibido_en`.

## Almacén
- Tres almacenes (pestaña ALMACENES): **LA MATANZA** (por defecto), **AGÜIMES** y **QUIQUIRÁ (OFICINA)**. Cada vale guarda el suyo; el móvil recuerda el último de su dueño.
- Cada formulario es un **vale** numerado (A0004…) con varias líneas.
- **Botones:** ME LLEVO y DEVUELVO grandes, a toda la anchura; debajo, pequeño, "🔎 ¿Ha aparecido material sin albarán?" (ENCONTRÉ). Admin: COMPRA y TRASPASO.
- **ME LLEVO / DEVUELVO / ENCONTRÉ:** material (con la cámara al lado), cantidad, obra (sale la última usada) y GUARDAR. Almacén y persona van puestos en una línea discreta con el enlace **"Lo apunto por un compañero"**, que enseña el almacén y los nombres como botones (primero "Yo", luego los de su cuadrilla con borde ámbar y después el resto; también se puede escribir). Comentario y fotos, plegados en "Más".
- **ENCONTRÉ:** tres botones obligatorios, "Sobró de la obra", "Lo dejó Mercadona" y "Apareció en el almacén" (va al comentario, delante de lo que se escriba, y como `origen` al servidor). Con "Apareció en el almacén" la obra es opcional (sin obra no entra en POR_OBRA). El comentario ya no es obligatorio.
- **Textos:** sin paréntesis en los títulos (se usa ·, por ejemplo "COMPRA · admin", "AJUSTE · inventario"); "1 línea / 2 líneas" en vez de "línea(s)". Los botones llevan **iconos SVG propios** (en el `<svg>` de arriba de index.html, función `ico()`), no emojis.
  Toques para un ME LLEVO de 2 materiales: 7 la primera vez (uno escaneado y otro escrito, eligiendo la obra), 5 con la obra ya puesta, 4 si se escanean los dos (más escribir el material y la cantidad).
- Tipos: SALIDA (ME LLEVO), DEVOLUCION, RECUPERADO, ENTRADA (compra a almacén), COMPRA_OBRA (no toca el stock), TRASPASO (sale de uno y entra en otro) y AJUSTE (solo al cerrar un inventario).
- **COMPRA "Solo foto, las líneas las meto luego"** (admin): proveedor, nº de albarán, destino y la foto o el fichero; queda con `estado = PENDIENTE_LEER`, sin líneas y **sin tocar el stock**. En Resumen sale la tarjeta "Albaranes pendientes de leer" (→ Vales, filtro "ALBARANES PENDIENTES DE LEER"); en el vale, "Completar líneas" (admin) mete las líneas, lo pasa a CONFIRMADA y entonces suma stock (acción `valeCompletar`). Proveedor + nº de albarán no se pueden repetir (tampoco con uno pendiente de leer).
- **Stock** por almacén, por marca y total: entradas + devoluciones + recuperado + traspasos que entran + ajustes − salidas − traspasos que salen. Sin anulados.
- **"Ver stock"** (admin y ver_stock = SI): arriba el almacén (LA MATANZA por defecto, AGÜIMES, QUIQUIRÁ o Todos) y un buscador (nombre, alias, referencia o código de barras). Por categoría, plegadas, con cuántos tienen stock (y cuántos en negativo). Dentro: primero en rojo los negativos, luego los que tienen stock y al final "A cero (n)" plegado. Cada material en una línea (nombre y cantidad); al tocarlo, sus marcas y sus últimos movimientos. Sin scroll lateral en móvil ni ordenador.
- **Pestaña STOCK:** el mismo orden (negativos arriba, luego con stock y a cero al final), con total y una columna por almacén.
- Solo cuentan los materiales activos con `en_almacen = SI`; agua, hormigón, zahorra y áridos a granel van directo a obra (solo en partes y compras a obra).
- **POR_OBRA:** gastado = salido + comprado − devuelto − recuperado.
- Si el material escrito no está en la lista, al salir del campo sale en rojo "No está en la lista: ¿es alguno de estos?" con hasta 3 parecidos y "Guardar tal cual (OTRO)". Al GUARDAR con líneas OTRO se pide confirmación. Lo OTRO no cuenta en el stock y el admin lo ve como "pendiente de dar de alta".
- **Al guardar** un vale, una máquina o andamios: tarjeta verde "✅ ME LLEVO guardado · 2 líneas · obra" (sin red: "Guardado en el móvil · se enviará solo"), que pasa a "Vale A000n" (o "Nº H000n") cuando llega el número. Botones "Hacer otro" y "Volver".
- **Errores de los formularios** (vales, máquinas, andamios y parte): junto al campo (en rojo, aviso debajo y la pantalla va hasta él). El toast solo para avisos del servidor.
- **Fotos:** opcionales ("📷 Foto (opcional)") salvo alta de máquina, avería y andamios. El servidor solo las exige en AVERIA, alta de máquina y andamios.
- Los partes no tocan el almacén.

## Inventario (evento; se puede contar entero sin cobertura)
- **Abrir (Mateo):** pestaña Inventario → "+ Nuevo inventario": almacén, fecha, nombre ("Inventario La Matanza 05/11/2026") y quién cuenta cada categoría de material y las MÁQUINAS (cada una, una sola persona). Se puede cambiar el reparto mientras está abierto. Uno por almacén a la vez.
- **Contar (participantes):** solo mientras está abierto les sale la pestaña Inventario con SUS categorías, **sin el stock de la app**. Buscador, alias, 📷, marcas (se suman), material a mano (OTRO), máquinas (bien/regular/averiada), fotos (1600 px). Borrador en el móvil; "📥 Preparar para ir sin cobertura" antes de ir.
  Con cobertura lo contado va llegando solo (sin fotos); **"He terminado"** lo entrega (sin cobertura se envía solo después: primero lo contado, luego las fotos una a una). Cada línea guarda quién y cuándo.
- **Mientras está abierto:** en ese almacén, aviso "Inventario en curso" en ME LLEVO, DEVUELVO, ENCONTRÉ, COMPRA y TRASPASO; esos vales quedan marcados (columna `inventario` de VALES).
- **Revisar y cerrar (Mateo, con cobertura):** por material, lo contado y por quién, el stock de la app y la diferencia; categorías sin terminar ("pendiente: …"), vales hechos durante el inventario, OTRO nuevos y máquinas. Se puede corregir una cantidad (queda quién la cambió).
  **"Cerrar y ajustar"** crea el vale AJUSTE con el stock del servidor en ese momento, con fotos; las máquinas que falten se dan de alta y sale la lista para rotular. "Marca no contada = 0" solo en los materiales contados; las categorías sin contar no se tocan. El AJUSTE se anula desde Vales. También se puede **anular** el inventario sin ajustar.
- Fuera de un inventario no se puede hacer ningún ajuste.

## Herramientas
- **Tipos** (HERR_TIPOS): `va_con` = PERSONA (la lleva un trabajador) u OBRA (se queda en la obra aunque cambie la cuadrilla); `control` = UNIDAD (cada una con su número, BAT-01) o CANTIDAD (andamios: por tipo de pieza y cuántas). Valores propuestos por Claude el 31/10/2026, **a revisar por Mateo y Gregorio**: PERSONA radiales, batidora, martillo, cortadora rubí, ventosa, taladro, coronas, atornillador y lijadora; OBRA alargador, amasadora, máquina de piso, tronzadora, foco, escalera, carretilla y compresor; ANDAMIO = CANTIDAD.
- **Estados** ("¿Dónde están?"): en almacén (cuál), en obra, 👤 con una persona, ⚠️ AVERIADA (dónde y qué le pasa), 🔧 EN REPARACIÓN (con quién y nº de recibo), PENDIENTE DE OK y BAJA. Admin y gestores lo ven agrupado por persona, por obra y por almacén, con las cantidades de andamio (por obra y por almacén).
- **Pantalla:** "Mis herramientas" (las que tiene cada uno, cada una con "📍 ¿Dónde queda?"), el botón grande **"📍 ¿Dónde queda una máquina?"** y "🏗️ Andamios".
- **¿Dónde queda una máquina?** (todas las de control UNIDAD): se escribe o escanea la máquina (salen las que están en almacén, en obra o con alguien; las averiadas y en reparación las llevan los gestores) y se ve dónde está ahora. Cinco botones de 56 px: 👤 Conmigo, 🏗️ En obra, 🏠 En almacén, ⚠️ Averiada, 👥 A un compañero. El habitual va relleno (PERSONA → Conmigo, OBRA → En obra); ninguno bloqueado. Cada uno pide solo su dato: la obra (sale la última usada), el almacén (el último), qué le pasa + foto (se deja en QUIQUIRÁ) o el compañero (primero los que coincidieron con él en vales, misma obra y día, en los últimos 30 días). En el servidor: Conmigo y A un compañero = ASIGNAR (cualquier máquina UNIDAD, a cualquier persona), En obra = SALIDA, En almacén = DEVOLUCION, Averiada = AVERIA.
- **"No tiene número → darle uno"** (dentro del mismo flujo, o al escribir una que no existe): tipo de máquina, el móvil propone el número (escribirlo con rotulador), foto obligatoria con el número y foto opcional de la placa; luego dónde queda (En almacén = ENTRADA). Queda PENDIENTE DE OK.
- **Andamios (CANTIDAD):** pantalla "🏗️ Andamios": llevar a obra, recoger de obra o entrada en almacén; almacén, obra, quién; la lista de tipos de pieza con una casilla de número cada una (vacía = 0) y UNA foto general obligatoria. En HERR_MOV, una línea por tipo con el mismo nº, quién, cuándo, de dónde y a dónde. "+ Tipo de pieza nuevo" (material, qué es y foto; **solo gestores**, a los trabajadores no les sale): queda PENDIENTE con un código provisional hasta que un gestor le pone código y nombre (sus movimientos pasan al definitivo).
- **Pegatinas** (gestores, herramientas = SI): botón "Pegatinas" en Reparaciones y altas. Vacío = todas las máquinas de control UNIDAD que no están de BAJA; o se escriben códigos o tipos ("BAT, RAD-03"). El servidor (acción `pegatinas`) hace un PDF con una pegatina por página: QR a la izquierda (el código de la máquina, que lee la cámara de Herramientas), código grande, tipo y SOLERA. Se guarda en Drive (carpeta de CARPETA_PARTES_ID → HERRAMIENTAS/PEGATINAS) y se descarga (en el móvil, compartir). Tamaño en CONFIG **PEGATINA_MM** (ancho x alto en mm, "50x25" por defecto). El QR se codifica en Code.gs (`qrMatriz_`: modo byte, nivel M, versiones 1 a 10; `qrPng_`: PNG sin librerías) y `npm test` lo lee con jsqr.
- **Alta de máquina:** foto opcional de la placa de características (`foto_placa` en HERRAMIENTAS); `marca`, `modelo` y `n_serie` quedan vacías para que Mateo las rellene desde la foto. Solo en el alta; después basta el número.
- **Historial** (historial = SI): fecha y hora, quién, de dónde y a dónde (y nº de movimiento); lo anulado sale tachado. Nada se borra. Los trabajadores no lo ven.
- **OK de altas** y **Reparaciones** (gestores: entregar a reparador con recibo PDF, vuelta, OK de altas y aprobar tipos nuevos) como hasta ahora.
- **Inventario:** las máquinas con número por estado (bien/regular/averiada, con altas de las que falten); los andamios por tipo y cantidad, y al cerrar se ajusta la cantidad de cada tipo en ese almacén.
- El 📷 de Herramientas lee el código de la máquina escrito o en QR (para cuando haya pegatinas).

## Códigos de barras
- Lector: primero el del navegador (BarcodeDetector, Android) y si no ZXing (iPhone), que va dentro de la app y se guarda en el móvil al instalar/actualizar, al abrirla con cobertura y con "Preparar". Sin cámara se escribe el número o la referencia del fabricante.
- Pestaña **EANS** (ean, material_codigo, marca, nombre_envase, proveedor, ref_fabricante, estado, sugerido, visto_en). Los materiales también se encuentran escribiendo la referencia del fabricante.
- **En los vales:** EAN conocido → material y marca, cantidad 1; cada escaneo repetido del mismo producto suma 1. EAN desconocido → se elige el material a mano y el código queda **PENDIENTE** (con el material elegido).
- **Asociar** (solo Mateo y Gregorio): en Almacén, "Códigos pendientes de asociar", o al escanear un código nuevo contando. A los demás, un código nuevo solo les pide elegir el material y queda pendiente.
- Los artículos de proveedor (`MATERIALES APP.csv` y las tablas de precios) **no traen EAN**; `ref_fabricante` se puede rellenar a mano en EANS.

## Pestañas de la hoja
CONFIG (+ `HUELLA`, `PARTES_ACTIVOS`), TRABAJADORES (+ `rol`, `inventario`, `herramientas`, `historial`, `ver_stock`), OBRAS, MATERIALES (+ `codigo_mercadona`, `en_almacen`, `alias`, `uso_base`), PARTES, PARTES_LINEAS, MOVIMIENTOS (+ `almacen`, `contado`, `marca`, `stock_antes`, `movil_de`, `recibido_en`), VALES (+ `almacen`, `almacen_destino`, `inicio`, `cierre`, `inventario`, `movil_de`, `recibido_en`), STOCK (fórmulas, con `stock_MAT`, `stock_AGU` y `stock_QUI`), POR_OBRA, ALMACENES, EANS, INVENTARIOS (id, almacen, nombre, fecha, abierto/cerrado por y en, estado ABIERTO/CERRADO/ANULADO, participantes, asignacion, terminados, fotos, vale), INV_LINEAS (lo contado: quién, cuándo, corregido), INV_MAQUINAS, FIRMANTES, HERR_TIPOS (+ `va_con`, `control`, `estado`, `material`, `definicion`, `foto`, `propuesto_por`, `creado_en`), HERRAMIENTAS (+ `ok`, `ok_por`, `ok_en`, `motivo_rechazo`, `marca`, `modelo`, `n_serie`, `foto_placa`), HERR_MOV (+ `almacen`, `recibo`, `movil_de`, `recibido_en`), HERR_DONDE (+ `estado`, `almacen`, `ok`, `averia`), REPARADORES, REPARACIONES, MATERIALES_ANTES_6D (copia de seguridad) y "Hoja 1" (vacía, no se usa).
Las pestañas y columnas nuevas se crean solas en la primera llamada. `instalar()` solo hace falta si se añade un almacén (columna en STOCK).

## Publicar
clasp desde Claude Code (necesita que Mateo inicie sesión en cada sesión nueva) o a mano: Implementar → Gestionar implementaciones → ✎ → Versión nueva, siempre en la implementación de `config.js`.

## Fallos conocidos
- Huella: en el móvil de Mateo da error; falta ver el motivo en un móvil real. Desactivada (HUELLA = NO).
- La cámara para escanear necesita permiso del navegador la primera vez (en iPhone, desde la app instalada o Safari). Sin cámara se puede escribir el número.
- Herramientas: si dos móviles numeran a la vez, el servidor da otro número y avisa "⚠️ CAMBIADO".
- Entregar al reparador, la vuelta y el OK necesitan cobertura (se hacen desde la oficina).
