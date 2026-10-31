# APP SOLERA — estado actual

La app está **EN PRUEBAS** (ver `CLAUDE.md`). Lo pendiente está en `PENDIENTES.md`.

## Ficheros
- `index.html`: la app entera (SOLERA). Con `?modo=almacen` es **SOLERA Almacén** (`almacen/index.html`, sin la pestaña Parte).
- `sw.js`: guarda la app en el móvil para abrirla sin cobertura (incluye `lib/`).
- `lib/zxing-0.21.3.min.js`: lector de códigos de barras para iPhone (Apache 2.0), dentro de la app.
- `backend/Code.gs`: servidor (Apps Script de la hoja "APP SOLERA"). Publicado en la **versión 12**, igual que el repositorio (`ESQUEMA = '14'`).
- `docs/MATERIALES_PROPUESTA.csv`: lista de materiales aprobada (sin precios).

## Quién puede qué
- **Todos:** parte, ME LLEVO, DEVUELVO, ENCONTRÉ MATERIAL, herramientas, ver stock, escanear (si el código ya es conocido).
- **Admin** (rol en TRABAJADORES): COMPRA (a almacén o a obra), TRASPASO, pestaña Vales y anular.
- **Inventario = SI** (Mateo 999 y Gregorio 998): pestaña Inventario y asociar códigos de barras nuevos.
- El servidor lo comprueba con código + PIN. Quien entra solo con huella tiene que entrar una vez con el PIN para compras, traspasos e inventario.

## Almacén
- Dos almacenes (pestaña ALMACENES): **LA MATANZA** (por defecto) y **AGÜIMES**. Cada vale guarda el suyo; el móvil recuerda el último de su dueño.
- Cada formulario es un **vale** numerado (A0004…) con varias líneas; cada línea puede llevar **marca** y se puede **escanear** el EAN.
- Tipos: SALIDA (ME LLEVO), DEVOLUCION, RECUPERADO, ENTRADA (compra a almacén), COMPRA_OBRA (no toca el stock), TRASPASO (sale de uno y entra en otro) y AJUSTE (inventario).
- **Stock** por almacén, por marca y total (app y pestaña STOCK): entradas + devoluciones + recuperado + traspasos que entran + ajustes − salidas − traspasos que salen. Sin anulados.
- Solo cuentan los materiales activos con `en_almacen = SI`; agua, hormigón, zahorra y áridos a granel van directo a obra (solo en partes y compras a obra).
- **POR_OBRA:** gastado = salido + comprado − devuelto − recuperado.
- Lo que no está en la lista entra como **OTRO** y el admin lo ve como "pendiente de dar de alta".
- Los partes no tocan el almacén.

## Inventario (se puede hacer entero sin cobertura)
- Antes de ir: "📥 Preparar para ir sin cobertura" (descarga listas, EAN, máquinas, almacenes y stock; se ve "Listas actualizadas el …").
- Se elige almacén. **Materiales** por categoría, con buscador y alias, stock de la app y casilla "contado"; varias marcas por material (se suman). **Máquinas** por tipo: bien / regular / averiada. Material a mano (OTRO). Foto por línea y fotos generales (1600 px).
- Borrador automático en el móvil; se puede salir y seguir otro día.
- **Cerrar inventario:** vale AJUSTE con quién, almacén, inicio y cierre. La diferencia se calcula con el **stock del servidor** al recibirlo (si cambió, se indica en el vale). Una marca que había y no se contó queda a 0. Las máquinas que falten se dan de alta con número (la app enseña cuáles rotular). Se anula como cualquier vale.
- Envío solo al volver la cobertura: EAN nuevos → inventario → fotos una a una, con reintento. En Enviados: "Inventario A00xx: 12 de 30 fotos subidas".

## Códigos de barras
- Pestaña **EANS** (ean, material_codigo, marca, nombre_envase, proveedor). EAN conocido: rellena material y marca y salta a la cantidad. Nuevo: Mateo y Gregorio lo asocian (también sin cobertura); los demás lo eligen a mano.
- Los artículos de proveedor (`MATERIALES APP.csv` y las tablas de precios) **no traen EAN**: no hay nada que cargar; se irán dando de alta al escanear.

## Pestañas de la hoja
CONFIG, TRABAJADORES (+ `rol`, `inventario`), OBRAS, MATERIALES (+ `codigo_mercadona`, `en_almacen`, `alias`, `uso_base`), PARTES, PARTES_LINEAS, MOVIMIENTOS (+ `almacen`, `contado`, `marca`, `stock_antes`), VALES (+ `almacen`, `almacen_destino`, `inicio`, `cierre`), STOCK (fórmulas, con `stock_MAT` y `stock_AGU`), POR_OBRA, ALMACENES, EANS, INV_MAQUINAS, FIRMANTES, HERR_TIPOS, HERRAMIENTAS, HERR_MOV, HERR_DONDE, MATERIALES_ANTES_6D (copia de seguridad) y "Hoja 1" (vacía, no se usa).
Las pestañas y columnas nuevas se crean solas en la primera llamada. `instalar()` solo hace falta si se añade un almacén (columna en STOCK).

## Publicar
clasp desde Claude Code (necesita que Mateo inicie sesión en cada sesión nueva) o a mano: Implementar → Gestionar implementaciones → ✎ → Versión nueva, siempre en la implementación de `config.js`.

## Fallos conocidos
- Huella: en el móvil de Mateo da error; falta ver el motivo en un móvil real.
- La cámara para escanear necesita permiso del navegador la primera vez (en iPhone, desde la app instalada o Safari). Sin cámara se puede escribir el número.
- Herramientas: sin almacén (dónde está = ALMACÉN u obra). Si dos móviles numeran a la vez, el servidor da otro número y avisa "⚠️ CAMBIADO".
