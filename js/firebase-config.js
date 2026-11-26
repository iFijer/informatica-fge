/* ==========================================================================
   CONFIGURACIÓN DE FIREBASE — SISTEMA DE REGISTRO DE PETICIONES FGE MORELOS
   ==========================================================================
   INSTRUCCIONES RÁPIDAS:
   1. Crea un proyecto gratuito en https://console.firebase.google.com
   2. Activa "Authentication" -> Proveedor "Correo electrónico/contraseña"
   3. Activa "Cloud Firestore" y pega las reglas de firestore.rules
   4. Registra una App Web y pega tus credenciales aquí abajo (o desde
      el Panel Administrador -> pestaña "Firebase y Respaldos").
   
   NOTA: Mientras las llaves estén vacías, el sistema opera automáticamente
   en MODO OFFLINE LOCAL (IndexedDB) 100% funcional para pruebas y uso sin red.
   En cuanto pegues tu firebaseConfig real, activará Firestore con caché
   offline nativa (sincronización automática al recuperar internet) y envío
   real de correos de restablecimiento de contraseña mediante Firebase Auth.
   ========================================================================== */

(function () {
    const DEFAULT_FIREBASE_CONFIG = {
        apiKey: "",
        authDomain: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    };

    const OVERRIDE_KEY = 'fge_firebase_config_override_v1';

    function getActiveFirebaseConfig() {
        try {
            const raw = localStorage.getItem(OVERRIDE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.apiKey && parsed.projectId) {
                    return parsed;
                }
            }
        } catch (e) {
            // Ignorar error de almacenamiento
        }
        return DEFAULT_FIREBASE_CONFIG;
    }

    function isFirebaseConfigured() {
        const cfg = getActiveFirebaseConfig();
        return Boolean(
            cfg &&
            cfg.apiKey &&
            cfg.projectId &&
            !String(cfg.apiKey).startsWith('PEGA_AQUI') &&
            typeof window.firebase !== 'undefined'
        );
    }

    function saveFirebaseConfigOverride(cfg) {
        if (!cfg || !cfg.apiKey || !cfg.projectId) {
            localStorage.removeItem(OVERRIDE_KEY);
            return;
        }
        localStorage.setItem(OVERRIDE_KEY, JSON.stringify({
            apiKey: String(cfg.apiKey || '').trim(),
            authDomain: String(cfg.authDomain || '').trim(),
            projectId: String(cfg.projectId || '').trim(),
            storageBucket: String(cfg.storageBucket || '').trim(),
            messagingSenderId: String(cfg.messagingSenderId || '').trim(),
            appId: String(cfg.appId || '').trim()
        }));
    }

    function clearFirebaseConfigOverride() {
        localStorage.removeItem(OVERRIDE_KEY);
    }

    window.FGE_CONFIG = {
        // Credencial base del administrador (en producción con Firebase se usa su correo registrado en Firebase Auth)
        ADMIN_USERNAME: 'infofge-4724',
        ADMIN_DEFAULT_EMAIL: 'isai.fijer@gmail.com',
        ADMIN_DISPLAY_NAME: 'Administrador Informática FGE',
        // Hash SHA-256 con salt fijo de la contraseña inicial '4724' (solo para arranque offline local)
        ADMIN_BOOTSTRAP_SALT: 'fge_morelos_admin_salt_2026',
        ADMIN_BOOTSTRAP_HASH: '41e3f1366a8f6b898dc31da9cc75f74359232eb15f44bc1b32d73c2b45456e96',
        getActiveFirebaseConfig,
        isFirebaseConfigured,
        saveFirebaseConfigOverride,
        clearFirebaseConfigOverride
    };
})();
