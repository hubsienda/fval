# FVAL

Aplicación operativa de ventas/pedidos para FRUKLAS.

## Arquitectura

- Next.js + TypeScript + App Router.
- Despliegue previsto en Vercel.
- Sin base de datos.
- Google Sheets: datos maestros de clientes, productos y empleados, siempre en modo lectura.
- Google Drive: archivo operativo de pedidos.
- Autenticación privada mediante una clave compartida y cookie de sesión HTTP-only firmada.

## Rutas

- `/` — redirige a `/pedido` o `/login`.
- `/login` — acceso privado.
- `/pedido` — alta de un nuevo pedido.
- `/pedidos` — búsqueda e histórico de pedidos.
- `/pedidos/[id]` — detalle y cambio de estado.
- `/api/diagnostic` — diagnóstico protegido de conectividad Google.

## Variables de entorno

Configurar exclusivamente en Vercel o en un entorno local seguro:

```
GOOGLE_PROJECT_ID
GOOGLE_CLIENT_EMAIL
GOOGLE_PRIVATE_KEY

GOOGLE_CLIENTES_SHEET_ID
GOOGLE_PRODUCTOS_SHEET_ID
GOOGLE_EMPLEADOS_SHEET_ID

GOOGLE_PEDIDOS_FOLDER_ID

FVAL_SESSION_SECRET
FVAL_ACCESS_PASSPHRASE
```

No incluir valores reales en Git ni en este README.

`GOOGLE_PRIVATE_KEY` admite el formato habitual de variables de entorno con saltos de línea escapados (`\n`).

## Google APIs

Habilitar en el proyecto Google Cloud usado por la cuenta de servicio:

- Google Sheets API
- Google Drive API

La cuenta de servicio debe disponer de:

- lectura de la hoja de clientes;
- lectura de la hoja de productos;
- lectura de la hoja de empleados;
- permisos de escritura en la carpeta de pedidos.

No se utiliza OAuth de usuario.

## Almacenamiento de pedidos

Cada pedido finalizado crea en la carpeta indicada por `GOOGLE_PEDIDOS_FOLDER_ID`:

```
FVAL-YYYYMMDD-HHMMSS.json
FVAL-YYYYMMDD-HHMMSS.pdf
FVAL-YYYYMMDD-HHMMSS.csv
```

El JSON es la representación estructurada del estado actual del pedido. Al cambiar el estado, FVAL actualiza el JSON y regenera PDF y CSV para mantener el archivo consistente.

No se guarda el pedido en ninguna otra base de datos o servicio servidor.

## Estados

Valores permitidos:

- NUEVO
- EN PROCESO
- LISTO
- ENTREGADO

El pedido nuevo comienza siempre en `NUEVO`.

## PDF

El PDF se genera en servidor con texto real, no como captura de pantalla. Incluye pedido, fecha, estado, empleado, cliente, líneas, cantidades y comentarios, y está preparado para impresión A4.

## CSV

CSV UTF-8 con una fila por producto y repetición de los campos generales del pedido.

Columnas:

```
pedido,fecha,estado,id_empleado,empleado,codigo_cliente,cliente,producto,cantidad,comentarios
```

## WhatsApp

No se usa Meta WhatsApp Business API ni servicios de pago.

La aplicación genera enlaces `wa.me` con el mensaje URL-encoded para:

- Nave: `34652388946`
- Puesto: `34690371977`

En móvil se abre el comportamiento normal del dispositivo; en escritorio se puede abrir WhatsApp Web.

## Diagnóstico de Google

Con una sesión FVAL válida, abrir:

```
/api/diagnostic
```

El diagnóstico:

1. lee clientes;
2. lee productos;
3. lee empleados;
4. crea un pequeño archivo temporal en la carpeta de pedidos;
5. borra inmediatamente dicho archivo.

Devuelve únicamente indicadores booleanos. No devuelve secretos ni errores internos de Google.

## Desarrollo

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## Despliegue en Vercel

1. Importar `hubsienda/fval` en Vercel.
2. Configurar todas las variables de entorno en Production.
3. Confirmar que la cuenta de servicio comparte acceso a las tres Sheets y a la carpeta de pedidos.
4. Desplegar.
5. Iniciar sesión en FVAL.
6. Ejecutar `/api/diagnostic`.
7. Crear un pedido real de prueba y verificar PDF, CSV, impresión, WhatsApp e histórico.

## Diseño

La interfaz es mobile-first y prioriza smartphone y tablet:

- controles táctiles grandes;
- autocomplete para clientes y productos;
- entrada numérica rápida;
- líneas de pedido apiladas en smartphone;
- acción principal accesible;
- sin tablas anchas obligatorias;
- sin interacciones que dependan de hover.

El CSS incluye diseño adaptativo para smartphone, tablet y desktop, además de estilos de impresión.
