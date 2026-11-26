/* ==========================================================================
   CONTROLADOR DEL SITIO DASHBOARD (REGISTRO, BLOQUEO, AUDITORÍA, INFORMES)
   ========================================================================== */

(function () {
    let currentUser = null;
    let allRecords = [];
    let catalogsState = { allItems: [], byCategory: {}, pendingItems: [] };
    let addCombos = {};
    let corrCombos = {};
    let pendingAddPayload = null;
    let activeEvidenceRecord = null;
    let activeCorrectionRecord = null;
    let lastReportSummaryTables = [];

    async function bootstrapDashboard() {
        currentUser = await window.FGEDB.requireSession({ adminOnly: false });
        if (!currentUser) return;

        window.FGEUI.updateConnectionBadge('connectionStatusPill');
        renderUserNavbar();
        initCombos();
        initReportDimensionCheckboxes();
        bindEvents();
        await reloadAllData();
    }

    function renderUserNavbar() {
        document.getElementById('navUserAvatar').src = window.FGEUI.getAvatarSrc(currentUser);
        document.getElementById('navUserFullName').textContent = currentUser.fullName || currentUser.username;
        document.getElementById('navUserSub').textContent = `@${currentUser.username} · ${currentUser.email || ''}`;
        const roleBadge = document.getElementById('navUserRoleBadge');
        roleBadge.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Perito / Usuario';
        roleBadge.className = currentUser.role === 'admin' ? 'badge badge-amber' : 'badge badge-cyan';

        if (currentUser.role === 'admin') {
            document.getElementById('btnGoAdmin').classList.remove('hidden');
            document.getElementById('repAdminScopeBox').classList.remove('hidden');
        }
    }

    async function reloadAllData() {
        const [cats, recs] = await Promise.all([
            window.FGEDB.getCatalogs(),
            window.FGEDB.getRecords()
        ]);
        catalogsState = cats;
        allRecords = recs;
        populateFilterDropdowns();
        renderTableAndKPIs();
    }

    function initCombos() {
        const comboDefs = [
            { containerId: 'comboAddPerito',        inputId: 'addPerito',        cat: 'peritos',              ph: 'Selecciona o escribe perito...' },
            { containerId: 'comboAddFiscalia',      inputId: 'addFiscalia',      cat: 'fiscalias',            ph: 'Selecciona o escribe fiscalía...' },
            { containerId: 'comboAddMP',            inputId: 'addMP',            cat: 'ministerios_publicos', ph: 'Selecciona o escribe MP...' },
            { containerId: 'comboAddPericial',      inputId: 'addPericial',      cat: 'pericial_solicita',    ph: 'Selecciona o escribe pericial...' },
            { containerId: 'comboAddEvidencia',     inputId: 'addEvidencia',     cat: 'evidencias',           ph: 'SI, NO, F...' },
            { containerId: 'comboAddReceptor',      inputId: 'addReceptor',      cat: 'receptores',           ph: 'Selecciona o escribe receptor...' },
            { containerId: 'comboAddQueSeEntrego',  inputId: 'addQueSeEntrego',  cat: 'que_se_entrego',       ph: 'DICTAMEN, INFORME, PENDIENTE...' }
        ];

        comboDefs.forEach((def) => {
            addCombos[def.cat] = window.FGEUI.createSearchableCombo({
                container: document.getElementById(def.containerId),
                inputId: def.inputId,
                placeholder: def.ph,
                getItems: () => catalogsState.byCategory[def.cat] || [],
                onManualAdd: async (newVal) => {
                    const item = await window.FGEDB.addCatalogItem(def.cat, newVal, {
                        asApproved: currentUser.role === 'admin'
                    });
                    catalogsState = await window.FGEDB.getCatalogs();
                    populateFilterDropdowns();
                    return item;
                }
            });
        });

        const corrDefs = [
            { containerId: 'comboCorrPerito',       inputId: 'corrPerito',       cat: 'peritos',              ph: 'Perito...' },
            { containerId: 'comboCorrFiscalia',     inputId: 'corrFiscalia',     cat: 'fiscalias',            ph: 'Fiscalía...' },
            { containerId: 'comboCorrMP',           inputId: 'corrMP',           cat: 'ministerios_publicos', ph: 'Ministerio Público...' },
            { containerId: 'comboCorrPericial',     inputId: 'corrPericial',     cat: 'pericial_solicita',    ph: 'Pericial...' },
            { containerId: 'comboCorrEvidencia',    inputId: 'corrEvidencia',    cat: 'evidencias',           ph: 'Evidencia...' },
            { containerId: 'comboCorrReceptor',     inputId: 'corrReceptor',     cat: 'receptores',           ph: 'Receptor...' },
            { containerId: 'comboCorrQueSeEntrego', inputId: 'corrQueSeEntrego', cat: 'que_se_entrego',       ph: 'Qué se entregó...' }
        ];

        corrDefs.forEach((def) => {
            corrCombos[def.cat] = window.FGEUI.createSearchableCombo({
                container: document.getElementById(def.containerId),
                inputId: def.inputId,
                placeholder: def.ph,
                getItems: () => catalogsState.byCategory[def.cat] || [],
                onManualAdd: async (newVal) => {
                    const item = await window.FGEDB.addCatalogItem(def.cat, newVal, {
                        asApproved: currentUser.role === 'admin'
                    });
                    catalogsState = await window.FGEDB.getCatalogs();
                    return item;
                }
            });
        });
    }

    function populateFilterDropdowns() {
        const fillSelect = (id, defaultLabel, items) => {
            const sel = document.getElementById(id);
            const prev = sel.value;
            sel.innerHTML = `<option value="">${defaultLabel}</option>` +
                (items || []).map(i => `<option value="${window.FGEUI.escapeHtml(i.value)}">${window.FGEUI.escapeHtml(i.value)}</option>`).join('');
            sel.value = prev;
        };
        fillSelect('filterFiscalia', 'Todas las Fiscalías', catalogsState.byCategory.fiscalias);
        fillSelect('filterEvidencia', 'Evidencia: Todas', catalogsState.byCategory.evidencias);
        fillSelect('filterEntrega', 'Qué se entregó: Todas', catalogsState.byCategory.que_se_entrego);
    }

    function getVisibleRecords() {
        const showAll = document.getElementById('toggleShowAllUsers').checked;
        const q = window.FGEUI.normalizeText(document.getElementById('filterSearch').value);
        const fFisc = window.FGEUI.normalizeText(document.getElementById('filterFiscalia').value);
        const fEvid = window.FGEUI.normalizeText(document.getElementById('filterEvidencia').value);
        const fEntr = window.FGEUI.normalizeText(document.getElementById('filterEntrega').value);

        return allRecords.filter((r) => {
            if (!showAll && r.createdByUserId !== currentUser.id) return false;
            if (fFisc && window.FGEUI.normalizeText(r.fiscalia) !== fFisc) return false;
            if (fEvid && window.FGEUI.normalizeText(r.evidencia) !== fEvid) return false;
            if (fEntr && window.FGEUI.normalizeText(r.queSeEntrego) !== fEntr) return false;
            if (q) {
                const hay = window.FGEUI.normalizeText([
                    r.numero, r.llamado, r.perito, r.fechaIngreso, r.carpetaInvestigacion,
                    r.fiscalia, r.ministerioPublico, r.pericialSolicita, r.evidencia,
                    r.receptor, r.queSeEntrego, r.observaciones, r.custodioRecibeEvidencia,
                    r.createdByName, r.createdByUsername
                ].join(' '));
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }

    function renderTableAndKPIs() {
        const list = getVisibleRecords();
        const showAll = document.getElementById('toggleShowAllUsers').checked;
        document.getElementById('toggleScopeLabel').textContent = showAll
            ? 'Vista: Todos los Usuarios'
            : 'Vista: Mis Registros';

        // KPIs
        const kpis = window.FGECharts.computeReportKPIs(list);
        const sinEvEntrega = list.filter(r => !r.fechaEntregaEvidenciasLocked || !r.custodioRecibeEvidenciaLocked).length;
        document.getElementById('kpiTotal').textContent = kpis.total;
        document.getElementById('kpiEntregados').textContent = kpis.dictamenes + kpis.informes;
        document.getElementById('kpiPendientes').textContent = kpis.pendientes;
        document.getElementById('kpiSinEvidenciaEntrega').textContent = sinEvEntrega;
        document.getElementById('tableCountInfo').textContent = `${list.length} registro${list.length === 1 ? '' : 's'} mostrado${list.length === 1 ? '' : 's'}`;

        const tbody = document.getElementById('recordsTableBody');
        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="17">
                        <div class="empty-state">
                            <svg class="svg-icon text-cyan" style="width:2.6rem;height:2.6rem;opacity:0.65;" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <div>${showAll ? 'No hay registros que coincidan con los filtros.' : 'Aún no tienes registros capturados. Presiona "+ AGREGAR" arriba para registrar el primero.'}</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const esc = window.FGEUI.escapeHtml;
        tbody.innerHTML = list.map((r) => {
            const canTouch = (r.createdByUserId === currentUser.id) || (currentUser.role === 'admin');
            const evPending = !r.fechaEntregaEvidenciasLocked || !r.custodioRecibeEvidenciaLocked;
            const editCount = Number(r.editCount) || 0;

            return `
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
                    <td>${r.receptor ? esc(r.receptor) : '<span class="text-muted">—</span>'}</td>
                    <td>${window.FGEUI.renderEntregaBadge(r.queSeEntrego)}</td>
                    <td class="cell-obs">${r.observaciones ? esc(r.observaciones) : '<span class="text-muted">—</span>'}</td>
                    <td class="font-mono" style="white-space:nowrap;">
                        ${r.fechaEntregaEvidencias
                            ? `<span class="text-emerald font-bold" title="Bloqueado definitivamente">🔒 ${esc(window.FGEUI.formatDateDisplay(r.fechaEntregaEvidencias))}</span>`
                            : '<span class="text-muted">Pendiente</span>'}
                    </td>
                    <td>
                        ${r.custodioRecibeEvidencia
                            ? `<span class="text-emerald font-bold" title="Bloqueado definitivamente">🔒 ${esc(r.custodioRecibeEvidencia)}</span>`
                            : '<span class="text-muted">Pendiente</span>'}
                    </td>
                    <td>
                        <span class="badge ${r.createdByUserId === currentUser.id ? 'badge-cyan' : 'badge-slate'}" style="font-size:0.68rem;">
                            ${esc(r.createdByName || r.createdByUsername || 'Usuario')}
                        </span>
                    </td>
                    <td class="cell-actions">
                        <div class="actions-row">
                            ${canTouch && evPending ? `
                                <button type="button" class="btn-icon emerald" data-act="evidence" data-id="${esc(r.id)}" title="Completar Fecha entrega Evidencias / Custodio (una sola vez)">
                                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                </button>
                            ` : `
                                <span class="btn-icon" style="opacity:0.45; cursor:default;" title="${evPending ? 'Solo lectura (otro usuario)' : 'Entrega de evidencias bloqueada definitivamente'}">
                                    <svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                </span>
                            `}
                            ${canTouch ? `
                                <button type="button" class="btn-icon amber" data-act="correct" data-id="${esc(r.id)}" title="Corregir campo obligatorio (queda registrado en historial)">
                                    <svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </button>
                            ` : ''}
                            <button type="button" class="btn-icon" data-act="history" data-id="${esc(r.id)}" title="Ver historial de cambios (${editCount})">
                                <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                ${editCount > 0 ? `<span style="position:absolute;top:-5px;right:-5px;background:#f59e0b;color:#020617;border-radius:9999px;font-size:0.62rem;font-weight:800;padding:0 4px;line-height:1.3;">${editCount}</span>` : ''}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ======================================================================
    // MODAL AGREGAR (CON VALIDACIÓN PREVIA ANTES DE GUARDAR)
    // ======================================================================
    async function openAddModal() {
        catalogsState = await window.FGEDB.getCatalogs();
        const nextNum = await window.FGEDB.getNextRecordNumber();

        document.getElementById('addNumero').value = nextNum;
        document.getElementById('addLlamado').value = '';
        document.getElementById('addFechaIngreso').value = window.FGEUI.getTodayISO();
        document.getElementById('addCarpeta').value = '';
        document.getElementById('addFechaEntrega').value = '';
        document.getElementById('addObservaciones').value = '';
        document.getElementById('addFechaEvidencias').value = '';
        document.getElementById('addCustodio').value = '';

        Object.values(addCombos).forEach((c) => {
            c.setValue('');
            c.markError(false);
        });
        document.querySelectorAll('#addStepForm .form-control').forEach(el => el.classList.remove('error'));
        document.getElementById('addFormError').classList.add('hidden');

        // Mostrar Paso 1
        document.getElementById('addStepForm').classList.remove('hidden');
        document.getElementById('addStepFormFooter').classList.remove('hidden');
        document.getElementById('addStepConfirm').classList.add('hidden');
        document.getElementById('addStepConfirmFooter').classList.add('hidden');
        pendingAddPayload = null;

        window.FGEUI.openModal('addRecordModal');
    }

    function collectAndValidateAddForm() {
        const errBox = document.getElementById('addFormError');
        errBox.classList.add('hidden');

        const payload = {
            numero: document.getElementById('addNumero').value,
            llamado: document.getElementById('addLlamado').value.trim(),
            perito: addCombos.peritos.getValue(),
            fechaIngreso: document.getElementById('addFechaIngreso').value.trim(),
            carpetaInvestigacion: document.getElementById('addCarpeta').value.trim(),
            fiscalia: addCombos.fiscalias.getValue(),
            ministerioPublico: addCombos.ministerios_publicos.getValue(),
            pericialSolicita: addCombos.pericial_solicita.getValue(),
            evidencia: addCombos.evidencias.getValue(),
            fechaEntrega: document.getElementById('addFechaEntrega').value.trim(),
            receptor: addCombos.receptores.getValue(),
            queSeEntrego: addCombos.que_se_entrego.getValue(),
            observaciones: document.getElementById('addObservaciones').value.trim(),
            fechaEntregaEvidencias: document.getElementById('addFechaEvidencias').value.trim(),
            custodioRecibeEvidencia: document.getElementById('addCustodio').value.trim()
        };

        const requiredChecks = [
            { val: payload.llamado,              el: document.getElementById('addLlamado'),       name: 'Llamado' },
            { val: payload.perito,               combo: addCombos.peritos,                        name: 'Perito' },
            { val: payload.fechaIngreso,         el: document.getElementById('addFechaIngreso'),  name: 'Fecha de ingreso' },
            { val: payload.carpetaInvestigacion, el: document.getElementById('addCarpeta'),       name: 'Carpeta de investigación' },
            { val: payload.fiscalia,             combo: addCombos.fiscalias,                      name: 'Fiscalía' },
            { val: payload.ministerioPublico,    combo: addCombos.ministerios_publicos,           name: 'Ministerio Público' },
            { val: payload.pericialSolicita,     combo: addCombos.pericial_solicita,              name: 'Qué pericial solicita (evidencia)' },
            { val: payload.evidencia,            combo: addCombos.evidencias,                     name: 'Evidencia' }
        ];

        const missing = [];
        requiredChecks.forEach((chk) => {
            const empty = !chk.val;
            if (chk.el) chk.el.classList.toggle('error', empty);
            if (chk.combo) chk.combo.markError(empty);
            if (empty) missing.push(chk.name);
        });

        if (missing.length > 0) {
            errBox.textContent = `Faltan campos obligatorios: ${missing.join(', ')}.`;
            errBox.classList.remove('hidden');
            return null;
        }

        return payload;
    }

    function showAddConfirmStep() {
        const payload = collectAndValidateAddForm();
        if (!payload) return;
        pendingAddPayload = payload;

        const esc = window.FGEUI.escapeHtml;
        const rows = [
            ['1. Número (Consecutivo)', `#${payload.numero}`],
            ['2. Llamado', payload.llamado.toUpperCase()],
            ['3. Perito', payload.perito.toUpperCase()],
            ['4. Fecha de ingreso', window.FGEUI.formatDateDisplay(payload.fechaIngreso)],
            ['5. Carpeta de investigación', payload.carpetaInvestigacion.toUpperCase()],
            ['6. Fiscalía', payload.fiscalia.toUpperCase()],
            ['7. Ministerio Público', payload.ministerioPublico.toUpperCase()],
            ['8. Qué pericial solicita (evidencia)', payload.pericialSolicita.toUpperCase()],
            ['9. Evidencia', payload.evidencia.toUpperCase()],
            ['10. Fecha de entrega (Dictamen)', payload.fechaEntrega ? window.FGEUI.formatDateDisplay(payload.fechaEntrega) : 'Sin capturar (opcional)'],
            ['11. Receptor', payload.receptor ? payload.receptor.toUpperCase() : 'Sin capturar (opcional)'],
            ['12. Qué se entregó', payload.queSeEntrego ? payload.queSeEntrego.toUpperCase() : 'Sin capturar (opcional)'],
            ['13. Observaciones', payload.observaciones ? payload.observaciones.toUpperCase() : 'Sin capturar (opcional)'],
            ['14. Fecha entrega Evidencias', payload.fechaEntregaEvidencias ? `🔒 ${window.FGEUI.formatDateDisplay(payload.fechaEntregaEvidencias)} (Se bloqueará definitivamente)` : 'Vacío (editable después una sola vez)'],
            ['15. Custodio / AIC que recibe', payload.custodioRecibeEvidencia ? `🔒 ${payload.custodioRecibeEvidencia.toUpperCase()} (Se bloqueará definitivamente)` : 'Vacío (editable después una sola vez)']
        ];

        document.getElementById('addConfirmSummaryGrid').innerHTML = rows.map(([k, v], i) => `
            <div class="summary-item ${i === 12 ? 'col-span-full' : ''}">
                <div class="summary-item-label">${esc(k)}</div>
                <div class="summary-item-value">${esc(v)}</div>
            </div>
        `).join('');

        document.getElementById('addStepForm').classList.add('hidden');
        document.getElementById('addStepFormFooter').classList.add('hidden');
        document.getElementById('addStepConfirm').classList.remove('hidden');
        document.getElementById('addStepConfirmFooter').classList.remove('hidden');
    }

    async function commitAddRecord() {
        if (!pendingAddPayload) return;
        const btn = document.getElementById('btnConfirmSaveRecord');
        btn.disabled = true;
        try {
            const saved = await window.FGEDB.createRecord(pendingAddPayload);
            window.FGEUI.closeModal('addRecordModal');
            await reloadAllData();
            window.FGEUI.showToast(`Registro #${saved.numero} guardado y bloqueado correctamente.`, 'success');
        } catch (err) {
            window.FGEUI.showToast(err.message || 'No se pudo guardar el registro.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    // ======================================================================
    // MODAL COMPLETAR ENTREGA DE EVIDENCIAS (UNA SOLA VEZ)
    // ======================================================================
    function openEvidenceModal(recordId) {
        const rec = allRecords.find(r => r.id === recordId);
        if (!rec) return;
        activeEvidenceRecord = rec;

        document.getElementById('evModalNum').textContent = rec.numero;
        const fInput = document.getElementById('evFechaInput');
        const cInput = document.getElementById('evCustodioInput');
        const fLock = document.getElementById('evFechaLockBadge');
        const cLock = document.getElementById('evCustodioLockBadge');

        fInput.value = rec.fechaEntregaEvidencias || '';
        fInput.disabled = Boolean(rec.fechaEntregaEvidenciasLocked);
        fLock.classList.toggle('hidden', !rec.fechaEntregaEvidenciasLocked);

        cInput.value = rec.custodioRecibeEvidencia || '';
        cInput.disabled = Boolean(rec.custodioRecibeEvidenciaLocked);
        cLock.classList.toggle('hidden', !rec.custodioRecibeEvidenciaLocked);

        document.getElementById('evConfirmCheck').checked = false;
        document.getElementById('evModalError').classList.add('hidden');
        window.FGEUI.openModal('evidenceModal');
    }

    async function saveEvidenceDelivery() {
        if (!activeEvidenceRecord) return;
        const errBox = document.getElementById('evModalError');
        errBox.classList.add('hidden');

        if (!document.getElementById('evConfirmCheck').checked) {
            errBox.textContent = 'Marca la casilla de confirmación antes de bloquear los datos.';
            errBox.classList.remove('hidden');
            return;
        }

        const btn = document.getElementById('btnSaveEvidenceDelivery');
        btn.disabled = true;
        try {
            await window.FGEDB.completeEvidenceDelivery(activeEvidenceRecord.id, {
                fechaEntregaEvidencias: document.getElementById('evFechaInput').value.trim(),
                custodioRecibeEvidencia: document.getElementById('evCustodioInput').value.trim()
            });
            window.FGEUI.closeModal('evidenceModal');
            await reloadAllData();
            window.FGEUI.showToast('Entrega de evidencias registrada y bloqueada definitivamente.', 'success');
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            btn.disabled = false;
        }
    }

    // ======================================================================
    // MODAL CORRECCIÓN AUDITADA (CON HISTORIAL DE CAMBIOS)
    // ======================================================================
    async function openCorrectionModal(recordId) {
        const rec = allRecords.find(r => r.id === recordId);
        if (!rec) return;
        catalogsState = await window.FGEDB.getCatalogs();
        activeCorrectionRecord = rec;

        document.getElementById('corrModalNum').textContent = rec.numero;
        document.getElementById('corrLlamado').value = rec.llamado || '';
        corrCombos.peritos.setValue(rec.perito || '');
        document.getElementById('corrFechaIngreso').value = rec.fechaIngreso || '';
        document.getElementById('corrCarpeta').value = rec.carpetaInvestigacion || '';
        corrCombos.fiscalias.setValue(rec.fiscalia || '');
        corrCombos.ministerios_publicos.setValue(rec.ministerioPublico || '');
        corrCombos.pericial_solicita.setValue(rec.pericialSolicita || '');
        corrCombos.evidencias.setValue(rec.evidencia || '');
        document.getElementById('corrFechaEntrega').value = rec.fechaEntrega || '';
        corrCombos.receptores.setValue(rec.receptor || '');
        corrCombos.que_se_entrego.setValue(rec.queSeEntrego || '');
        document.getElementById('corrObservaciones').value = rec.observaciones || '';
        document.getElementById('corrReason').value = '';
        document.getElementById('corrModalError').classList.add('hidden');

        window.FGEUI.openModal('correctModal');
    }

    async function applyCorrection() {
        if (!activeCorrectionRecord) return;
        const errBox = document.getElementById('corrModalError');
        errBox.classList.add('hidden');
        const reason = document.getElementById('corrReason').value.trim();

        const btn = document.getElementById('btnApplyCorrection');
        btn.disabled = true;
        try {
            const res = await window.FGEDB.correctRecordFields(activeCorrectionRecord.id, {
                llamado: document.getElementById('corrLlamado').value.trim(),
                perito: corrCombos.peritos.getValue(),
                fechaIngreso: document.getElementById('corrFechaIngreso').value.trim(),
                carpetaInvestigacion: document.getElementById('corrCarpeta').value.trim(),
                fiscalia: corrCombos.fiscalias.getValue(),
                ministerioPublico: corrCombos.ministerios_publicos.getValue(),
                pericialSolicita: corrCombos.pericial_solicita.getValue(),
                evidencia: corrCombos.evidencias.getValue(),
                fechaEntrega: document.getElementById('corrFechaEntrega').value.trim(),
                receptor: corrCombos.receptores.getValue(),
                queSeEntrego: corrCombos.que_se_entrego.getValue(),
                observaciones: document.getElementById('corrObservaciones').value.trim()
            }, reason);

            window.FGEUI.closeModal('correctModal');
            await reloadAllData();
            window.FGEUI.showToast(`Se registraron ${res.changesCount} cambio(s) en el historial de auditoría.`, 'success');
        } catch (err) {
            errBox.textContent = err.message;
            errBox.classList.remove('hidden');
        } finally {
            btn.disabled = false;
        }
    }

    // ======================================================================
    // MODAL HISTORIAL DE CAMBIOS DE UN REGISTRO
    // ======================================================================
    async function openHistoryModal(recordId) {
        const rec = allRecords.find(r => r.id === recordId);
        if (!rec) return;
        document.getElementById('histModalNum').textContent = rec.numero;
        const body = document.getElementById('historyModalBody');
        body.innerHTML = `<div class="text-muted text-center">Cargando historial...</div>`;
        window.FGEUI.openModal('historyModal');

        const logs = await window.FGEDB.getAuditLogs(recordId);
        const esc = window.FGEUI.escapeHtml;

        if (logs.length === 0) {
            body.innerHTML = `
                <div class="info-box success">
                    <strong>Registro íntegro sin modificaciones.</strong><br>
                    Capturado originalmente por <strong>${esc(rec.createdByName || rec.createdByUsername)}</strong>
                    el ${esc(window.FGEUI.formatDateTimeDisplay(rec.createdAt))}.
                </div>
            `;
            return;
        }

        body.innerHTML = `
            <div class="info-box mb-3">
                Capturado originalmente por <strong>${esc(rec.createdByName || rec.createdByUsername)}</strong>
                el ${esc(window.FGEUI.formatDateTimeDisplay(rec.createdAt))}.
                Total de eventos registrados: <strong>${logs.length}</strong>.
            </div>
            <div class="audit-timeline">
                ${logs.map((l) => `
                    <div class="audit-entry ${l.action === 'ENTREGA_EVIDENCIAS' ? 'evidencia' : ''}">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <span class="badge ${l.action === 'ENTREGA_EVIDENCIAS' ? 'badge-emerald' : 'badge-amber'}">
                                ${l.action === 'ENTREGA_EVIDENCIAS' ? 'Entrega de Evidencias' : 'Corrección de Campo'}
                            </span>
                            <span class="text-xs text-muted font-mono">${esc(window.FGEUI.formatDateTimeDisplay(l.editedAt))}</span>
                        </div>
                        <div class="font-bold">${esc(l.fieldLabel || l.field)}</div>
                        <div class="audit-diff">
                            <span class="diff-old">${esc(l.oldValue)}</span>
                            <span>→</span>
                            <span class="diff-new">${esc(l.newValue)}</span>
                        </div>
                        <div class="text-sm text-muted"><strong>Motivo:</strong> ${esc(l.reason)}</div>
                        <div class="text-xs text-cyan">Editado por: ${esc(l.editedByName)} (@${esc(l.editedByUsername)})</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ======================================================================
    // MODAL MI INFORME Y GRÁFICAS (EXCLUSIVO DEL USUARIO + EXPORTACIÓN EXCEL)
    // ======================================================================
    function initReportDimensionCheckboxes() {
        const container = document.getElementById('reportDimensionCheckboxes');
        const esc = window.FGEUI.escapeHtml;
        container.innerHTML = window.FGECharts.REPORT_DIMENSIONS.map((d) => `
            <label class="user-check-chip">
                <input type="checkbox" name="repDim" value="${esc(d.key)}" checked>
                <span>${esc(d.label)}</span>
            </label>
        `).join('');
    }

    function getSelectedReportDimensions() {
        return Array.from(document.querySelectorAll('input[name="repDim"]:checked')).map(el => el.value);
    }

    function getReportFilteredRecords() {
        const from = document.getElementById('repDateFrom').value;
        const to = document.getElementById('repDateTo').value;
        const adminScope = currentUser.role === 'admin'
            ? document.getElementById('repAdminScope').value
            : 'mine';

        return allRecords.filter((r) => {
            // Regla estricta: cada usuario genera su informe exclusivamente; solo admin puede elegir todos
            if (adminScope !== 'all' && r.createdByUserId !== currentUser.id) return false;
            if (from && r.fechaIngreso && r.fechaIngreso < from) return false;
            if (to && r.fechaIngreso && r.fechaIngreso > to) return false;
            return true;
        });
    }

    function renderReportModalContent() {
        const recs = getReportFilteredRecords();
        const selectedDims = getSelectedReportDimensions();
        const kpis = window.FGECharts.computeReportKPIs(recs);

        const adminScope = currentUser.role === 'admin'
            ? document.getElementById('repAdminScope').value
            : 'mine';
        document.getElementById('reportScopeNote').textContent = adminScope === 'all'
            ? `Informe Global (Todos los usuarios) · ${recs.length} registros`
            : `Informe Exclusivo de ${currentUser.fullName} (@${currentUser.username}) · ${recs.length} registros`;

        document.getElementById('reportKpiStrip').innerHTML = `
            <div class="kpi-card"><div><div class="kpi-label">Total Peticiones</div><div class="kpi-value text-cyan">${kpis.total}</div></div></div>
            <div class="kpi-card"><div><div class="kpi-label">Dictámenes</div><div class="kpi-value text-emerald">${kpis.dictamenes}</div></div></div>
            <div class="kpi-card"><div><div class="kpi-label">Informes</div><div class="kpi-value" style="color:#60a5fa;">${kpis.informes}</div></div></div>
            <div class="kpi-card"><div><div class="kpi-label">Pendientes</div><div class="kpi-value text-amber">${kpis.pendientes}</div></div></div>
        `;

        lastReportSummaryTables = window.FGECharts.renderInteractiveCharts(
            document.getElementById('reportChartsGrid'),
            recs,
            selectedDims
        );
    }

    async function exportUserReportToExcel() {
        const recs = getReportFilteredRecords();
        if (recs.length === 0) {
            window.FGEUI.showToast('No hay registros en este informe para exportar.', 'warning');
            return;
        }
        const selectedDims = getSelectedReportDimensions();
        if (selectedDims.length === 0) {
            window.FGEUI.showToast('Selecciona al menos una columna de gráfica para el informe.', 'warning');
            return;
        }

        const btn = document.getElementById('btnExportReportExcel');
        btn.disabled = true;
        try {
            window.FGEUI.showToast('Generando Excel con tablas estadísticas y gráficas...', 'info');
            const { chartImages, summaryTables } = await window.FGECharts.generateExportChartImages(recs, selectedDims);
            const auditLogs = await window.FGEDB.getAuditLogs();
            const from = document.getElementById('repDateFrom').value;
            const to = document.getElementById('repDateTo').value;
            const dateRangeLabel = (from || to)
                ? `${from ? window.FGEUI.formatDateDisplay(from) : 'Inicio'} a ${to ? window.FGEUI.formatDateDisplay(to) : 'Hoy'}`
                : 'Todas las fechas';
            const adminScope = currentUser.role === 'admin' ? document.getElementById('repAdminScope').value : 'mine';
            const scopeLabel = adminScope === 'all' ? 'TODOS LOS USUARIOS' : currentUser.fullName;

            await window.FGEExcel.exportReportWithChartsExcel({
                records: recs,
                auditLogs,
                reportTitle: 'INFORME PERICIAL DE INFORMÁTICA FORENSE',
                scopeLabel,
                dateRangeLabel,
                chartImages,
                summaryTables,
                filePrefix: `INFORME_${currentUser.username}`
            });
            window.FGEUI.showToast('Informe con gráficas descargado en Excel (.xlsx).', 'success');
        } catch (err) {
            window.FGEUI.showToast(err.message || 'Error al generar el Excel.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    // ======================================================================
    // MODAL MI PERFIL (FOTOGRAFÍA Y CONTRASEÑA)
    // ======================================================================
    function openProfileModal() {
        document.getElementById('profileAvatarPreview').src = window.FGEUI.getAvatarSrc(currentUser);
        document.getElementById('profileNameLabel').textContent = currentUser.fullName;
        document.getElementById('profileEmailLabel').textContent = `@${currentUser.username} · ${currentUser.email}`;
        document.getElementById('profCurrentPwd').value = '';
        document.getElementById('profNewPwd').value = '';
        document.getElementById('profConfirmPwd').value = '';
        document.getElementById('profilePwdMsg').classList.add('hidden');
        window.FGEUI.openModal('profileModal');
    }

    function bindEvents() {
        // Cerrar modales
        document.querySelectorAll('[data-close-modal]').forEach((btn) => {
            btn.addEventListener('click', () => window.FGEUI.closeModal(btn.getAttribute('data-close-modal')));
        });

        // Botones de barra superior
        document.getElementById('btnOpenAddModal').addEventListener('click', openAddModal);
        document.getElementById('btnOpenReportModal').addEventListener('click', () => {
            window.FGEUI.openModal('reportModal');
            setTimeout(renderReportModalContent, 60);
        });
        document.getElementById('btnOpenProfileModal').addEventListener('click', openProfileModal);
        document.getElementById('btnLogout').addEventListener('click', async () => {
            await window.FGEDB.logout();
            window.location.href = 'index.html';
        });

        // Filtros y toggle
        document.getElementById('toggleShowAllUsers').addEventListener('change', renderTableAndKPIs);
        document.getElementById('filterSearch').addEventListener('input', renderTableAndKPIs);
        document.getElementById('filterFiscalia').addEventListener('change', renderTableAndKPIs);
        document.getElementById('filterEvidencia').addEventListener('change', renderTableAndKPIs);
        document.getElementById('filterEntrega').addEventListener('change', renderTableAndKPIs);
        document.getElementById('btnClearFilters').addEventListener('click', () => {
            document.getElementById('filterSearch').value = '';
            document.getElementById('filterFiscalia').value = '';
            document.getElementById('filterEvidencia').value = '';
            document.getElementById('filterEntrega').value = '';
            renderTableAndKPIs();
        });

        // Acciones delegadas de filas en tabla
        document.getElementById('recordsTableBody').addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-act]');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            const id = btn.getAttribute('data-id');
            if (act === 'evidence') openEvidenceModal(id);
            else if (act === 'correct') openCorrectionModal(id);
            else if (act === 'history') openHistoryModal(id);
        });

        // Modal Agregar 2 pasos
        document.getElementById('btnValidateBeforeSave').addEventListener('click', showAddConfirmStep);
        document.getElementById('btnBackToAddForm').addEventListener('click', () => {
            document.getElementById('addStepConfirm').classList.add('hidden');
            document.getElementById('addStepConfirmFooter').classList.add('hidden');
            document.getElementById('addStepForm').classList.remove('hidden');
            document.getElementById('addStepFormFooter').classList.remove('hidden');
        });
        document.getElementById('btnConfirmSaveRecord').addEventListener('click', commitAddRecord);

        // Modal Evidencias
        document.getElementById('btnSaveEvidenceDelivery').addEventListener('click', saveEvidenceDelivery);

        // Modal Correcciones
        document.getElementById('btnApplyCorrection').addEventListener('click', applyCorrection);

        // Modal Informes
        document.getElementById('btnRefreshReport').addEventListener('click', renderReportModalContent);
        document.getElementById('repDateFrom').addEventListener('change', renderReportModalContent);
        document.getElementById('repDateTo').addEventListener('change', renderReportModalContent);
        document.getElementById('repAdminScope').addEventListener('change', renderReportModalContent);
        document.getElementById('reportDimensionCheckboxes').addEventListener('change', renderReportModalContent);
        document.getElementById('btnExportReportExcel').addEventListener('click', exportUserReportToExcel);

        // Perfil: actualizar foto
        document.getElementById('profilePhotoInput').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            try {
                const dataUrl = await window.FGEUI.compressImageToDataURL(file, 180, 0.84);
                currentUser = await window.FGEDB.updateOwnProfile({ photoDataUrl: dataUrl });
                document.getElementById('profileAvatarPreview').src = dataUrl;
                document.getElementById('navUserAvatar').src = dataUrl;
                window.FGEUI.showToast('Fotografía de perfil actualizada.', 'success');
            } catch (err) {
                window.FGEUI.showToast(err.message || 'No se pudo procesar la fotografía.', 'error');
            }
            e.target.value = '';
        });

        // Perfil: actualizar contraseña
        document.getElementById('profilePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('profilePwdMsg');
            msg.classList.add('hidden');
            msg.classList.remove('success', 'danger');

            const cur = document.getElementById('profCurrentPwd').value;
            const next = document.getElementById('profNewPwd').value;
            const conf = document.getElementById('profConfirmPwd').value;
            if (next !== conf) {
                msg.textContent = 'La confirmación de la nueva contraseña no coincide.';
                msg.classList.add('danger');
                msg.classList.remove('hidden');
                return;
            }
            try {
                await window.FGEDB.updateOwnPassword(cur, next);
                msg.textContent = 'Contraseña actualizada correctamente.';
                msg.classList.add('success');
                msg.classList.remove('hidden');
                document.getElementById('profCurrentPwd').value = '';
                document.getElementById('profNewPwd').value = '';
                document.getElementById('profConfirmPwd').value = '';
                window.FGEUI.showToast('Tu contraseña ha sido actualizada.', 'success');
            } catch (err) {
                msg.textContent = err.message;
                msg.classList.add('danger');
                msg.classList.remove('hidden');
            }
        });
    }

    window.addEventListener('DOMContentLoaded', bootstrapDashboard);
})();
