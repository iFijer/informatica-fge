/* ==========================================================================
   UTILIDADES DE INTERFAZ COMPARTIDAS (100% OFFLINE)
   Logo FGE Morelos, Toast, Combobox con alta manual, Fechas, Avatares, PWA
   ========================================================================== */

(function () {
    const FGE_LOGO_SVG = `
        <svg viewBox="0 0 240 240" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="Logo Fiscalía General del Estado de Morelos">
            <defs>
                <path id="fge-arc-top" d="M 31,120 A 89,89 0 1,1 209,120" />
                <path id="fge-arc-bottom" d="M 19.3,98.6 A 103,103 0 1,0 220.7,98.6" />
                <mask id="fge-shield-cutout">
                    <rect x="0" y="0" width="240" height="240" fill="#ffffff" />
                    <path d="M 71,67 Q 120,51 169,67 L 169,128 C 169,157 146.5,174 120,185 C 93.5,174 71,157 71,128 Z" fill="#000000" />
                </mask>
            </defs>
            <circle cx="120" cy="120" r="115" fill="none" stroke="#94a3b8" stroke-width="4.5"/>
            <g mask="url(#fge-shield-cutout)" fill="none" stroke="#94a3b8" stroke-width="3.6">
                <circle cx="120" cy="120" r="78"/>
                <circle cx="120" cy="120" r="70"/>
                <circle cx="120" cy="120" r="62"/>
            </g>
            <line x1="34" y1="81" x2="49" y2="62" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
            <line x1="206" y1="81" x2="191" y2="62" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
            <text fill="#ffffff" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="21" font-weight="900" letter-spacing="3.5">
                <textPath href="#fge-arc-top" startOffset="50%" text-anchor="middle">MORELOS</textPath>
            </text>
            <text fill="#ffffff" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="18" font-weight="900" letter-spacing="1.6">
                <textPath href="#fge-arc-bottom" startOffset="50%" text-anchor="middle">FISCALÍA GENERAL DEL ESTADO</textPath>
            </text>
            <path d="M 72,68 Q 120,52 168,68 L 168,128 C 168,156 146,173 120,184 C 94,173 72,156 72,128 Z" fill="none" stroke="#94a3b8" stroke-width="3.5" stroke-linejoin="round"/>
            <path d="M 78,73 Q 120,58.5 162,73 L 162,128 C 162,152 143,167 120,177 C 97,167 78,152 78,128 Z" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linejoin="round"/>
            <line x1="120" y1="64" x2="120" y2="177" stroke="#94a3b8" stroke-width="3.2"/>
            <line x1="120" y1="123" x2="162" y2="123" stroke="#94a3b8" stroke-width="3.2"/>
            <text x="100" y="103" fill="#ffffff" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="26" font-weight="900" text-anchor="middle">F</text>
            <text x="100" y="131" fill="#ffffff" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="26" font-weight="900" text-anchor="middle">G</text>
            <text x="100" y="158" fill="#ffffff" font-family="system-ui, -apple-system, 'Segoe UI', Arial, sans-serif" font-size="26" font-weight="900" text-anchor="middle">E</text>
            <g stroke="#94a3b8" fill="none">
                <line x1="128" y1="100" x2="150" y2="100" stroke-width="3" stroke-linecap="round"/>
                <line x1="131" y1="95.5" x2="147" y2="95.5" stroke-width="2.8" stroke-linecap="round"/>
                <line x1="139" y1="80" x2="139" y2="95.5" stroke-width="2.8" stroke-linecap="round"/>
                <path d="M 130,82.5 L 136,82.5 L 139,80.5 L 142,82.5 L 148,82.5" stroke-width="2.4" stroke-linejoin="round"/>
                <line x1="130.5" y1="82.5" x2="130.5" y2="88.5" stroke-width="2"/>
                <path d="M 126.5,88.5 A 4,4 0 0,0 134.5,88.5 Z" fill="#94a3b8" stroke="none"/>
                <line x1="147.5" y1="82.5" x2="147.5" y2="88.5" stroke-width="2"/>
                <path d="M 143.5,88.5 A 4,4 0 0,0 151.5,88.5 Z" fill="#94a3b8" stroke="none"/>
                <path d="M 127.5,113.5 Q 139,104 150.5,113.5" stroke-width="3" stroke-linecap="round"/>
                <circle cx="139" cy="113.5" r="4.5" stroke-width="2.8"/>
            </g>
            <path d="M 131.5,128.5 L 136.5,129.5 L 138.5,132 L 142,131.5 L 145,133.5 L 151.5,132 L 150,136.5 L 148,141 L 150.5,145.5 L 146.5,150.5 L 144.5,158 L 141.5,156 L 138,156 L 135,160 L 131,154 L 125.5,149.5 L 124.5,145 L 127.5,141.5 L 127,136.5 L 131,133.5 Z" fill="none" stroke="#94a3b8" stroke-width="2.3" stroke-linejoin="round"/>
        </svg>
    `;

    function injectFgeLogo() {
        const el = document.getElementById('fgeLogoSlot');
        if (el) el.innerHTML = FGE_LOGO_SVG;
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeText(str) {
        return String(str || '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    }

    let toastTimeout = null;
    function showToast(msg, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        if (!toast || !toastMsg) return;
        toast.classList.remove('success', 'warning', 'error', 'info', 'show');
        toast.classList.add(type);
        toastMsg.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3800);
    }

    function getTodayISO() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatDateDisplay(val) {
        if (!val) return '—';
        const s = String(val).trim();
        const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        }
        return s;
    }

    function formatDateTimeDisplay(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return String(iso);
            return d.toLocaleString('es-MX', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return String(iso);
        }
    }

    function getDefaultAvatarDataUrl(name) {
        const clean = String(name || 'FG').trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        const initials = parts.length >= 2
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : clean.slice(0, 2).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#1d4ed8"/>
                    <stop offset="100%" stop-color="#0891b2"/>
                </linearGradient>
            </defs>
            <rect width="128" height="128" rx="64" fill="url(#g)"/>
            <text x="64" y="75" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="700">${escapeHtml(initials)}</text>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function getAvatarSrc(user) {
        if (user && user.photoDataUrl && String(user.photoDataUrl).startsWith('data:image/')) {
            return user.photoDataUrl;
        }
        return getDefaultAvatarDataUrl(user ? (user.fullName || user.username) : 'FG');
    }

    function compressImageToDataURL(file, maxSize = 180, quality = 0.82) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('Selecciona un archivo de imagen válido (JPG, PNG o WEBP).'));
                return;
            }
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('La imagen seleccionada no es válida.'));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = maxSize;
                    canvas.height = maxSize;
                    const ctx = canvas.getContext('2d');
                    // Recorte centrado cuadrado
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2;
                    const sy = (img.height - side) / 2;
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, maxSize, maxSize);
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function updateConnectionBadge(elId = 'connectionStatusPill') {
        const el = document.getElementById(elId);
        if (!el) return;
        const mode = window.FGEDB ? window.FGEDB.getMode() : 'local';
        const online = navigator.onLine;
        el.classList.remove('online', 'offline', 'local');
        if (mode === 'firebase') {
            if (online) {
                el.classList.add('online');
                el.innerHTML = `<span class="dot"></span><span>Firebase En Línea</span>`;
            } else {
                el.classList.add('offline');
                el.innerHTML = `<span class="dot"></span><span>Firebase Offline (Caché)</span>`;
            }
        } else {
            el.classList.add('local');
            el.innerHTML = `<span class="dot"></span><span>Modo Offline Local</span>`;
        }
    }

    /**
     * Combobox con búsqueda en vivo y alta manual de nuevos elementos
     * (los valores nuevos se adjuntan al catálogo con estado "pending" para autorización del Admin)
     */
    function createSearchableCombo({
        container,
        inputId,
        placeholder = 'Buscar o escribir...',
        getItems,
        onManualAdd,
        initialValue = '',
        disabled = false,
        allowManualAdd = true
    }) {
        container.innerHTML = `
            <div class="combo-wrapper">
                <div class="combo-input-row">
                    <input type="text"
                           id="${escapeHtml(inputId)}"
                           class="form-control"
                           autocomplete="off"
                           placeholder="${escapeHtml(placeholder)}"
                           value="${escapeHtml(initialValue)}"
                           ${disabled ? 'disabled' : ''}>
                    <button type="button" class="combo-toggle-btn" tabindex="-1" title="Desplegar lista" ${disabled ? 'disabled' : ''}>
                        <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                </div>
                <div class="combo-dropdown" role="listbox"></div>
            </div>
        `;

        const input = container.querySelector('input');
        const toggleBtn = container.querySelector('.combo-toggle-btn');
        const dropdown = container.querySelector('.combo-dropdown');
        let isOpen = false;
        let selectedValue = initialValue || '';

        function renderOptions(filterText = '') {
            const rawItems = (typeof getItems === 'function' ? getItems() : []) || [];
            const queryNorm = normalizeText(filterText);

            const filtered = rawItems.filter(it => {
                if (!queryNorm) return true;
                return normalizeText(it.searchText || it.displayLabel || it.value).includes(queryNorm);
            });

            const exactExists = queryNorm
                ? rawItems.some(it =>
                    normalizeText(it.value) === queryNorm ||
                    (it.displayLabel && normalizeText(it.displayLabel) === queryNorm)
                )
                : true;

            let html = '';
            if (filtered.length === 0 && !filterText.trim()) {
                html += `<div class="combo-empty">${allowManualAdd ? 'Sin elementos en el catálogo. Escribe para agregar uno nuevo.' : 'No hay elementos registrados.'}</div>`;
            } else if (filtered.length === 0 && !allowManualAdd) {
                html += `<div class="combo-empty">Sin coincidencias en los usuarios registrados.</div>`;
            } else {
                filtered.forEach(item => {
                    const isPending = item.status === 'pending';
                    const labelText = item.displayLabel || item.value;
                    html += `
                        <div class="combo-item" data-value="${escapeHtml(item.value)}">
                            <span>${escapeHtml(labelText)}</span>
                            <span class="flex items-center gap-2">
                                ${item.badgeText ? `<span class="badge badge-cyan" style="font-size:0.65rem;">${escapeHtml(item.badgeText)}</span>` : ''}
                                ${isPending ? '<span class="badge badge-amber" style="font-size:0.65rem;">Pendiente</span>' : ''}
                            </span>
                        </div>
                    `;
                });
            }

            if (allowManualAdd && filterText.trim().length > 0 && !exactExists && typeof onManualAdd === 'function') {
                const displayNew = filterText.trim().toUpperCase();
                html += `
                    <div class="combo-item add-new" data-add-value="${escapeHtml(displayNew)}">
                        <span>+ Agregar "${escapeHtml(displayNew)}" a la lista</span>
                        <span class="badge badge-cyan" style="font-size:0.64rem;">Autorizar Admin</span>
                    </div>
                `;
            }

            dropdown.innerHTML = html;

            dropdown.querySelectorAll('.combo-item[data-value]').forEach(el => {
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectedValue = el.getAttribute('data-value');
                    input.value = selectedValue;
                    input.classList.remove('error');
                    close();
                });
            });

            const addEl = dropdown.querySelector('.combo-item[data-add-value]');
            if (addEl) {
                addEl.addEventListener('mousedown', async (e) => {
                    e.preventDefault();
                    const newVal = addEl.getAttribute('data-add-value');
                    try {
                        const saved = await onManualAdd(newVal);
                        selectedValue = (saved && saved.value) ? saved.value : newVal;
                        input.value = selectedValue;
                        input.classList.remove('error');
                        close();
                        showToast(`"${selectedValue}" agregado a la lista (pendiente de autorización del administrador).`, 'info');
                    } catch (err) {
                        showToast(err.message || 'No se pudo agregar a la lista.', 'error');
                    }
                });
            }
        }

        function open() {
            if (input.disabled) return;
            isOpen = true;
            renderOptions(input.value);
            dropdown.classList.add('open');
        }

        function close() {
            isOpen = false;
            dropdown.classList.remove('open');
        }

        input.addEventListener('focus', () => open());
        input.addEventListener('input', () => {
            selectedValue = input.value.trim();
            input.classList.remove('error');
            if (!isOpen) open();
            else renderOptions(input.value);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && isOpen) {
                const firstOption = dropdown.querySelector('.combo-item[data-value], .combo-item[data-add-value]');
                if (firstOption) {
                    e.preventDefault();
                    firstOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                }
            }
        });

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isOpen) {
                close();
            } else {
                input.focus();
                renderOptions('');
                dropdown.classList.add('open');
                isOpen = true;
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) close();
        });

        return {
            getValue: () => input.value.trim(),
            setValue: (v) => {
                selectedValue = v || '';
                input.value = selectedValue;
            },
            setDisabled: (flag) => {
                input.disabled = !!flag;
                toggleBtn.disabled = !!flag;
            },
            markError: (flag) => {
                input.classList.toggle('error', !!flag);
            },
            input
        };
    }

    function openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('open');
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
    }

    function registerOfflineServiceWorker() {
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
            navigator.serviceWorker.register('./sw.js').catch(() => {
                // Silenciar si el entorno bloquea SW
            });
        }
    }

    function renderEvidenciaBadge(val) {
        const v = normalizeText(val);
        if (v === 'SI' || v === 'S') return `<span class="badge badge-emerald">${escapeHtml(val)}</span>`;
        if (v === 'NO' || v === 'N') return `<span class="badge badge-slate">${escapeHtml(val)}</span>`;
        if (v === 'F' || v === 'FALTA' || v === 'FALTANTE') return `<span class="badge badge-amber">${escapeHtml(val)}</span>`;
        return `<span class="badge badge-cyan">${escapeHtml(val || '—')}</span>`;
    }

    function renderEntregaBadge(val) {
        const v = normalizeText(val);
        if (!v) return `<span class="text-muted">—</span>`;
        if (v.includes('DICTAMEN')) return `<span class="badge badge-emerald">${escapeHtml(val)}</span>`;
        if (v.includes('INFORME')) return `<span class="badge badge-blue">${escapeHtml(val)}</span>`;
        if (v.includes('PENDIENTE')) return `<span class="badge badge-amber">${escapeHtml(val)}</span>`;
        return `<span class="badge badge-cyan">${escapeHtml(val)}</span>`;
    }

    function stripMpPrefix(val) {
        return String(val || '')
            .trim()
            .replace(/^(?:(?:LIC|AIC)\.\s*|(?:LIC|AIC)\s+)+/i, '')
            .trim();
    }

    function buildPeritoComboItems(usersList) {
        return (usersList || [])
            .filter(u => u && u.active !== false)
            .map(u => {
                const alias = String(u.alias || '').trim().toUpperCase();
                const full = String(u.fullName || u.username || '').trim().toUpperCase();
                const value = alias || full;
                return {
                    value,
                    displayLabel: full,
                    badgeText: alias || '',
                    searchText: `${full} ${alias} ${u.username || ''}`,
                    status: 'approved'
                };
            });
    }

    function resolvePeritoAlias(peritoVal, usersList) {
        const raw = String(peritoVal || '').trim();
        if (!raw) return '';
        const norm = normalizeText(raw);
        const match = (usersList || []).find(u =>
            (u.alias && normalizeText(u.alias) === norm) ||
            (u.fullName && normalizeText(u.fullName) === norm) ||
            (u.username && normalizeText(u.username) === norm)
        );
        if (match && match.alias && String(match.alias).trim()) {
            return String(match.alias).trim().toUpperCase();
        }
        return raw;
    }

    window.addEventListener('DOMContentLoaded', () => {
        injectFgeLogo();
        registerOfflineServiceWorker();
    });

    window.addEventListener('online', () => updateConnectionBadge());
    window.addEventListener('offline', () => updateConnectionBadge());

    window.FGEUI = {
        FGE_LOGO_SVG,
        injectFgeLogo,
        escapeHtml,
        normalizeText,
        stripMpPrefix,
        buildPeritoComboItems,
        resolvePeritoAlias,
        showToast,
        getTodayISO,
        formatDateDisplay,
        formatDateTimeDisplay,
        getDefaultAvatarDataUrl,
        getAvatarSrc,
        compressImageToDataURL,
        updateConnectionBadge,
        createSearchableCombo,
        openModal,
        closeModal,
        renderEvidenciaBadge,
        renderEntregaBadge
    };
})();
