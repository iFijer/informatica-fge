/* ==========================================================================
   CAPA DE BASE DE DATOS Y AUTENTICACIÓN HÍBRIDA (100% OFFLINE-FIRST)
   Soporta:
     1) Firebase (Auth + Cloud Firestore con persistencia offline IndexedDB)
     2) Modo Offline Local (IndexedDB nativo) cuando aún no se configura Firebase
   ========================================================================== */

(function () {
    const IDB_NAME = 'FGE_Informatica_Registro_DB_v1';
    const IDB_VERSION = 1;
    const SESSION_KEY = 'fge_active_session_v1';
    const STORES = ['users', 'catalog_items', 'records', 'audit_logs', 'meta'];

    let activeMode = 'local'; // 'firebase' | 'local'
    let idb = null;
    let fbApp = null;
    let fbAuth = null;
    let fbDb = null;
    let currentUserCache = null;
    let initialized = false;

    // ======================================================================
    // 1. SHA-256 PURO EN JS (Funciona en HTTPS, HTTP y file:// 100% Offline)
    // ======================================================================
    function sha256Hex(ascii) {
        const str = unescape(encodeURIComponent(String(ascii)));
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        const mathPow = Math.pow;
        const maxWord = mathPow(2, 32);
        let result = '';
        const words = [];
        const asciiBitLength = str.length * 8;
        const hash = [];
        const k = [];
        let primeCounter = 0;
        const isComposite = {};
        for (let candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
                hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }
        let s = str + '\x80';
        while ((s.length % 64) - 56) s += '\x00';
        for (let i = 0; i < s.length; i++) {
            const j = s.charCodeAt(i);
            words[i >> 2] |= j << (((3 - i) % 4) * 8);
        }
        words[words.length] = (asciiBitLength / maxWord) | 0;
        words[words.length] = asciiBitLength;

        for (let j = 0; j < words.length;) {
            const w = words.slice(j, (j += 16));
            const oldHash = hash.slice(0);
            for (let i = 0; i < 64; i++) {
                const w15 = w[i - 15], w2 = w[i - 2];
                const a = hash[0], e = hash[4];
                const temp1 = hash[7]
                    + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
                    + ((e & hash[5]) ^ ((~e) & hash[6]))
                    + k[i]
                    + (w[i] = (i < 16) ? w[i] : (
                        w[i - 16]
                        + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
                        + w[i - 7]
                        + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                    ) | 0);
                const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
                    + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
                hash.unshift((temp1 + temp2) | 0);
                hash[4] = (hash[4] + temp1) | 0;
                hash.pop();
            }
            for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
        }
        for (let i = 0; i < 8; i++) {
            for (let j = 3; j + 1; j--) {
                const b = (hash[i] >> (j * 8)) & 255;
                result += ((b < 16) ? '0' : '') + b.toString(16);
            }
        }
        return result;
    }

    function generateId(prefix = 'id') {
        const rand = Math.random().toString(36).slice(2, 10);
        const ts = Date.now().toString(36);
        return `${prefix}_${ts}_${rand}`;
    }

    function generateToken(len = 28) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let out = '';
        if (window.crypto && window.crypto.getRandomValues) {
            const arr = new Uint32Array(len);
            window.crypto.getRandomValues(arr);
            for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
        } else {
            for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
        }
        return out;
    }

    function hashPassword(password, salt) {
        return sha256Hex(`${salt}:${password}`);
    }

    function sanitizeUser(u) {
        if (!u) return null;
        return {
            id: u.id,
            fullName: u.fullName || '',
            username: u.username || '',
            usernameLower: (u.usernameLower || u.username || '').toLowerCase(),
            email: u.email || '',
            role: u.role === 'admin' ? 'admin' : 'user',
            photoDataUrl: u.photoDataUrl || '',
            active: u.active !== false,
            mustResetPassword: Boolean(u.mustResetPassword),
            resetRequestedAt: u.resetRequestedAt || '',
            createdAt: u.createdAt || '',
            updatedAt: u.updatedAt || ''
        };
    }

    function normalizeForCompare(str) {
        return String(str || '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    }

    // ======================================================================
    // 2. INDEXEDDB LOCAL (Persistencia 100% Offline)
    // ======================================================================
    function openLocalDB() {
        return new Promise((resolve, reject) => {
            if (idb) {
                resolve(idb);
                return;
            }
            const req = indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                STORES.forEach((storeName) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id' });
                    }
                });
            };
            req.onsuccess = (e) => {
                idb = e.target.result;
                resolve(idb);
            };
            req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB local.'));
        });
    }

    async function idbGetAll(storeName) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbGet(storeName, id) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbPut(storeName, obj) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(obj);
            tx.oncomplete = () => resolve(obj);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbDelete(storeName, id) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbClear(storeName) {
        const db = await openLocalDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function seedLocalIfEmpty() {
        const existingUsers = await idbGetAll('users');
        const cfg = window.FGE_CONFIG;
        const now = new Date().toISOString();

        // Asegurar cuenta administrador inicial infofge-4724 / 4724 (almacenada como hash SHA-256)
        const adminExists = existingUsers.some(u => u.usernameLower === cfg.ADMIN_USERNAME.toLowerCase());
        if (!adminExists) {
            await idbPut('users', {
                id: 'admin_infofge_4724',
                fullName: cfg.ADMIN_DISPLAY_NAME,
                username: cfg.ADMIN_USERNAME,
                usernameLower: cfg.ADMIN_USERNAME.toLowerCase(),
                email: cfg.ADMIN_DEFAULT_EMAIL,
                role: 'admin',
                photoDataUrl: '',
                active: true,
                salt: cfg.ADMIN_BOOTSTRAP_SALT,
                passwordHash: cfg.ADMIN_BOOTSTRAP_HASH,
                mustResetPassword: false,
                createdAt: now,
                updatedAt: now
            });
        }

        // Sembrar los 7 catálogos oficiales de LIBRO_INFORMATICA.xlsx si están vacíos
        const existingCats = await idbGetAll('catalog_items');
        if (existingCats.length === 0 && window.FGE_SEED && window.FGE_SEED.INITIAL_CATALOGS) {
            const initCats = window.FGE_SEED.INITIAL_CATALOGS;
            for (const category of Object.keys(initCats)) {
                const values = initCats[category] || [];
                for (let idx = 0; idx < values.length; idx++) {
                    const value = String(values[idx]).trim();
                    if (!value) continue;
                    await idbPut('catalog_items', {
                        id: `cat_${category}_${idx + 1}`,
                        category,
                        value,
                        valueNormalized: normalizeForCompare(value),
                        status: 'approved',
                        addedByUserId: 'admin_infofge_4724',
                        addedByName: cfg.ADMIN_DISPLAY_NAME,
                        createdAt: now,
                        approvedAt: now
                    });
                }
            }
        }
    }

    // ======================================================================
    // 3. INICIALIZACIÓN DE FIREBASE (Con persistencia offline Firestore)
    // ======================================================================
    async function initFirebaseIfConfigured() {
        if (!window.FGE_CONFIG || !window.FGE_CONFIG.isFirebaseConfigured()) {
            return false;
        }
        try {
            const fbCfg = window.FGE_CONFIG.getActiveFirebaseConfig();
            fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(fbCfg);
            fbAuth = fbApp.auth();
            fbDb = fbApp.firestore();

            // Activar persistencia offline de Firestore (IndexedDB nativa de Firebase)
            try {
                await fbDb.enablePersistence({ synchronizeTabs: true });
            } catch (err) {
                // failed-precondition (varias pestañas) o unimplemented — Firestore sigue operando
                console.warn('Persistencia offline Firestore aviso:', err.code || err.message);
            }

            try {
                await fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            } catch (e) {
                // Continuar con persistencia por defecto
            }

            activeMode = 'firebase';
            return true;
        } catch (err) {
            console.error('Error al inicializar Firebase, usando modo local offline:', err);
            activeMode = 'local';
            return false;
        }
    }

    async function seedFirebaseCatalogsIfEmpty() {
        if (activeMode !== 'firebase' || !fbDb) return;
        try {
            const snap = await fbDb.collection('catalog_items').limit(1).get();
            if (!snap.empty) return;
            if (!window.FGE_SEED || !window.FGE_SEED.INITIAL_CATALOGS) return;

            const batch = fbDb.batch();
            const now = new Date().toISOString();
            const initCats = window.FGE_SEED.INITIAL_CATALOGS;
            for (const category of Object.keys(initCats)) {
                const values = initCats[category] || [];
                values.forEach((v, idx) => {
                    const value = String(v).trim();
                    if (!value) return;
                    const docId = `cat_${category}_${idx + 1}`;
                    batch.set(fbDb.collection('catalog_items').doc(docId), {
                        id: docId,
                        category,
                        value,
                        valueNormalized: normalizeForCompare(value),
                        status: 'approved',
                        addedByUserId: currentUserCache ? currentUserCache.id : 'system',
                        addedByName: currentUserCache ? currentUserCache.fullName : 'Sistema FGE',
                        createdAt: now,
                        approvedAt: now
                    });
                });
            }
            await batch.commit();
        } catch (e) {
            console.warn('No se pudieron sembrar catálogos iniciales en Firestore (revisa permisos):', e.message);
        }
    }

    // ======================================================================
    // 4. INICIALIZACIÓN GENERAL Y SESIÓN
    // ======================================================================
    function saveLocalSession(userObj) {
        if (!userObj) {
            localStorage.removeItem(SESSION_KEY);
            return;
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: userObj.id,
            username: userObj.username,
            role: userObj.role,
            cachedProfile: sanitizeUser(userObj),
            savedAt: Date.now()
        }));
    }

    function readLocalSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function init() {
        if (initialized) {
            return { mode: activeMode, user: currentUserCache };
        }
        await openLocalDB();
        await seedLocalIfEmpty();

        const fbOk = await initFirebaseIfConfigured();
        if (fbOk) {
            // Esperar a que Firebase Auth restaure el estado de sesión (funciona también offline)
            const fbUser = await new Promise((resolve) => {
                const unsub = fbAuth.onAuthStateChanged((u) => {
                    unsub();
                    resolve(u);
                });
            });
            if (fbUser) {
                try {
                    const doc = await fbDb.collection('users').doc(fbUser.uid).get();
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.active !== false) {
                            currentUserCache = sanitizeUser({ id: doc.id, ...data });
                            saveLocalSession(currentUserCache);
                        } else {
                            await fbAuth.signOut();
                            currentUserCache = null;
                            saveLocalSession(null);
                        }
                    } else {
                        // Autoconfigurar perfil del primer admin si coincide con correo/nombre admin
                        const isBootstrapAdmin = (fbUser.email || '').toLowerCase() === window.FGE_CONFIG.ADMIN_DEFAULT_EMAIL.toLowerCase();
                        const profile = {
                            id: fbUser.uid,
                            fullName: isBootstrapAdmin ? window.FGE_CONFIG.ADMIN_DISPLAY_NAME : (fbUser.displayName || fbUser.email.split('@')[0]),
                            username: isBootstrapAdmin ? window.FGE_CONFIG.ADMIN_USERNAME : fbUser.email.split('@')[0],
                            usernameLower: (isBootstrapAdmin ? window.FGE_CONFIG.ADMIN_USERNAME : fbUser.email.split('@')[0]).toLowerCase(),
                            email: fbUser.email,
                            role: isBootstrapAdmin ? 'admin' : 'user',
                            photoDataUrl: '',
                            active: true,
                            mustResetPassword: false,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        await fbDb.collection('users').doc(fbUser.uid).set(profile, { merge: true });
                        await fbDb.collection('username_lookup').doc(profile.usernameLower).set({
                            email: profile.email,
                            userId: fbUser.uid,
                            active: true
                        });
                        currentUserCache = sanitizeUser(profile);
                        saveLocalSession(currentUserCache);
                    }
                    if (currentUserCache && currentUserCache.role === 'admin') {
                        await seedFirebaseCatalogsIfEmpty();
                    }
                } catch (e) {
                    const saved = readLocalSession();
                    if (saved && saved.cachedProfile && saved.userId === fbUser.uid) {
                        currentUserCache = sanitizeUser(saved.cachedProfile);
                    }
                }
            } else {
                currentUserCache = null;
                saveLocalSession(null);
            }
        } else {
            const saved = readLocalSession();
            if (saved && saved.userId) {
                const user = await idbGet('users', saved.userId);
                if (user && user.active !== false) {
                    currentUserCache = sanitizeUser(user);
                } else {
                    saveLocalSession(null);
                    currentUserCache = null;
                }
            }
        }

        initialized = true;
        return { mode: activeMode, user: currentUserCache };
    }

    function getMode() {
        return activeMode;
    }

    function getCurrentUser() {
        return currentUserCache ? { ...currentUserCache } : null;
    }

    // ======================================================================
    // 5. AUTENTICACIÓN, RESETEO DE CONTRASEÑA Y PERFIL
    // ======================================================================
    async function login(usernameOrEmail, password) {
        await init();
        const identifier = String(usernameOrEmail || '').trim();
        const pwd = String(password || '');
        if (!identifier || !pwd) {
            throw new Error('Ingresa tu usuario y contraseña.');
        }

        if (activeMode === 'firebase') {
            let emailToUse = identifier;
            if (!identifier.includes('@')) {
                const lower = identifier.toLowerCase();
                if (lower === window.FGE_CONFIG.ADMIN_USERNAME.toLowerCase()) {
                    const lookDoc = await fbDb.collection('username_lookup').doc(lower).get();
                    emailToUse = lookDoc.exists ? lookDoc.data().email : window.FGE_CONFIG.ADMIN_DEFAULT_EMAIL;
                } else {
                    const lookDoc = await fbDb.collection('username_lookup').doc(lower).get();
                    if (!lookDoc.exists) {
                        throw new Error('Usuario no encontrado. Verifica tu nombre de acceso.');
                    }
                    const lData = lookDoc.data();
                    if (lData.active === false) {
                        throw new Error('Tu cuenta se encuentra desactivada. Contacta al administrador.');
                    }
                    emailToUse = lData.email;
                }
            }

            let cred;
            try {
                cred = await fbAuth.signInWithEmailAndPassword(emailToUse, pwd);
            } catch (err) {
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
                    throw new Error('Usuario o contraseña incorrectos.');
                }
                if (err.code === 'auth/network-request-failed') {
                    throw new Error('Sin conexión a internet para autenticar contra Firebase. Una vez iniciada la sesión, el sistema funciona offline.');
                }
                throw new Error(err.message || 'No se pudo iniciar sesión en Firebase.');
            }

            const uid = cred.user.uid;
            const userDoc = await fbDb.collection('users').doc(uid).get();
            let profile;
            if (userDoc.exists) {
                profile = { id: uid, ...userDoc.data() };
                if (profile.active === false) {
                    await fbAuth.signOut();
                    throw new Error('Esta cuenta está desactivada. Contacta al administrador.');
                }
                if (profile.mustResetPassword) {
                    await fbDb.collection('users').doc(uid).update({
                        mustResetPassword: false,
                        updatedAt: new Date().toISOString()
                    });
                    profile.mustResetPassword = false;
                }
            } else {
                const isBootstrapAdmin = emailToUse.toLowerCase() === window.FGE_CONFIG.ADMIN_DEFAULT_EMAIL.toLowerCase()
                    || identifier.toLowerCase() === window.FGE_CONFIG.ADMIN_USERNAME.toLowerCase();
                profile = {
                    id: uid,
                    fullName: isBootstrapAdmin ? window.FGE_CONFIG.ADMIN_DISPLAY_NAME : emailToUse.split('@')[0],
                    username: isBootstrapAdmin ? window.FGE_CONFIG.ADMIN_USERNAME : emailToUse.split('@')[0],
                    usernameLower: (isBootstrapAdmin ? window.FGE_CONFIG.ADMIN_USERNAME : emailToUse.split('@')[0]).toLowerCase(),
                    email: emailToUse,
                    role: isBootstrapAdmin ? 'admin' : 'user',
                    photoDataUrl: '',
                    active: true,
                    mustResetPassword: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await fbDb.collection('users').doc(uid).set(profile);
                await fbDb.collection('username_lookup').doc(profile.usernameLower).set({
                    email: profile.email,
                    userId: uid,
                    active: true
                });
            }

            currentUserCache = sanitizeUser(profile);
            saveLocalSession(currentUserCache);
            if (currentUserCache.role === 'admin') {
                await seedFirebaseCatalogsIfEmpty();
            }
            return currentUserCache;
        }

        // MODO OFFLINE LOCAL (IndexedDB)
        const users = await idbGetAll('users');
        const lower = identifier.toLowerCase();
        const found = users.find(u =>
            (u.usernameLower && u.usernameLower === lower) ||
            (u.email && u.email.toLowerCase() === lower)
        );
        if (!found) {
            throw new Error('Usuario o contraseña incorrectos.');
        }
        if (found.active === false) {
            throw new Error('Esta cuenta está desactivada. Contacta al administrador.');
        }
        if (found.mustResetPassword && found.resetToken) {
            throw new Error('Tu contraseña fue reseteada por el administrador. Utiliza el enlace de restablecimiento enviado a tu correo.');
        }
        const computed = hashPassword(pwd, found.salt || '');
        if (computed !== found.passwordHash) {
            throw new Error('Usuario o contraseña incorrectos.');
        }

        currentUserCache = sanitizeUser(found);
        saveLocalSession(currentUserCache);
        return currentUserCache;
    }

    async function logout() {
        if (activeMode === 'firebase' && fbAuth) {
            try { await fbAuth.signOut(); } catch (e) {}
        }
        currentUserCache = null;
        saveLocalSession(null);
    }

    async function requireSession({ adminOnly = false } = {}) {
        await init();
        if (!currentUserCache) {
            window.location.href = 'index.html';
            return null;
        }
        if (adminOnly && currentUserCache.role !== 'admin') {
            window.location.href = 'dashboard.html';
            return null;
        }
        return currentUserCache;
    }

    async function adminTriggerPasswordReset(userId) {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede resetear contraseñas.');
        }
        const now = new Date().toISOString();

        if (activeMode === 'firebase') {
            const doc = await fbDb.collection('users').doc(userId).get();
            if (!doc.exists) throw new Error('Usuario no encontrado.');
            const u = doc.data();
            if (!u.email) throw new Error('El usuario no tiene un correo electrónico registrado.');
            fbAuth.languageCode = 'es';
            await fbAuth.sendPasswordResetEmail(u.email);
            await fbDb.collection('users').doc(userId).update({
                mustResetPassword: true,
                resetRequestedAt: now,
                updatedAt: now
            });
            return {
                mode: 'firebase',
                email: u.email,
                fullName: u.fullName
            };
        }

        // Modo local offline: invalida contraseña actual y genera enlace de restablecimiento por token
        const user = await idbGet('users', userId);
        if (!user) throw new Error('Usuario no encontrado.');
        if (!user.email) throw new Error('El usuario no tiene correo electrónico registrado.');

        const token = generateToken(30);
        user.mustResetPassword = true;
        user.resetToken = token;
        user.resetRequestedAt = now;
        user.updatedAt = now;
        await idbPut('users', user);

        const baseUrl = window.location.href.replace(/[^/]*$/, 'index.html');
        const resetUrl = `${baseUrl}?resetToken=${encodeURIComponent(token)}`;
        const subject = encodeURIComponent('Restablecimiento de contraseña — Sistema Registro Informática FGE');
        const body = encodeURIComponent(
            `Hola ${user.fullName},\n\n` +
            `El administrador ha solicitado el restablecimiento de tu contraseña para el Sistema de Registro de Peticiones de Informática Forense (FGE Morelos).\n\n` +
            `Usuario de acceso: ${user.username}\n` +
            `Ingresa al siguiente enlace para capturar tu nueva contraseña:\n${resetUrl}\n\n` +
            `Nota: Si el sistema ya está conectado a Firebase, recibirás además el enlace oficial directo desde Firebase Authentication.`
        );
        const mailtoUrl = `mailto:${encodeURIComponent(user.email)}?subject=${subject}&body=${body}`;

        return {
            mode: 'local',
            email: user.email,
            fullName: user.fullName,
            resetToken: token,
            resetUrl,
            mailtoUrl
        };
    }

    async function requestPasswordResetSelf(usernameOrEmail) {
        await init();
        const id = String(usernameOrEmail || '').trim();
        if (!id) throw new Error('Ingresa tu usuario o correo electrónico.');

        if (activeMode === 'firebase') {
            let email = id;
            if (!id.includes('@')) {
                const look = await fbDb.collection('username_lookup').doc(id.toLowerCase()).get();
                if (!look.exists) throw new Error('No se encontró ninguna cuenta con ese nombre de acceso.');
                email = look.data().email;
            }
            fbAuth.languageCode = 'es';
            await fbAuth.sendPasswordResetEmail(email);
            return { mode: 'firebase', email };
        }

        throw new Error('En modo offline local sin Firebase, solicita al administrador que presione "Resetear contraseña" para generar tu enlace de restablecimiento.');
    }

    async function validateResetToken(token) {
        await init();
        if (!token || activeMode === 'firebase') return null;
        const users = await idbGetAll('users');
        const found = users.find(u => u.resetToken && u.resetToken === token);
        return found ? sanitizeUser(found) : null;
    }

    async function completeLocalPasswordReset(token, newPassword) {
        await init();
        const pwd = String(newPassword || '');
        if (pwd.length < 4) {
            throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
        }
        const users = await idbGetAll('users');
        const found = users.find(u => u.resetToken && u.resetToken === token);
        if (!found) {
            throw new Error('El enlace de restablecimiento no es válido o ya fue utilizado.');
        }
        const newSalt = generateToken(16);
        found.salt = newSalt;
        found.passwordHash = hashPassword(pwd, newSalt);
        found.mustResetPassword = false;
        found.resetToken = '';
        found.updatedAt = new Date().toISOString();
        await idbPut('users', found);
        return sanitizeUser(found);
    }

    async function updateOwnProfile({ photoDataUrl }) {
        await init();
        if (!currentUserCache) throw new Error('No hay sesión activa.');
        const now = new Date().toISOString();

        if (activeMode === 'firebase') {
            await fbDb.collection('users').doc(currentUserCache.id).update({
                photoDataUrl: photoDataUrl || '',
                updatedAt: now
            });
            currentUserCache.photoDataUrl = photoDataUrl || '';
            currentUserCache.updatedAt = now;
            saveLocalSession(currentUserCache);
            return currentUserCache;
        }

        const user = await idbGet('users', currentUserCache.id);
        if (!user) throw new Error('Usuario no encontrado.');
        user.photoDataUrl = photoDataUrl || '';
        user.updatedAt = now;
        await idbPut('users', user);
        currentUserCache = sanitizeUser(user);
        saveLocalSession(currentUserCache);
        return currentUserCache;
    }

    async function updateOwnPassword(currentPassword, newPassword) {
        await init();
        if (!currentUserCache) throw new Error('No hay sesión activa.');
        const cur = String(currentPassword || '');
        const next = String(newPassword || '');
        const minLen = activeMode === 'firebase' ? 6 : 4;
        if (next.length < minLen) {
            throw new Error(`La nueva contraseña debe tener al menos ${minLen} caracteres.`);
        }

        if (activeMode === 'firebase') {
            const fbUser = fbAuth.currentUser;
            if (!fbUser || !fbUser.email) {
                throw new Error('Sesión de Firebase no disponible para cambiar contraseña.');
            }
            const cred = firebase.auth.EmailAuthProvider.credential(fbUser.email, cur);
            try {
                await fbUser.reauthenticateWithCredential(cred);
            } catch (e) {
                throw new Error('La contraseña actual es incorrecta.');
            }
            await fbUser.updatePassword(next);
            await fbDb.collection('users').doc(currentUserCache.id).update({
                mustResetPassword: false,
                updatedAt: new Date().toISOString()
            });
            return true;
        }

        const user = await idbGet('users', currentUserCache.id);
        if (!user) throw new Error('Usuario no encontrado.');
        if (hashPassword(cur, user.salt || '') !== user.passwordHash) {
            throw new Error('La contraseña actual es incorrecta.');
        }
        const newSalt = generateToken(16);
        user.salt = newSalt;
        user.passwordHash = hashPassword(next, newSalt);
        user.mustResetPassword = false;
        user.resetToken = '';
        user.updatedAt = new Date().toISOString();
        await idbPut('users', user);
        return true;
    }

    // ======================================================================
    // 6. GESTIÓN DE USUARIOS (PANEL ADMINISTRADOR)
    // ======================================================================
    async function getUsers() {
        await init();
        if (activeMode === 'firebase') {
            const snap = await fbDb.collection('users').get();
            return snap.docs
                .map(d => sanitizeUser({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : a.fullName.localeCompare(b.fullName, 'es')));
        }
        const list = await idbGetAll('users');
        return list
            .map(sanitizeUser)
            .sort((a, b) => (a.role === 'admin' ? -1 : b.role === 'admin' ? 1 : a.fullName.localeCompare(b.fullName, 'es')));
    }

    async function createUser({ fullName, username, email, password, photoDataUrl = '', sendResetEmailOnCreate = false }) {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede crear usuarios.');
        }
        const cleanName = String(fullName || '').trim();
        const cleanUsername = String(username || '').trim();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPwd = String(password || '');

        if (!cleanName || !cleanUsername || !cleanEmail) {
            throw new Error('Nombre completo, nombre de acceso y correo electrónico son obligatorios.');
        }
        if (/\s/.test(cleanUsername)) {
            throw new Error('El nombre de acceso no debe contener espacios.');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            throw new Error('Ingresa un correo electrónico válido.');
        }
        const minLen = activeMode === 'firebase' ? 6 : 4;
        if (cleanPwd.length < minLen) {
            throw new Error(`La contraseña inicial debe tener al menos ${minLen} caracteres.`);
        }

        const existingUsers = await getUsers();
        const lowerUser = cleanUsername.toLowerCase();
        if (existingUsers.some(u => u.usernameLower === lowerUser)) {
            throw new Error(`El nombre de acceso "${cleanUsername}" ya está registrado.`);
        }
        if (existingUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
            throw new Error(`El correo electrónico "${cleanEmail}" ya está registrado.`);
        }

        const now = new Date().toISOString();

        if (activeMode === 'firebase') {
            // Usar instancia secundaria de Firebase para crear el usuario SIN cerrar la sesión del admin
            const secName = 'AdminUserCreator_' + Date.now();
            const secApp = firebase.initializeApp(window.FGE_CONFIG.getActiveFirebaseConfig(), secName);
            const secAuth = secApp.auth();
            let uid;
            try {
                const cred = await secAuth.createUserWithEmailAndPassword(cleanEmail, cleanPwd);
                uid = cred.user.uid;
                if (sendResetEmailOnCreate) {
                    secAuth.languageCode = 'es';
                    await secAuth.sendPasswordResetEmail(cleanEmail);
                }
                await secAuth.signOut();
            } finally {
                await secApp.delete().catch(() => {});
            }

            const profile = {
                id: uid,
                fullName: cleanName,
                username: cleanUsername,
                usernameLower: lowerUser,
                email: cleanEmail,
                role: 'user',
                photoDataUrl: photoDataUrl || '',
                active: true,
                mustResetPassword: Boolean(sendResetEmailOnCreate),
                createdAt: now,
                updatedAt: now
            };
            await fbDb.collection('users').doc(uid).set(profile);
            await fbDb.collection('username_lookup').doc(lowerUser).set({
                email: cleanEmail,
                userId: uid,
                active: true
            });
            return sanitizeUser(profile);
        }

        // Modo local offline (guarda SOLO hash con salt, jamás contraseña visible)
        const salt = generateToken(16);
        const newUser = {
            id: generateId('usr'),
            fullName: cleanName,
            username: cleanUsername,
            usernameLower: lowerUser,
            email: cleanEmail,
            role: 'user',
            photoDataUrl: photoDataUrl || '',
            active: true,
            salt,
            passwordHash: hashPassword(cleanPwd, salt),
            mustResetPassword: false,
            resetToken: '',
            createdAt: now,
            updatedAt: now
        };
        await idbPut('users', newUser);
        return sanitizeUser(newUser);
    }

    async function updateUser(userId, { fullName, username, email, photoDataUrl, active }) {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede editar usuarios.');
        }
        const allUsers = await getUsers();
        const target = allUsers.find(u => u.id === userId);
        if (!target) throw new Error('Usuario no encontrado.');

        const cleanName = String(fullName || '').trim();
        const cleanUsername = String(username || '').trim();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const lowerUser = cleanUsername.toLowerCase();

        if (!cleanName || !cleanUsername || !cleanEmail) {
            throw new Error('Nombre completo, nombre de acceso y correo son obligatorios.');
        }
        if (allUsers.some(u => u.id !== userId && u.usernameLower === lowerUser)) {
            throw new Error(`El nombre de acceso "${cleanUsername}" ya está en uso.`);
        }
        if (allUsers.some(u => u.id !== userId && (u.email || '').toLowerCase() === cleanEmail)) {
            throw new Error(`El correo "${cleanEmail}" ya está en uso.`);
        }

        const isMainAdmin = target.role === 'admin' && target.usernameLower === window.FGE_CONFIG.ADMIN_USERNAME.toLowerCase();
        const nextActive = isMainAdmin ? true : (active !== false);
        const now = new Date().toISOString();

        if (activeMode === 'firebase') {
            if (target.usernameLower !== lowerUser) {
                await fbDb.collection('username_lookup').doc(target.usernameLower).delete().catch(() => {});
            }
            const patch = {
                fullName: cleanName,
                username: cleanUsername,
                usernameLower: lowerUser,
                email: cleanEmail,
                active: nextActive,
                updatedAt: now
            };
            if (photoDataUrl !== undefined) patch.photoDataUrl = photoDataUrl;
            await fbDb.collection('users').doc(userId).update(patch);
            await fbDb.collection('username_lookup').doc(lowerUser).set({
                email: cleanEmail,
                userId,
                active: nextActive
            });
            return sanitizeUser({ ...target, ...patch });
        }

        const stored = await idbGet('users', userId);
        stored.fullName = cleanName;
        stored.username = cleanUsername;
        stored.usernameLower = lowerUser;
        stored.email = cleanEmail;
        stored.active = nextActive;
        if (photoDataUrl !== undefined) stored.photoDataUrl = photoDataUrl;
        stored.updatedAt = now;
        await idbPut('users', stored);
        return sanitizeUser(stored);
    }

    async function deleteUser(userId) {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede eliminar usuarios.');
        }
        const allUsers = await getUsers();
        const target = allUsers.find(u => u.id === userId);
        if (!target) return;
        if (target.role === 'admin') {
            throw new Error('No se puede eliminar la cuenta del administrador.');
        }

        if (activeMode === 'firebase') {
            await fbDb.collection('username_lookup').doc(target.usernameLower).delete().catch(() => {});
            await fbDb.collection('users').doc(userId).delete();
            return;
        }
        await idbDelete('users', userId);
    }

    // ======================================================================
    // 7. CATÁLOGOS (7 LISTADOS + ALTA MANUAL + AUTORIZACIÓN ADMIN)
    // ======================================================================
    async function getCatalogs() {
        await init();
        let items;
        if (activeMode === 'firebase') {
            const snap = await fbDb.collection('catalog_items').get();
            items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            items = await idbGetAll('catalog_items');
        }

        items.sort((a, b) => String(a.value || '').localeCompare(String(b.value || ''), 'es', { sensitivity: 'base' }));

        const byCategory = {};
        (window.FGE_SEED ? window.FGE_SEED.CATALOG_META : []).forEach(m => {
            byCategory[m.key] = [];
        });
        const pendingItems = [];

        items.forEach(item => {
            if (!byCategory[item.category]) byCategory[item.category] = [];
            byCategory[item.category].push(item);
            if (item.status === 'pending') pendingItems.push(item);
        });

        return { allItems: items, byCategory, pendingItems };
    }

    async function addCatalogItem(category, rawValue, { asApproved = false } = {}) {
        await init();
        const cleanVal = String(rawValue || '').trim().toUpperCase();
        if (!cleanVal) throw new Error('El valor no puede estar vacío.');
        const norm = normalizeForCompare(cleanVal);

        const { byCategory } = await getCatalogs();
        const list = byCategory[category] || [];
        const existing = list.find(i => normalizeForCompare(i.value) === norm);
        if (existing) {
            return existing;
        }

        const isAdmin = currentUserCache && currentUserCache.role === 'admin';
        const status = (asApproved && isAdmin) ? 'approved' : 'pending';
        const now = new Date().toISOString();
        const newItem = {
            id: generateId('cat'),
            category,
            value: cleanVal,
            valueNormalized: norm,
            status,
            addedByUserId: currentUserCache ? currentUserCache.id : 'system',
            addedByName: currentUserCache ? currentUserCache.fullName : 'Usuario',
            createdAt: now,
            approvedAt: status === 'approved' ? now : ''
        };

        if (activeMode === 'firebase') {
            await fbDb.collection('catalog_items').doc(newItem.id).set(newItem);
        } else {
            await idbPut('catalog_items', newItem);
        }
        return newItem;
    }

    async function propagateCatalogRenameToRecords(category, oldValue, newValue) {
        const meta = (window.FGE_SEED ? window.FGE_SEED.CATALOG_META : []).find(m => m.key === category);
        if (!meta || !oldValue || !newValue || oldValue === newValue) return 0;
        const field = meta.field;
        const records = await getRecords();
        const oldNorm = normalizeForCompare(oldValue);
        const affected = records.filter(r => normalizeForCompare(r[field]) === oldNorm);
        const now = new Date().toISOString();

        for (const rec of affected) {
            const patch = { [field]: newValue, updatedAt: now };
            if (activeMode === 'firebase') {
                await fbDb.collection('records').doc(rec.id).update(patch);
            } else {
                const full = await idbGet('records', rec.id);
                if (full) {
                    full[field] = newValue;
                    full.updatedAt = now;
                    await idbPut('records', full);
                }
            }
        }
        return affected.length;
    }

    async function approveCatalogItem(itemId, { editedValue = '', propagateToRecords = true } = {}) {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede autorizar elementos de lista.');
        }
        const { allItems } = await getCatalogs();
        const item = allItems.find(i => i.id === itemId);
        if (!item) throw new Error('Elemento no encontrado.');

        const finalVal = String(editedValue || item.value).trim().toUpperCase();
        if (!finalVal) throw new Error('El texto del elemento no puede estar vacío.');
        const finalNorm = normalizeForCompare(finalVal);
        const now = new Date().toISOString();

        // Revisar si ya existe otro elemento aprobado con el mismo nombre
        const duplicate = allItems.find(i => i.id !== itemId && i.category === item.category && normalizeForCompare(i.value) === finalNorm);
        let updatedRecords = 0;

        if (propagateToRecords && item.value !== finalVal) {
            updatedRecords = await propagateCatalogRenameToRecords(item.category, item.value, finalVal);
        }

        if (duplicate) {
            // Fusionar con el elemento ya existente y eliminar el pendiente duplicado
            if (activeMode === 'firebase') {
                await fbDb.collection('catalog_items').doc(itemId).delete();
            } else {
                await idbDelete('catalog_items', itemId);
            }
            return { merged: true, value: duplicate.value, updatedRecords };
        }

        const updated = {
            ...item,
            value: finalVal,
            valueNormalized: finalNorm,
            status: 'approved',
            approvedBy: currentUserCache.fullName,
            approvedAt: now
        };
        if (activeMode === 'firebase') {
            await fbDb.collection('catalog_items').doc(itemId).set(updated, { merge: true });
        } else {
            await idbPut('catalog_items', updated);
        }
        return { merged: false, item: updated, updatedRecords };
    }

    async function updateCatalogItem(itemId, newValue, { propagateToRecords = true } = {}) {
        return approveCatalogItem(itemId, { editedValue: newValue, propagateToRecords });
    }

    async function rejectCatalogItem(itemId, { mergeIntoValue = '' } = {}) {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede eliminar o rechazar elementos.');
        }
        const { allItems } = await getCatalogs();
        const item = allItems.find(i => i.id === itemId);
        if (!item) return { updatedRecords: 0 };

        let updatedRecords = 0;
        if (mergeIntoValue && mergeIntoValue.trim()) {
            updatedRecords = await propagateCatalogRenameToRecords(item.category, item.value, mergeIntoValue.trim().toUpperCase());
        }

        if (activeMode === 'firebase') {
            await fbDb.collection('catalog_items').doc(itemId).delete();
        } else {
            await idbDelete('catalog_items', itemId);
        }
        return { updatedRecords };
    }

    // ======================================================================
    // 8. REGISTROS DE PETICIONES (15 COLUMNAS + BLOQUEO + AUDITORÍA)
    // ======================================================================
    async function getRecords() {
        await init();
        let list;
        if (activeMode === 'firebase') {
            const snap = await fbDb.collection('records').get();
            list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            list = await idbGetAll('records');
        }
        // Siempre ordenados del más reciente / consecutivo mayor hasta arriba
        list.sort((a, b) => {
            const diffNum = (Number(b.numero) || 0) - (Number(a.numero) || 0);
            if (diffNum !== 0) return diffNum;
            return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
        return list;
    }

    async function getNextRecordNumber() {
        const records = await getRecords();
        let maxNum = 0;
        records.forEach(r => {
            const n = parseInt(r.numero, 10);
            if (!isNaN(n) && n > maxNum) maxNum = n;
        });
        return maxNum + 1;
    }

    async function allocateConsecutiveNumber() {
        if (activeMode === 'firebase' && navigator.onLine) {
            try {
                const counterRef = fbDb.collection('counters').doc('records');
                const nextNum = await fbDb.runTransaction(async (tx) => {
                    const doc = await tx.get(counterRef);
                    const current = doc.exists ? (parseInt(doc.data().lastNumber, 10) || 0) : 0;
                    const fallbackMax = (await getNextRecordNumber()) - 1;
                    const base = Math.max(current, fallbackMax);
                    const next = base + 1;
                    tx.set(counterRef, { lastNumber: next, updatedAt: new Date().toISOString() }, { merge: true });
                    return next;
                });
                return nextNum;
            } catch (e) {
                // Si está sin señal o falla transacción, calcular sobre caché local offline
                return getNextRecordNumber();
            }
        }
        return getNextRecordNumber();
    }

    async function ensureCatalogValuesExist(payload) {
        const meta = window.FGE_SEED ? window.FGE_SEED.CATALOG_META : [];
        const { byCategory } = await getCatalogs();
        for (const m of meta) {
            const val = String(payload[m.field] || '').trim();
            if (!val) continue;
            const norm = normalizeForCompare(val);
            const list = byCategory[m.key] || [];
            const exists = list.some(i => normalizeForCompare(i.value) === norm);
            if (!exists) {
                await addCatalogItem(m.key, val, { asApproved: currentUserCache && currentUserCache.role === 'admin' });
            }
        }
    }

    async function createRecord(payload) {
        await init();
        if (!currentUserCache) throw new Error('Debes iniciar sesión para guardar registros.');

        const requiredFields = [
            { key: 'llamado', label: 'Llamado' },
            { key: 'perito', label: 'Perito' },
            { key: 'fechaIngreso', label: 'Fecha de ingreso' },
            { key: 'carpetaInvestigacion', label: 'Carpeta de investigación' },
            { key: 'fiscalia', label: 'Fiscalía' },
            { key: 'ministerioPublico', label: 'Ministerio Público' },
            { key: 'pericialSolicita', label: 'Qué pericial solicita (evidencia)' },
            { key: 'evidencia', label: 'Evidencia' },
            { key: 'receptor', label: 'Receptor' },
            { key: 'queSeEntrego', label: 'Qué se entregó' },
            { key: 'observaciones', label: 'Observaciones' }
        ];

        for (const f of requiredFields) {
            if (!String(payload[f.key] || '').trim()) {
                throw new Error(`El campo obligatorio "${f.label}" no puede estar vacío.`);
            }
        }

        // Asegurar que cualquier texto nuevo escrito en listados se adjunte (como pendiente para Admin)
        await ensureCatalogValuesExist(payload);

        const numero = await allocateConsecutiveNumber();
        const now = new Date().toISOString();
        const fechaEv = String(payload.fechaEntregaEvidencias || '').trim();
        const custodioEv = String(payload.custodioRecibeEvidencia || '').trim();

        const record = {
            id: generateId('rec'),
            numero,
            llamado: String(payload.llamado).trim().toUpperCase(),
            perito: String(payload.perito).trim().toUpperCase(),
            fechaIngreso: String(payload.fechaIngreso).trim(),
            carpetaInvestigacion: String(payload.carpetaInvestigacion).trim().toUpperCase(),
            fiscalia: String(payload.fiscalia).trim().toUpperCase(),
            ministerioPublico: String(payload.ministerioPublico).trim().toUpperCase(),
            pericialSolicita: String(payload.pericialSolicita).trim().toUpperCase(),
            evidencia: String(payload.evidencia).trim().toUpperCase(),
            fechaEntrega: String(payload.fechaEntrega || '').trim(),
            receptor: String(payload.receptor).trim().toUpperCase(),
            queSeEntrego: String(payload.queSeEntrego).trim().toUpperCase(),
            observaciones: String(payload.observaciones).trim().toUpperCase(),
            fechaEntregaEvidencias: fechaEv,
            custodioRecibeEvidencia: custodioEv.toUpperCase(),
            // Regla estricta: una vez ingresado valor en entrega de evidencias, queda bloqueado definitivamente
            fechaEntregaEvidenciasLocked: Boolean(fechaEv),
            custodioRecibeEvidenciaLocked: Boolean(custodioEv),
            locked: true,
            editCount: 0,
            createdByUserId: currentUserCache.id,
            createdByUsername: currentUserCache.username,
            createdByName: currentUserCache.fullName,
            createdAt: now,
            updatedAt: now
        };

        if (activeMode === 'firebase') {
            await fbDb.collection('records').doc(record.id).set(record);
        } else {
            await idbPut('records', record);
        }
        return record;
    }

    async function appendAuditLog(entry) {
        const log = {
            id: generateId('log'),
            ...entry,
            editedByUserId: currentUserCache.id,
            editedByUsername: currentUserCache.username,
            editedByName: currentUserCache.fullName,
            editedAt: new Date().toISOString()
        };
        if (activeMode === 'firebase') {
            await fbDb.collection('audit_logs').doc(log.id).set(log);
        } else {
            await idbPut('audit_logs', log);
        }
        return log;
    }

    async function completeEvidenceDelivery(recordId, { fechaEntregaEvidencias = '', custodioRecibeEvidencia = '' }) {
        await init();
        if (!currentUserCache) throw new Error('Sesión no válida.');

        const records = await getRecords();
        const rec = records.find(r => r.id === recordId);
        if (!rec) throw new Error('Registro no encontrado.');

        const isOwner = rec.createdByUserId === currentUserCache.id;
        const isAdmin = currentUserCache.role === 'admin';
        if (!isOwner && !isAdmin) {
            throw new Error('Solo el usuario propietario o el administrador puede completar este registro.');
        }

        const newFecha = String(fechaEntregaEvidencias || '').trim();
        const newCustodio = String(custodioRecibeEvidencia || '').trim().toUpperCase();
        const patch = {};
        const logsToWrite = [];

        if (!rec.fechaEntregaEvidenciasLocked && newFecha) {
            patch.fechaEntregaEvidencias = newFecha;
            patch.fechaEntregaEvidenciasLocked = true;
            logsToWrite.push({
                recordId: rec.id,
                recordNumero: rec.numero,
                action: 'ENTREGA_EVIDENCIAS',
                field: 'fechaEntregaEvidencias',
                fieldLabel: 'Fecha entrega Evidencias',
                oldValue: '(Vacío)',
                newValue: newFecha,
                reason: 'Registro definitivo de fecha de entrega de evidencias (bloqueado tras captura)'
            });
        } else if (rec.fechaEntregaEvidenciasLocked && newFecha && newFecha !== rec.fechaEntregaEvidencias) {
            throw new Error('La "Fecha entrega Evidencias" ya fue ingresada y no puede modificarse.');
        }

        if (!rec.custodioRecibeEvidenciaLocked && newCustodio) {
            patch.custodioRecibeEvidencia = newCustodio;
            patch.custodioRecibeEvidenciaLocked = true;
            logsToWrite.push({
                recordId: rec.id,
                recordNumero: rec.numero,
                action: 'ENTREGA_EVIDENCIAS',
                field: 'custodioRecibeEvidencia',
                fieldLabel: 'Custodio / AIC que recibe evidencia',
                oldValue: '(Vacío)',
                newValue: newCustodio,
                reason: 'Registro definitivo de Custodio / AIC que recibe evidencia (bloqueado tras captura)'
            });
        } else if (rec.custodioRecibeEvidenciaLocked && newCustodio && newCustodio !== rec.custodioRecibeEvidencia) {
            throw new Error('El campo "Custodio / AIC que recibe evidencia" ya fue ingresado y no puede modificarse.');
        }

        if (logsToWrite.length === 0) {
            throw new Error('Captura al menos uno de los campos pendientes de entrega de evidencias.');
        }

        patch.updatedAt = new Date().toISOString();
        patch.editCount = (Number(rec.editCount) || 0) + logsToWrite.length;

        if (activeMode === 'firebase') {
            await fbDb.collection('records').doc(rec.id).update(patch);
        } else {
            const full = await idbGet('records', rec.id);
            await idbPut('records', { ...full, ...patch });
        }

        for (const l of logsToWrite) {
            await appendAuditLog(l);
        }

        return { ...rec, ...patch };
    }

    async function correctRecordFields(recordId, updatedFields, reason) {
        await init();
        if (!currentUserCache) throw new Error('Sesión no válida.');
        const cleanReason = String(reason || '').trim();
        if (cleanReason.length < 5) {
            throw new Error('Debes indicar un motivo claro de la corrección (mínimo 5 caracteres) para el historial de cambios.');
        }

        const records = await getRecords();
        const rec = records.find(r => r.id === recordId);
        if (!rec) throw new Error('Registro no encontrado.');

        const isOwner = rec.createdByUserId === currentUserCache.id;
        const isAdmin = currentUserCache.role === 'admin';
        if (!isOwner && !isAdmin) {
            throw new Error('Solo el usuario propietario del registro o el administrador puede registrar una corrección.');
        }

        // Campos que admiten corrección auditada (NUNCA 'numero' ni los 2 campos de evidencia bloqueados)
        const editableMeta = (window.FGE_SEED ? window.FGE_SEED.RECORD_FIELDS : []).filter(f =>
            f.key !== 'numero' &&
            f.key !== 'fechaEntregaEvidencias' &&
            f.key !== 'custodioRecibeEvidencia'
        );

        const patch = {};
        const diffs = [];

        for (const f of editableMeta) {
            if (!(f.key in updatedFields)) continue;
            let newVal = String(updatedFields[f.key] || '').trim();
            if (f.type !== 'date') newVal = newVal.toUpperCase();
            if (f.required && !newVal) {
                throw new Error(`El campo obligatorio "${f.label}" no puede quedar vacío.`);
            }
            const oldVal = String(rec[f.key] || '').trim();
            if (newVal !== oldVal) {
                patch[f.key] = newVal;
                diffs.push({
                    recordId: rec.id,
                    recordNumero: rec.numero,
                    action: 'CORRECCION_CAMPO',
                    field: f.key,
                    fieldLabel: f.label,
                    oldValue: oldVal || '(Vacío)',
                    newValue: newVal || '(Vacío)',
                    reason: cleanReason
                });
            }
        }

        if (diffs.length === 0) {
            throw new Error('No se detectó ningún cambio respecto a los datos actuales.');
        }

        // Registrar nuevos valores en catálogos si el usuario escribió uno nuevo en la corrección
        await ensureCatalogValuesExist(patch);

        patch.updatedAt = new Date().toISOString();
        patch.editCount = (Number(rec.editCount) || 0) + diffs.length;

        if (activeMode === 'firebase') {
            await fbDb.collection('records').doc(rec.id).update(patch);
        } else {
            const full = await idbGet('records', rec.id);
            await idbPut('records', { ...full, ...patch });
        }

        for (const diff of diffs) {
            await appendAuditLog(diff);
        }

        return { record: { ...rec, ...patch }, changesCount: diffs.length };
    }

    async function getAuditLogs(recordId = null) {
        await init();
        let logs;
        if (activeMode === 'firebase') {
            const ref = recordId
                ? fbDb.collection('audit_logs').where('recordId', '==', recordId)
                : fbDb.collection('audit_logs');
            const snap = await ref.get();
            logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            logs = await idbGetAll('audit_logs');
            if (recordId) logs = logs.filter(l => l.recordId === recordId);
        }
        logs.sort((a, b) => String(b.editedAt || '').localeCompare(String(a.editedAt || '')));
        return logs;
    }

    // ======================================================================
    // 9. IMPORTAR MUESTRA DE LIBRO_INFORMATICA.xlsx Y RESPALDO JSON OFFLINE
    // ======================================================================
    async function importSampleExcelRecords() {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede importar registros de muestra.');
        }
        const samples = (window.FGE_SEED && window.FGE_SEED.SAMPLE_RECORDS) || [];
        const existing = await getRecords();
        const existingLlamados = new Set(existing.map(r => normalizeForCompare(r.llamado)));
        let imported = 0;

        for (const s of samples) {
            if (existingLlamados.has(normalizeForCompare(s.llamado))) continue;
            await createRecord(s);
            imported++;
        }
        return imported;
    }

    async function exportBackupJSON() {
        await init();
        if (!currentUserCache || currentUserCache.role !== 'admin') {
            throw new Error('Solo el administrador puede exportar respaldos.');
        }
        const [users, catalogs, records, auditLogs] = await Promise.all([
            activeMode === 'firebase' ? getUsers() : idbGetAll('users'),
            getCatalogs(),
            getRecords(),
            getAuditLogs()
        ]);
        return {
            exportedAt: new Date().toISOString(),
            mode: activeMode,
            version: '1.0',
            users: users.map(sanitizeUser),
            catalog_items: catalogs.allItems,
            records,
            audit_logs: auditLogs
        };
    }

    window.FGEDB = {
        init,
        getMode,
        getCurrentUser,
        login,
        logout,
        requireSession,
        adminTriggerPasswordReset,
        requestPasswordResetSelf,
        validateResetToken,
        completeLocalPasswordReset,
        updateOwnProfile,
        updateOwnPassword,
        getUsers,
        createUser,
        updateUser,
        deleteUser,
        getCatalogs,
        addCatalogItem,
        approveCatalogItem,
        updateCatalogItem,
        rejectCatalogItem,
        getRecords,
        getNextRecordNumber,
        createRecord,
        completeEvidenceDelivery,
        correctRecordFields,
        getAuditLogs,
        importSampleExcelRecords,
        exportBackupJSON,
        sha256Hex
    };
})();
