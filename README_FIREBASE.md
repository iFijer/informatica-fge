# Sistema de Registro de Peticiones — Informática Forense (FGE Morelos)

Aplicación web **100% Offline-First** compuesta por tres sitios con la identidad visual institucional de la Fiscalía General del Estado de Morelos:

- **`index.html`** — Inicio de sesión por usuario (nombre de acceso) y contraseña, más recuperación / restablecimiento.
- **`dashboard.html`** — Dashboard de captura y consulta (15 columnas exactas de `LIBRO_INFORMATICA.xlsx`), validación previa al guardado, bloqueo definitivo de entrega de evidencias, corrección con historial de cambios, informes con gráficas y exportación a Excel (`.xlsx`), y edición de perfil (fotografía y contraseña).
- **`admin.html`** — Panel Administrador: control de usuarios con contraseñas ocultas y reseteo por correo, administración y autorización de los 7 listados del dashboard, informes individuales/seleccionados/globales con gráficas en Excel, descarga de toda la base de datos en Excel, historial de auditoría y configuración de Firebase.

---

## 1. Uso Inmediato 100% Offline (Sin configurar nada todavía)

Todas las librerías (`Chart.js`, `ExcelJS`, `Firebase SDK` y la tipografía `Rajdhani`) están incluidas localmente en las carpetas `vendor/` y `assets/fonts/`.

1. Abre **`index.html`** en tu navegador (o sirve la carpeta con un servidor local / Firebase Hosting).
2. Inicia sesión como Administrador:
   - **Usuario:** `infofge-4724`
   - **Contraseña inicial:** `4724`
3. Los 7 listados ya incluyen los catálogos precargados de `LIBRO_INFORMATICA.xlsx`. En la pestaña **Firebase y Respaldos** también puedes cargar opcionalmente los 25 registros de muestra para probar gráficas y exportaciones al instante.

---

## 2. Cómo Conectar Firebase (Multiusuario + Offline + Correo de Reseteo)

Para que múltiples peritos sincronicen datos entre distintas computadoras, trabajen sin internet con sincronización automática y reciban correos reales al resetear contraseña:

### Paso 1: Crear el proyecto en Firebase (Plan Gratuito Spark)
1. Ingresa a [https://console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto (ej. `registro-informatica-fge`).
2. En el menú izquierdo ve a **Compilación → Authentication → Comenzar**:
   - Activa el proveedor **Correo electrónico/contraseña** (`Email/Password`).
   - En la pestaña **Templates (Plantillas)** elige idioma **Español** para que el correo de *"Restablecimiento de contraseña"* llegue en español con el nombre del sistema.
3. En la pestaña **Users (Usuarios)** de Authentication, haz clic en **Agregar usuario** para dar de alta tu cuenta administradora inicial:
   - **Correo:** `infofge-4724@fge-morelos.mx` *(o tu correo institucional; si usas otro, actualiza `ADMIN_DEFAULT_EMAIL` en `js/firebase-config.js`)*.
   - **Contraseña:** *(mínimo 6 caracteres; Firebase exige al menos 6 caracteres por seguridad, por ejemplo `4724fge` o la clave segura que elijas)*.
4. Ve a **Compilación → Firestore Database → Crear base de datos** (en modo producción).
   - Abre la pestaña **Reglas (Rules)**, copia todo el contenido del archivo **`firestore.rules`** de esta carpeta y haz clic en **Publicar**.

### Paso 2: Copiar las credenciales de la App Web
1. Ve a **Configuración del proyecto** (ícono de engrane) → **Tus apps** → ícono web `</>` → registra la app.
2. Copia el objeto `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
3. Tienes **dos opciones** para activarlo:
   - **Opción A (Recomendada para todos los equipos):** Pégalo dentro de `js/firebase-config.js` en `DEFAULT_FIREBASE_CONFIG`.
   - **Opción B (Desde la interfaz):** Entra a `admin.html` → pestaña **Firebase y Respaldos**, pega los 6 campos y presiona **Guardar Configuración y Recargar**.

### Paso 3: Publicar en Firebase Hosting (opcional, habilita PWA 100% Offline)
Si publicas esta carpeta en Firebase Hosting (`firebase deploy --only hosting`), el Service Worker (`sw.js`) guardará automáticamente todo el sitio en caché en cada computadora de la Fiscalía: aunque se caiga el internet, `index.html`, `dashboard.html` y `admin.html` abrirán al instante y sincronizarán los registros pendientes con Firestore en cuanto regrese la conexión.

---

## 3. Reglas de Seguridad e Integridad Implementadas

- **Contraseñas nunca visibles:** El administrador nunca puede ver contraseñas; al presionar **Resetear Contraseña**, Firebase Auth envía un correo directo al usuario para capturar su nueva clave.
- **Validación previa:** Antes de guardar un nuevo registro se muestra un resumen completo de las 15 columnas para confirmación.
- **Bloqueo definitivo de Entrega de Evidencias:** Los campos *Fecha entrega Evidencias* y *Custodio / AIC que recibe evidencia* pueden quedar vacíos al inicio y completarse después **una sola vez**; en cuanto tienen valor, se bloquean de forma permanente (tanto en interfaz como en `firestore.rules`).
- **Historial de cambios inmutable:** Si se requiere corregir un campo obligatorio ya guardado, se exige un **motivo** y cada campo modificado se guarda de forma permanente en `audit_logs` (solo lectura / sin borrado).
- **Alta manual con autorización:** Si un usuario escribe un elemento que no existe en alguno de los 7 listados, se adjunta a la lista como `Pendiente` y aparece en el Panel Administrador para ser autorizado, editado/corregido o rechazado.
