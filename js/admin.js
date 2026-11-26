/* ==========================================================================
   CONTROLADOR DEL SITIO ADMIN (USUARIOS, 7 CATÁLOGOS, INFORMES, BD Y AUDITORÍA)
   ========================================================================== */

(function () {
    let adminUser = null;
    let usersList = [];
    let catalogsState = { allItems: [], byCategory: {}, pendingItems: [] };
    let recordsList = [];
    let auditList = [];
    let activeCatalogKey = 'ministerios_publicos';
    let pendingUserPhotoDataUrl = undefined;

    async function bootstrapAdmin() {
        adminUser = await window.FGEDB.requireSession({ adminOnly: true });
        if (!adminUser) return;

        window.FGEUI.updateConnectionBadge('connectionStatusPill');
        renderAdminHeader();
        initReportDimensionCheckboxes();
        loadFirebaseConfigForm();
        bindEvents();
        await reloadAll();
    }

    function renderAdminHeader() {
        document.getElementById('adminAvatar').src = window.FGEUI.getAvatarSrc(adminUser);
        document.getElementById('adminFullName').textContent = adminUser.fullName || adminUser.username;
        document.getElementById('adminSubInfo').textContent = `@${adminUser.username} · ${adminUser.email || ''}`;
    }

    async function reloadAll() {
        const [users, cats, recs, logs] = await Promise.all([
            window.FGEDB.getUsers(),
            window.FGEDB.getCatalogs(),
            window.FGEDB.getRecords(),
            window.FGEDB.getAuditLogs()
        ]);
        usersList = users;
        catalogsState = cats;
        recordsList = recs;
        auditList = logs;

        renderTopStats();
        renderUsersGrid();
        renderCatalogsUI();
        renderAdminReportControls();
        renderAdminDatabaseTab();

        if (document.getElementById('tabReports').classList.contains('active')) {
            renderAdminCharts();
        }
    }

    function renderTopStats() {
        document.getElementById('statUsersCount').textContent = usersList.length;
        document.getElementById('statRecordsCount').textContent = recordsList.length;
        document.getElementById('statPendingCatalogs').textContent = catalogsState.pendingItems.length;
        document.getElementById('statAuditCount').textContent = auditList.length;

        const badge = document.getElementById('tabPendingBadge');
        if (catalogsState.pendingItems.length > 0) {
            badge.textContent = catalogsState.pendingItems.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // ======================================================================
    // TAB 1: USUARIOS (CONTRASEÑA OCULTA + BOTÓN RESETEAR POR CORREO)
    // ======================================================================
    function renderUsersGrid() {
        const grid = document.getElementById('usersGrid');
        const esc = window.FGEUI.escapeHtml;

        if (usersList.length === 0) {
            grid.innerHTML = `<div class="glass-panel empty-state">No hay usuarios registrados.</div>`;
            return;
        }

        grid.innerHTML = usersList.map((u) => {
            const recCount = recordsList.filter(r => r.createdByUserId === u.id).length;
            const isMainAdmin = u.role === 'admin';
            return `
                <article class="user-card">
                    <div class="flex items-center gap-3">
                        <img src="${window.FGEUI.getAvatarSrc(u)}" alt="${esc(u.fullName)}" class="avatar-circle">
                        <div style="min-width:0; flex:1;">
                            <div class="flex items-center gap-2 flex-wrap">
                                <strong style="font-size:1.05rem;">${esc(u.fullName)}</strong>
                                <span class="badge ${isMainAdmin ? 'badge-amber' : 'badge-cyan'}">${isMainAdmin ? 'Admin' : 'Usuario'}</span>
                                ${u.active === false ? '<span class="badge badge-rose">Inactivo</span>' : '<span class="badge badge-emerald">Activo</span>'}
                            </div>
                            <div class="text-xs text-muted font-mono">@${esc(u.username)}</div>
                            <div class="text-xs text-cyan" style="word-break:break-all;">${esc(u.email)}</div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-xs" style="background:rgba(2,6,23,0.55); padding:0.55rem 0.75rem; border-radius:0.5rem; border:1px solid rgba(51,65,85,0.7);">
                        <div>
                            <span class="text-muted">Contraseña:</span>
                            <span class="font-mono font-bold" style="letter-spacing:0.12em;">••••••••••</span>
                            <span class="text-muted">(Oculta)</span>
                        </div>
                        <span class="badge badge-slate">${recCount} reg.</span>
                    </div>

                    ${u.mustResetPassword ? `<div class="info-box warning" style="padding:0.45rem 0.65rem; font-size:0.78rem;">Reseteo de contraseña solicitado el ${esc(window.FGEUI.formatDateTimeDisplay(u.resetRequestedAt))}</div>` : ''}

                    <div class="flex flex-wrap gap-2">
                        <button type="button" class="btn btn-warning btn-sm" data-user-act="reset" data-id="${esc(u.id)}" title="Enviar correo para que el usuario ingrese nueva contraseña">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <span>Resetear Contraseña</span>
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" data-user-act="edit" data-id="${esc(u.id)}">Editar</button>
                        ${!isMainAdmin ? `<button type="button" class="btn btn-danger btn-sm" data-user-act="delete" data-id="${esc(u.id)}">Eliminar</button>` : ''}
                    </div>
                </article>
            `;
        }).join('');
    }

    function openUserModal(userId = null) {
        const isEdit = Boolean(userId);
        const u = isEdit ? usersList.find(x => x.id === userId) : null;
        pendingUserPhotoDataUrl = isEdit ? u.photoDataUrl : '';

        document.getElementById('userModalTitle').textContent = isEdit ? 'Editar Usuario' : 'Nuevo Usuario';
        document.getElementById('usrEditId').value = isEdit ? u.id : '';
        document.getElementById('usrPhotoPreview').src = window.FGEUI.getAvatarSrc(u || { fullName: 'Nuevo' });
        document.getElementById('usrFullName').value = isEdit ? u.fullName : '';
        document.getElementById('usrUsername').value = isEdit ? u.username : '';
        document.getElementById('usrEmail').value = isEdit ? u.email : '';
        document.getElementById('usrPassword').value = '';
        document.getElementById('usrPasswordWrap').classList.toggle('hidden', isEdit);
        document.getElementById('usrActiveWrap').classList.toggle('hidden', !isEdit || (u && u.role === 'admin'));
        document.getElementById('usrActiveCheck').checked = isEdit ? (u.active !== false) : true;
        document.getElementById('userFormError').classList.add('hidden');

        window.FGEUI.openModal('userModal');
    }

    async function saveUserModal() {
        const errBox = document.getElementById('userFormError');
        errBox.classList.add('hidden');

        const editId = document.getElementById('usrEditId').value;
        const fullName = document.getElementById('usrFullName').value.trim();
        const username = document.getElementById('usrUsername').value.trim();
        const email = document.getElementById('usrEmail').value.trim();
        const password = document.getElementById('usrPassword').value;
        const active = document.getElementById('usrActiveCheck').checked;

        const btn = document.getElementById('btnSaveUser');
        btn.disabled = true;
        try {
            if (editId) {
                await window.FGEDB.updateUser(editId, {
                    fullName,
                    username,
                    email,
                    photoDataUrl: pendingUserPhotoDataUrl,
                    active
                });
                window.FGEUI.showToast('Usuario actualizado correctamente.', 'success');
            } else {
                await window.FGEDB.createUser({
                    fullName,
                    username,
                    email,
                    password,
                    photoDataUrl: pendingUserPhotoDataUrl || ''
                });
                window.FGEUI.showToast(`Usuario "${username}" creado correctamente.`, 'success');
            }
            window.FGEUI.closeModal('userModal');
            await reloadAll();
        } catch (err) {
            errBox.textContent = err.message || 'No se pudo guardar el usuario.';
            errBox.classList.remove('hidden');
        } finally {
            btn.disabled = false;
        }
    }

    async function handleResetUserPassword(userId) {
        const u = usersList.find(x => x.id === userId);
        if (!u) return;
        if (!confirm(`¿Deseas resetear la contraseña de "${u.fullName}" y enviar el correo de restablecimiento a ${u.email}?`)) {
            return;
        }
        try {
            const res = await window.FGEDB.adminTriggerPasswordReset(userId);
            const esc = window.FGEUI.escapeHtml;
            const body = document.getElementById('resetResultBody');

            if (res.mode === 'firebase') {
                body.innerHTML = `
                    <div class="info-box success">
                        <strong>¡Correo enviado automáticamente vía Firebase!</strong><br>
                        Se envió un correo electrónico a <strong>${esc(res.email)}</strong> para que
                        <strong>${esc(res.fullName)}</strong> ingrese su nueva contraseña de forma privada y segura.
                    </div>
                `;
            } else {
                body.innerHTML = `
                    <div class="info-box warning">
                        <strong>Contraseña bloqueada y enlace generado (Modo Offline Local):</strong><br>
                        Como aún no has conectado tu proyecto de Firebase, el sistema generó un enlace único de restablecimiento para
                        <strong>${esc(res.fullName)}</strong> (<code>${esc(res.email)}</code>).
                    </div>
                    <div class="form-group">
                        <label class="form-label">Enlace privado de restablecimiento</label>
                        <input type="text" id="localResetLinkField" class="form-control font-mono text-xs" value="${esc(res.resetUrl)}" readonly>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <a href="${res.mailtoUrl}" class="btn btn-primary btn-sm">Abrir Correo para Enviar</a>
                        <button type="button" id="btnCopyResetLink" class="btn btn-secondary btn-sm">Copiar Enlace</button>
                    </div>
                    <p class="text-xs text-muted" style="margin:0;">
                        Al conectar Firebase (pestaña "Firebase y Respaldos"), este botón enviará el correo automáticamente sin pasos manuales.
                    </p>
                `;
                setTimeout(() => {
                    const cp = document.getElementById('btnCopyResetLink');
                    if (cp) {
                        cp.addEventListener('click', () => {
                            const inp = document.getElementById('localResetLinkField');
                            inp.select();
                            navigator.clipboard?.writeText(inp.value).catch(() => document.execCommand('copy'));
                            window.FGEUI.showToast('Enlace de restablecimiento copiado.', 'success');
                        });
                    }
                }, 40);
            }
            window.FGEUI.openModal('resetResultModal');
            await reloadAll();
        } catch (err) {
            window.FGEUI.showToast(err.message || 'No se pudo resetear la contraseña.', 'error');
        }
    }

    // ======================================================================
    // TAB 2: 7 LISTADOS DEL DASHBOARD + PENDIENTES DE AUTORIZACIÓN
    // ======================================================================
    function renderCatalogsUI() {
        const esc = window.FGEUI.escapeHtml;
        const meta = window.FGE_SEED.CATALOG_META;

        // 1. Bandeja de pendientes
        const pendingCard = document.getElementById('pendingCatalogsCard');
        const pendingListEl = document.getElementById('pendingCatalogsList');
        if (catalogsState.pendingItems.length > 0) {
            pendingCard.classList.remove('hidden');
            pendingListEl.innerHTML = catalogsState.pendingItems.map((it) => {
                const catLabel = (meta.find(m => m.key === it.category) || {}).label || it.category;
                return `
                    <div class="catalog-item-row pending">
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="badge badge-amber">${esc(catLabel)}</span>
                                <strong style="font-size:1rem;">${esc(it.value)}</strong>
                            </div>
                            <div class="text-xs text-muted mt-1">
                                Agregado manualmente por <strong>${esc(it.addedByName || 'Usuario')}</strong> · ${esc(window.FGEUI.formatDateTimeDisplay(it.createdAt))}
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button type="button" class="btn btn-success btn-sm" data-cat-act="approve" data-id="${esc(it.id)}">✓ Autorizar</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-cat-act="edit" data-id="${esc(it.id)}">Editar y Autorizar</button>
                            <button type="button" class="btn btn-danger btn-sm" data-cat-act="reject" data-id="${esc(it.id)}">Rechazar</button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            pendingCard.classList.add('hidden');
        }

        // 2. Navegación lateral de los 7 listados
        const nav = document.getElementById('catalogSidebarNav');
        nav.innerHTML = meta.map((m) => {
            const list = catalogsState.byCategory[m.key] || [];
            const pendCount = list.filter(x => x.status === 'pending').length;
            return `
                <button type="button" class="catalog-nav-btn ${m.key === activeCatalogKey ? 'active' : ''}" data-cat-key="${esc(m.key)}">
                    <span>${esc(m.label)}</span>
                    <span class="flex items-center gap-2">
                        ${pendCount > 0 ? `<span class="tab-badge">${pendCount}</span>` : ''}
                        <span class="badge badge-slate">${list.length}</span>
                    </span>
                </button>
            `;
        }).join('');

        renderActiveCatalogList();
    }

    function renderActiveCatalogList() {
        const esc = window.FGEUI.escapeHtml;
        const meta = window.FGE_SEED.CATALOG_META.find(m => m.key === activeCatalogKey);
        const searchQ = window.FGEUI.normalizeText(document.getElementById('catalogSearchInput').value);
        const allInCat = catalogsState.byCategory[activeCatalogKey] || [];
        const filtered = searchQ
            ? allInCat.filter(i => window.FGEUI.normalizeText(i.value).includes(searchQ))
            : allInCat;

        document.getElementById('activeCatalogTitle').textContent = `Listado de ${meta ? meta.label : activeCatalogKey}`;
        document.getElementById('activeCatalogCount').textContent = `${filtered.length} de ${allInCat.length} elemento(s)`;

        const container = document.getElementById('catalogItemsContainer');
        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state">No hay elementos que coincidan en esta lista.</div>`;
            return;
        }

        container.innerHTML = filtered.map((it) => `
            <div class="catalog-item-row ${it.status === 'pending' ? 'pending' : ''}">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold">${esc(it.value)}</span>
                    ${it.status === 'pending'
                        ? '<span class="badge badge-amber">Pendiente de Autorizar</span>'
                        : '<span class="badge badge-emerald" style="font-size:0.65rem;">Autorizado</span>'}
                </div>
                <div class="flex items-center gap-2">
                    ${it.status === 'pending' ? `<button type="button" class="btn btn-success btn-sm" data-cat-act="approve" data-id="${esc(it.id)}">Autorizar</button>` : ''}
                    <button type="button" class="btn btn-secondary btn-sm" data-cat-act="edit" data-id="${esc(it.id)}">Editar</button>
                    <button type="button" class="btn btn-danger btn-sm" data-cat-act="reject" data-id="${esc(it.id)}">Eliminar</button>
                </div>
            </div>
        `).join('');
    }

    function openCatalogEditModal(itemId) {
        const item = catalogsState.allItems.find(i => i.id === itemId);
        if (!item) return;
        document.getElementById('catEditModalTitle').textContent = item.status === 'pending'
            ? 'Editar y Autorizar Elemento'
            : 'Editar Elemento del Listado';
        document.getElementById('catEditId').value = item.id;
        document.getElementById('catEditValue').value = item.value;
        document.getElementById('catPropagateCheck').checked = true;
        window.FGEUI.openModal('catalogEditModal');
    }

    // ======================================================================
    // TAB 3: INFORMES Y GRÁFICAS DEL ADMINISTRADOR (INDIVIDUAL / SELECCIÓN / TODOS)
    // ======================================================================
    function initReportDimensionCheckboxes() {
        const el = document.getElementById('adminRepDimsCheckboxes');
        const esc = window.FGEUI.escapeHtml;
        el.innerHTML = window.FGECharts.REPORT_DIMENSIONS.map((d) => `
            <label class="user-check-chip">
                <input type="checkbox" name="adminRepDim" value="${esc(d.key)}" checked>
                <span>${esc(d.label)}</span>
            </label>
        `).join('');
    }

    function renderAdminReportControls() {
        const esc = window.FGEUI.escapeHtml;
        const singleSel = document.getElementById('adminRepSingleUserSelect');
        const prevSingle = singleSel.value;
        singleSel.innerHTML = usersList.map((u) => `
            <option value="${esc(u.id)}">${esc(u.fullName)} (@${esc(u.username)})</option>
        `).join('');
        if (prevSingle && usersList.some(u => u.id === prevSingle)) {
            singleSel.value = prevSingle;
        }

        const multiBox = document.getElementById('adminRepMultiCheckboxes');
        const prevChecked = new Set(Array.from(multiBox.querySelectorAll('input:checked')).map(i => i.value));
        multiBox.innerHTML = usersList.map((u) => {
            const isChecked = prevChecked.size === 0 ? true : prevChecked.has(u.id);
            return `
                <label class="user-check-chip">
                    <input type="checkbox" name="adminRepUser" value="${esc(u.id)}" ${isChecked ? 'checked' : ''}>
                    <span>${esc(u.fullName)} (@${esc(u.username)})</span>
                </label>
            `;
        }).join('');

        updateReportScopeVisibility();
    }

    function updateReportScopeVisibility() {
        const mode = document.getElementById('adminRepScopeMode').value;
        document.getElementById('adminRepSingleBox').classList.toggle('hidden', mode !== 'single');
        document.getElementById('adminRepMultiBox').classList.toggle('hidden', mode !== 'selected');
    }

    function getAdminReportSelection() {
        const mode = document.getElementById('adminRepScopeMode').value;
        const from = document.getElementById('adminRepDateFrom').value;
        const to = document.getElementById('adminRepDateTo').value;
        let allowedUserIds = null;
        let scopeLabel = 'TODOS LOS USUARIOS';

        if (mode === 'single') {
            const uid = document.getElementById('adminRepSingleUserSelect').value;
            allowedUserIds = new Set([uid]);
            const u = usersList.find(x => x.id === uid);
            scopeLabel = u ? `USUARIO: ${u.fullName}` : 'USUARIO INDIVIDUAL';
        } else if (mode === 'selected') {
            const ids = Array.from(document.querySelectorAll('input[name="adminRepUser"]:checked')).map(i => i.value);
            allowedUserIds = new Set(ids);
            const names = usersList.filter(u => allowedUserIds.has(u.id)).map(u => u.username);
            scopeLabel = names.length ? `SELECCIÓN (${names.join(', ')})` : 'NINGÚN USUARIO SELECCIONADO';
        }

        const filtered = recordsList.filter((r) => {
            if (allowedUserIds !== null && !allowedUserIds.has(r.createdByUserId)) return false;
            if (from && r.fechaIngreso && r.fechaIngreso < from) return false;
            if (to && r.fechaIngreso && r.fechaIngreso > to) return false;
            return true;
        });

        const selectedDims = Array.from(document.querySelectorAll('input[name="adminRepDim"]:checked')).map(i => i.value);
        const dateRangeLabel = (from || to)
            ? `${from ? window.FGEUI.formatDateDisplay(from) : 'Inicio'} a ${to ? window.FGEUI.formatDateDisplay(to) : 'Hoy'}`
            : 'Todas las fechas';

        return { filtered, selectedDims, scopeLabel, dateRangeLabel };
    }

    function renderAdminCharts() {
        const { filtered, selectedDims } = getAdminReportSelection();
        const kpis = window.FGECharts.computeReportKPIs(filtered);

        document.getElementById('adminReportKpis').innerHTML = `
            <div class="kpi-card"><div><div class="kpi-label">Registros en Informe</div><div class="kpi-value text-cyan">${kpis.total}</div></div></div>
            <div class="kpi-card"><div><div class="kpi-label">Dictámenes</div><div class="kpi-value text-emerald">${kpis.dictamenes}</div></div></div>
            <div class="kpi-card"><div><div class="kpi-label">Informes</div><div class="kpi-value" style="color:#60a5fa;">${kpis.informes}</div></div></div>
            <div class="kpi-card"><div><div class="kpi-label">Pendientes</div><div class="kpi-value text-amber">${kpis.pendientes}</div></div></div>
        `;

        window.FGECharts.renderInteractiveCharts(
            document.getElementById('adminReportChartsGrid'),
            filtered,
            selectedDims
        );
    }

    async function exportAdminReportExcel() {
        const { filtered, selectedDims, scopeLabel, dateRangeLabel } = getAdminReportSelection();
        if (filtered.length === 0) {
            window.FGEUI.showToast('No hay registros en la selección actual para exportar.', 'warning');
            return;
        }
        if (selectedDims.length === 0) {
            window.FGEUI.showToast('Marca al menos una gráfica para incluir en el informe.', 'warning');
            return;
        }

        const btn = document.getElementById('btnAdminExportReportExcel');
        btn.disabled = true;
        try {
            window.FGEUI.showToast('Generando informe con gráficas en Excel (.xlsx)...', 'info');
            const { chartImages, summaryTables } = await window.FGECharts.generateExportChartImages(filtered, selectedDims);
            await window.FGEExcel.exportReportWithChartsExcel({
                records: filtered,
                auditLogs: auditList,
                reportTitle: 'INFORME ADMINISTRATIVO — INFORMÁTICA FORENSE FGE',
                scopeLabel,
                dateRangeLabel,
                chartImages,
                summaryTables,
                filePrefix: 'INFORME_ADMIN_FGE'
            });
            window.FGEUI.showToast('Informe con gráficas descargado correctamente.', 'success');
        } catch (err) {
            window.FGEUI.showToast(err.message || 'Error al generar Excel.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    // ======================================================================
    // TAB 4: BASE DE DATOS GLOBAL E HISTORIAL DE CAMBIOS
    // ======================================================================
    function renderAdminDatabaseTab() {
        const esc = window.FGEUI.escapeHtml;
        const userFilterSel = document.getElementById('adminDbUserFilter');
        const prevUser = userFilterSel.value;
        userFilterSel.innerHTML = `<option value="">Todos los usuarios (${usersList.length})</option>` +
            usersList.map(u => `<option value="${esc(u.id)}">${esc(u.fullName)} (@${esc(u.username)})</option>`).join('');
        userFilterSel.value = prevUser;

        const q = window.FGEUI.normalizeText(document.getElementById('adminDbSearch').value);
        const uid = userFilterSel.value;
        const filtered = recordsList.filter((r) => {
            if (uid && r.createdByUserId !== uid) return false;
            if (q) {
                const hay = window.FGEUI.normalizeText([
                    r.numero, r.llamado, r.perito, r.carpetaInvestigacion, r.fiscalia,
                    r.ministerioPublico, r.pericialSolicita, r.evidencia, r.receptor,
                    r.queSeEntrego, r.observaciones, r.custodioRecibeEvidencia, r.createdByName
                ].join(' '));
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        const tbody = document.getElementById('adminDbTableBody');
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="17" class="empty-state">No hay registros en la base de datos.</td></tr>`;
        } else {
            tbody.innerHTML = filtered.map((r) => `
                <tr>
                    <td class="cell-num">${esc(r.numero)}</td>
                    <td class="font-mono font-bold">${esc(r.llamado)}</td>
                    <td>${esc(r.perito)}</td>
                    <td class="font-mono" style="white-space:nowrap;">${esc(window.FGEUI.formatDateDisplay(r.fechaIngreso))}</td>
                    <td class="font-mono">${esc(r.carpetaInvestigacion)}</td>
                    <td>${esc(r.fiscalia)}</td>
                    <td>${esc(r.ministerioPublico)}</td>
                    <td>${esc(r.pericialSolicita)}</td>
                    <td style="text-align:center;">${window.FGEUI.renderEvidenciaBadge(r.evidencia)}</td>
                    <td class="font-mono" style="white-space:nowrap;">${esc(window.FGEUI.formatDateDisplay(r.fechaEntrega))}</td>
                    <td>${esc(r.receptor)}</td>
                    <td>${window.FGEUI.renderEntregaBadge(r.queSeEntrego)}</td>
                    <td class="cell-obs">${esc(r.observaciones)}</td>
                    <td class="font-mono" style="white-space:nowrap;">${r.fechaEntregaEvidencias ? '🔒 ' + esc(window.FGEUI.formatDateDisplay(r.fechaEntregaEvidencias)) : '—'}</td>
                    <td>${r.custodioRecibeEvidencia ? '🔒 ' + esc(r.custodioRecibeEvidencia) : '—'}</td>
                    <td><span class="badge badge-cyan" style="font-size:0.68rem;">${esc(r.createdByName || r.createdByUsername)}</span></td>
                    <td style="text-align:center;">${Number(r.editCount) > 0 ? `<span class="badge badge-amber">${r.editCount}</span>` : '<span class="text-muted">0</span>'}</td>
                </tr>
            `).join('');
        }

        // Historial global de cambios
        document.getElementById('adminAuditTotalLabel').textContent = `${auditList.length} evento(s) registrado(s)`;
        const auditBody = document.getElementById('adminAuditTableBody');
        if (auditList.length === 0) {
            auditBody.innerHTML = `<tr><td colspan="8" class="empty-state">Aún no se han registrado modificaciones en el historial de cambios.</td></tr>`;
        } else {
            auditBody.innerHTML = auditList.map((l) => `
                <tr>
                    <td class="cell-num">#${esc(l.recordNumero)}</td>
                    <td>
                        <span class="badge ${l.action === 'ENTREGA_EVIDENCIAS' ? 'badge-emerald' : 'badge-amber'}">
                            ${l.action === 'ENTREGA_EVIDENCIAS' ? 'Entrega Evidencias' : 'Corrección Campo'}
                        </span>
                    </td>
                    <td class="font-bold">${esc(l.fieldLabel || l.field)}</td>
                    <td><span class="diff-old">${esc(l.oldValue)}</span></td>
                    <td><span class="diff-new">${esc(l.newValue)}</span></td>
                    <td>${esc(l.reason)}</td>
                    <td>${esc(l.editedByName)} <span class="text-xs text-muted">(@${esc(l.editedByUsername)})</span></td>
                    <td class="font-mono text-xs" style="white-space:nowrap;">${esc(window.FGEUI.formatDateTimeDisplay(l.editedAt))}</td>
                </tr>
            `).join('');
        }
    }

    // ======================================================================
    // TAB 5: CONFIGURACIÓN FIREBASE Y RESPALDOS
    // ======================================================================
    function loadFirebaseConfigForm() {
        const cfg = window.FGE_CONFIG.getActiveFirebaseConfig();
        document.getElementById('fbApiKey').value = cfg.apiKey || '';
        document.getElementById('fbAuthDomain').value = cfg.authDomain || '';
        document.getElementById('fbProjectId').value = cfg.projectId || '';
        document.getElementById('fbStorageBucket').value = cfg.storageBucket || '';
        document.getElementById('fbMessagingSenderId').value = cfg.messagingSenderId || '';
        document.getElementById('fbAppId').value = cfg.appId || '';
    }

    async function handleExportFullDatabase() {
        if (recordsList.length === 0) {
            window.FGEUI.showToast('La base de datos aún no tiene registros para descargar.', 'warning');
            return;
        }
        try {
            window.FGEUI.showToast('Generando Excel completo de toda la base de datos...', 'info');
            await window.FGEExcel.exportFullDatabaseExcel(recordsList, auditList, 'BASE_DATOS_COMPLETA_INFORMATICA_FGE');
            window.FGEUI.showToast('Base de datos descargada en Excel (.xlsx).', 'success');
        } catch (err) {
            window.FGEUI.showToast(err.message || 'Error al exportar base de datos.', 'error');
        }
    }

    function bindEvents() {
        // Pestañas
        document.querySelectorAll('.tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(target).classList.add('active');
                if (target === 'tabReports') {
                    setTimeout(renderAdminCharts, 40);
                }
            });
        });

        // Cerrar modales
        document.querySelectorAll('[data-close-modal]').forEach((btn) => {
            btn.addEventListener('click', () => window.FGEUI.closeModal(btn.getAttribute('data-close-modal')));
        });

        // Exportación global BD en Excel
        document.getElementById('btnExportAllDBExcel').addEventListener('click', handleExportFullDatabase);
        document.getElementById('btnExportDbTabExcel').addEventListener('click', handleExportFullDatabase);

        // Salir
        document.getElementById('btnAdminLogout').addEventListener('click', async () => {
            await window.FGEDB.logout();
            window.location.href = 'index.html';
        });

        // Usuarios: crear / editar / resetear / eliminar
        document.getElementById('btnOpenNewUserModal').addEventListener('click', () => openUserModal(null));
        document.getElementById('btnSaveUser').addEventListener('click', saveUserModal);
        document.getElementById('usrPhotoInput').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                pendingUserPhotoDataUrl = await window.FGEUI.compressImageToDataURL(file, 180, 0.84);
                document.getElementById('usrPhotoPreview').src = pendingUserPhotoDataUrl;
            } catch (err) {
                window.FGEUI.showToast(err.message, 'error');
            }
            e.target.value = '';
        });

        document.getElementById('usersGrid').addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-user-act]');
            if (!btn) return;
            const act = btn.getAttribute('data-user-act');
            const id = btn.getAttribute('data-id');
            if (act === 'edit') openUserModal(id);
            else if (act === 'reset') await handleResetUserPassword(id);
            else if (act === 'delete') {
                const u = usersList.find(x => x.id === id);
                if (!u) return;
                if (!confirm(`¿Seguro que deseas eliminar al usuario "${u.fullName}" (@${u.username})? Sus registros históricos se conservarán.`)) return;
                try {
                    await window.FGEDB.deleteUser(id);
                    window.FGEUI.showToast('Usuario eliminado.', 'success');
                    await reloadAll();
                } catch (err) {
                    window.FGEUI.showToast(err.message, 'error');
                }
            }
        });

        // Catálogos: selección de categoría
        document.getElementById('catalogSidebarNav').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-cat-key]');
            if (!btn) return;
            activeCatalogKey = btn.getAttribute('data-cat-key');
            document.getElementById('catalogSearchInput').value = '';
            renderCatalogsUI();
        });

        document.getElementById('catalogSearchInput').addEventListener('input', renderActiveCatalogList);

        document.getElementById('addCatalogItemForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const inp = document.getElementById('newCatalogValueInput');
            const val = inp.value.trim();
            if (!val) return;
            try {
                await window.FGEDB.addCatalogItem(activeCatalogKey, val, { asApproved: true });
                inp.value = '';
                window.FGEUI.showToast(`"${val.toUpperCase()}" agregado oficialmente a la lista.`, 'success');
                await reloadAll();
            } catch (err) {
                window.FGEUI.showToast(err.message, 'error');
            }
        });

        // Acciones sobre elementos de catálogos (pendientes y oficiales)
        const handleCatalogActionClick = async (e) => {
            const btn = e.target.closest('button[data-cat-act]');
            if (!btn) return;
            const act = btn.getAttribute('data-cat-act');
            const id = btn.getAttribute('data-id');
            if (act === 'approve') {
                try {
                    await window.FGEDB.approveCatalogItem(id);
                    window.FGEUI.showToast('Elemento autorizado y adjuntado a la lista oficial.', 'success');
                    await reloadAll();
                } catch (err) {
                    window.FGEUI.showToast(err.message, 'error');
                }
            } else if (act === 'edit') {
                openCatalogEditModal(id);
            } else if (act === 'reject') {
                const it = catalogsState.allItems.find(x => x.id === id);
                if (!it) return;
                if (!confirm(`¿Deseas eliminar "${it.value}" de la lista?`)) return;
                try {
                    await window.FGEDB.rejectCatalogItem(id);
                    window.FGEUI.showToast('Elemento eliminado de la lista.', 'info');
                    await reloadAll();
                } catch (err) {
                    window.FGEUI.showToast(err.message, 'error');
                }
            }
        };
        document.getElementById('pendingCatalogsList').addEventListener('click', handleCatalogActionClick);
        document.getElementById('catalogItemsContainer').addEventListener('click', handleCatalogActionClick);

        document.getElementById('btnConfirmCatalogEdit').addEventListener('click', async () => {
            const id = document.getElementById('catEditId').value;
            const val = document.getElementById('catEditValue').value.trim();
            const prop = document.getElementById('catPropagateCheck').checked;
            if (!val) return;
            try {
                const res = await window.FGEDB.approveCatalogItem(id, { editedValue: val, propagateToRecords: prop });
                window.FGEUI.closeModal('catalogEditModal');
                window.FGEUI.showToast(
                    res.updatedRecords > 0
                        ? `Lista actualizada y propagada a ${res.updatedRecords} registro(s).`
                        : 'Elemento guardado y autorizado correctamente.',
                    'success'
                );
                await reloadAll();
            } catch (err) {
                window.FGEUI.showToast(err.message, 'error');
            }
        });

        // Informes del administrador
        document.getElementById('adminRepScopeMode').addEventListener('change', () => {
            updateReportScopeVisibility();
            renderAdminCharts();
        });
        document.getElementById('adminRepSingleUserSelect').addEventListener('change', renderAdminCharts);
        document.getElementById('adminRepDateFrom').addEventListener('change', renderAdminCharts);
        document.getElementById('adminRepDateTo').addEventListener('change', renderAdminCharts);
        document.getElementById('adminRepMultiCheckboxes').addEventListener('change', renderAdminCharts);
        document.getElementById('adminRepDimsCheckboxes').addEventListener('change', renderAdminCharts);
        document.getElementById('btnSelectAllUsersRep').addEventListener('click', () => {
            document.querySelectorAll('input[name="adminRepUser"]').forEach(c => { c.checked = true; });
            renderAdminCharts();
        });
        document.getElementById('btnClearAllUsersRep').addEventListener('click', () => {
            document.querySelectorAll('input[name="adminRepUser"]').forEach(c => { c.checked = false; });
            renderAdminCharts();
        });
        document.getElementById('btnAdminExportReportExcel').addEventListener('click', exportAdminReportExcel);

        // Filtros Base de Datos Global
        document.getElementById('adminDbSearch').addEventListener('input', renderAdminDatabaseTab);
        document.getElementById('adminDbUserFilter').addEventListener('change', renderAdminDatabaseTab);

        // Firebase config & respaldos
        document.getElementById('firebaseConfigForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const cfg = {
                apiKey: document.getElementById('fbApiKey').value.trim(),
                authDomain: document.getElementById('fbAuthDomain').value.trim(),
                projectId: document.getElementById('fbProjectId').value.trim(),
                storageBucket: document.getElementById('fbStorageBucket').value.trim(),
                messagingSenderId: document.getElementById('fbMessagingSenderId').value.trim(),
                appId: document.getElementById('fbAppId').value.trim()
            };
            if (!cfg.apiKey || !cfg.projectId) {
                window.FGEUI.showToast('Debes ingresar al menos apiKey y projectId de Firebase.', 'warning');
                return;
            }
            window.FGE_CONFIG.saveFirebaseConfigOverride(cfg);
            window.FGEUI.showToast('Configuración de Firebase guardada. Recargando...', 'success');
            setTimeout(() => window.location.reload(), 900);
        });

        document.getElementById('btnResetFirebaseCfg').addEventListener('click', () => {
            window.FGE_CONFIG.clearFirebaseConfigOverride();
            window.FGEUI.showToast('Regresando a Modo Local Offline. Recargando...', 'info');
            setTimeout(() => window.location.reload(), 900);
        });

        document.getElementById('btnImportSampleData').addEventListener('click', async () => {
            if (!confirm('¿Deseas importar los 25 registros de ejemplo de LIBRO_INFORMATICA.xlsx? (No duplicará llamados ya existentes)')) return;
            try {
                const count = await window.FGEDB.importSampleExcelRecords();
                window.FGEUI.showToast(`Se importaron ${count} registro(s) de muestra.`, 'success');
                await reloadAll();
            } catch (err) {
                window.FGEUI.showToast(err.message, 'error');
            }
        });

        document.getElementById('btnExportJsonBackup').addEventListener('click', async () => {
            try {
                const data = await window.FGEDB.exportBackupJSON();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `RESPALDO_FGE_INFORMATICA_${window.FGEUI.getTodayISO()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                window.FGEUI.showToast('Respaldo JSON descargado correctamente.', 'success');
            } catch (err) {
                window.FGEUI.showToast(err.message, 'error');
            }
        });

        // Perfil propio del administrador
        document.getElementById('btnAdminProfile').addEventListener('click', () => {
            document.getElementById('admProfAvatarPreview').src = window.FGEUI.getAvatarSrc(adminUser);
            document.getElementById('admCurPwd').value = '';
            document.getElementById('admNewPwd').value = '';
            document.getElementById('admConfPwd').value = '';
            document.getElementById('admPwdMsg').classList.add('hidden');
            window.FGEUI.openModal('adminProfileModal');
        });

        document.getElementById('admProfPhotoInput').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const url = await window.FGEUI.compressImageToDataURL(file, 180, 0.84);
                adminUser = await window.FGEDB.updateOwnProfile({ photoDataUrl: url });
                document.getElementById('admProfAvatarPreview').src = url;
                document.getElementById('adminAvatar').src = url;
                window.FGEUI.showToast('Fotografía del administrador actualizada.', 'success');
            } catch (err) {
                window.FGEUI.showToast(err.message, 'error');
            }
            e.target.value = '';
        });

        document.getElementById('admProfPwdForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('admPwdMsg');
            msg.classList.add('hidden');
            msg.classList.remove('success', 'danger');
            const cur = document.getElementById('admCurPwd').value;
            const n1 = document.getElementById('admNewPwd').value;
            const n2 = document.getElementById('admConfPwd').value;
            if (n1 !== n2) {
                msg.textContent = 'La confirmación no coincide.';
                msg.classList.add('danger');
                msg.classList.remove('hidden');
                return;
            }
            try {
                await window.FGEDB.updateOwnPassword(cur, n1);
                msg.textContent = 'Contraseña del administrador actualizada correctamente.';
                msg.classList.add('success');
                msg.classList.remove('hidden');
                document.getElementById('admCurPwd').value = '';
                document.getElementById('admNewPwd').value = '';
                document.getElementById('admConfPwd').value = '';
            } catch (err) {
                msg.textContent = err.message;
                msg.classList.add('danger');
                msg.classList.remove('hidden');
            }
        });
    }

    window.addEventListener('DOMContentLoaded', bootstrapAdmin);
})();
