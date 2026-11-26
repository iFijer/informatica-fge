/* ==========================================================================
   EXPORTADOR INSTITUCIONAL A EXCEL (.xlsx) — 100% OFFLINE (ExcelJS local)
   Replica exactamente la estructura y colores de LIBRO_INFORMATICA.xlsx
   + Hoja de Resumen Estadístico + Hoja de Gráficas PNG embebidas + Auditoría
   ========================================================================== */

(function () {
    const EXCEL_COLUMNS = [
        { header: 'NUM',                                 key: 'numero',                  width: 9  },
        { header: 'LLAMADO',                             key: 'llamado',                 width: 17 },
        { header: 'PERITO',                              key: 'perito',                  width: 16 },
        { header: 'FECHA INGRESO',                       key: 'fechaIngreso',            width: 15 },
        { header: 'CARPETA DE INVESTIGACION',            key: 'carpetaInvestigacion',    width: 26 },
        { header: 'FISCALIA',                            key: 'fiscalia',                width: 24 },
        { header: 'MINISTERIO PÚBLICO',                  key: 'ministerioPublico',       width: 36 },
        { header: 'QUE PERICIAL SOLICITA (EVIDENCIA)',   key: 'pericialSolicita',        width: 26 },
        { header: 'EVIDENCIA',                           key: 'evidencia',               width: 12 },
        { header: 'FECHA ENTREGA DICTAMEN',              key: 'fechaEntrega',            width: 18 },
        { header: 'RECEPTOR',                            key: 'receptor',                width: 16 },
        { header: 'QUE SE ENTREGO',                      key: 'queSeEntrego',            width: 16 },
        { header: 'OBSERVACIONES',                       key: 'observaciones',           width: 36 },
        { header: 'FECHA ENTREGA EVIDENCIAS',            key: 'fechaEntregaEvidencias',  width: 20 },
        { header: 'CUSTODIO /AIC QUE RECIBE EVIDENCIA',  key: 'custodioRecibeEvidencia', width: 26 },
        { header: 'CAPTURADO POR',                       key: 'createdByName',           width: 24 },
        { header: 'EDICIONES',                           key: 'editCount',               width: 12 }
    ];

    const THIN_BORDER = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    function formatExcelDate(val) {
        if (!val) return '';
        return window.FGEUI ? window.FGEUI.formatDateDisplay(val) : String(val);
    }

    function downloadWorkbookBuffer(buffer, filename) {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function populateRecordsWorksheet(ws, records, bannerTitle = 'REGISTRO PETICIONES INFORMATICA') {
        ws.columns = EXCEL_COLUMNS.map(c => ({ key: c.key, width: c.width }));

        // Fila 1: Título institucional + Leyenda de Evidencias (exacto a LIBRO_INFORMATICA.xlsx)
        ws.mergeCells('A1:M1');
        const titleCell = ws.getCell('A1');
        titleCell.value = bannerTitle.toUpperCase();
        titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        ws.mergeCells('N1:Q1');
        const legendCell = ws.getCell('N1');
        legendCell.value = 'EV= EVIDENCIAS   |   S=SI   |   N=NO   |   F=FALTA';
        legendCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF78350F' } };
        legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC99' } };
        legendCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        ws.getRow(1).height = 30;

        // Fila 2: Encabezados exactos de las 15 columnas + trazabilidad
        const headerRow = ws.getRow(2);
        EXCEL_COLUMNS.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = col.header;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = THIN_BORDER;
        });
        headerRow.height = 30;

        // Fila 3: Subtítulo "INFORMATICA"
        ws.mergeCells('A3:Q3');
        const subCell = ws.getCell('A3');
        subCell.value = 'INFORMATICA — FISCALÍA GENERAL DEL ESTADO DE MORELOS';
        subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        subCell.alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getRow(3).height = 22;

        // Ordenar por número ascendente en el Excel (1, 2, 3...) como libro oficial
        const ordered = [...(records || [])].sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));

        ordered.forEach((rec, idx) => {
            const row = ws.addRow({
                numero: rec.numero,
                llamado: rec.llamado || '',
                perito: rec.perito || '',
                fechaIngreso: formatExcelDate(rec.fechaIngreso),
                carpetaInvestigacion: rec.carpetaInvestigacion || '',
                fiscalia: rec.fiscalia || '',
                ministerioPublico: rec.ministerioPublico || '',
                pericialSolicita: rec.pericialSolicita || '',
                evidencia: rec.evidencia || '',
                fechaEntrega: formatExcelDate(rec.fechaEntrega),
                receptor: rec.receptor || '',
                queSeEntrego: rec.queSeEntrego || '',
                observaciones: rec.observaciones || '',
                fechaEntregaEvidencias: formatExcelDate(rec.fechaEntregaEvidencias),
                custodioRecibeEvidencia: rec.custodioRecibeEvidencia || '',
                createdByName: rec.createdByName || rec.createdByUsername || '',
                editCount: Number(rec.editCount) || 0
            });

            const isEven = idx % 2 === 1;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                cell.border = THIN_BORDER;
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: (colNumber === 1 || colNumber === 4 || colNumber === 9 || colNumber === 10 || colNumber === 14 || colNumber === 17) ? 'center' : 'left',
                    wrapText: true
                };
                if (isEven) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            });

            // Resaltado condicional institucional en columna EVIDENCIA (9) y QUE SE ENTREGO (12)
            const evNorm = String(rec.evidencia || '').trim().toUpperCase();
            if (evNorm === 'SI' || evNorm === 'S') {
                row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                row.getCell(9).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
            } else if (evNorm === 'F' || evNorm === 'FALTA') {
                row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                row.getCell(9).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
            }

            const qNorm = String(rec.queSeEntrego || '').trim().toUpperCase();
            if (qNorm.includes('PENDIENTE')) {
                row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                row.getCell(12).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
            } else if (qNorm.includes('DICTAMEN')) {
                row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                row.getCell(12).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
            }
        });

        ws.autoFilter = {
            from: { row: 2, column: 1 },
            to: { row: 2, column: EXCEL_COLUMNS.length }
        };
        ws.views = [{ state: 'frozen', ySplit: 3 }];
    }

    function populateAuditWorksheet(ws, auditLogs) {
        ws.columns = [
            { header: 'FOLIO / NUM',     key: 'recordNumero', width: 13 },
            { header: 'ACCIÓN',          key: 'action',       width: 22 },
            { header: 'CAMPO MODIFICADO',key: 'fieldLabel',   width: 30 },
            { header: 'VALOR ANTERIOR',  key: 'oldValue',     width: 28 },
            { header: 'VALOR NUEVO',     key: 'newValue',     width: 28 },
            { header: 'MOTIVO',          key: 'reason',       width: 40 },
            { header: 'EDITADO POR',     key: 'editedByName', width: 25 },
            { header: 'FECHA Y HORA',    key: 'editedAt',     width: 22 }
        ];

        const hRow = ws.getRow(1);
        hRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = THIN_BORDER;
        });
        hRow.height = 26;

        (auditLogs || []).forEach((log) => {
            const r = ws.addRow({
                recordNumero: log.recordNumero || '',
                action: log.action === 'ENTREGA_EVIDENCIAS' ? 'ENTREGA DE EVIDENCIAS' : 'CORRECCIÓN DE CAMPO',
                fieldLabel: log.fieldLabel || log.field || '',
                oldValue: log.oldValue || '',
                newValue: log.newValue || '',
                reason: log.reason || '',
                editedByName: log.editedByName || log.editedByUsername || '',
                editedAt: window.FGEUI ? window.FGEUI.formatDateTimeDisplay(log.editedAt) : log.editedAt
            });
            r.eachCell((cell, idx) => {
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                cell.border = THIN_BORDER;
                cell.alignment = { vertical: 'middle', horizontal: idx === 1 ? 'center' : 'left', wrapText: true };
            });
        });
        ws.views = [{ state: 'frozen', ySplit: 1 }];
    }

    /**
     * Descarga Excel completo de toda la base de datos (Botón del Panel Administrador)
     */
    async function exportFullDatabaseExcel(records, auditLogs = [], filePrefix = 'BASE_DATOS_INFORMATICA_FGE') {
        if (typeof window.ExcelJS === 'undefined') {
            throw new Error('La librería ExcelJS offline no se cargó correctamente.');
        }
        const wb = new window.ExcelJS.Workbook();
        wb.creator = 'Sistema Registro Informática Forense — FGE Morelos';
        wb.created = new Date();

        const wsData = wb.addWorksheet('REGISTRO INFORMATICA', {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        populateRecordsWorksheet(wsData, records, 'REGISTRO PETICIONES INFORMATICA — BASE DE DATOS COMPLETA');

        const wsAudit = wb.addWorksheet('HISTORIAL DE CAMBIOS');
        populateAuditWorksheet(wsAudit, auditLogs);

        const buffer = await wb.xlsx.writeBuffer();
        const dateTag = window.FGEUI ? window.FGEUI.getTodayISO() : new Date().toISOString().slice(0, 10);
        downloadWorkbookBuffer(buffer, `${filePrefix}_${dateTag}.xlsx`);
    }

    /**
     * Descarga Informe con Tablas Estadísticas + Gráficas PNG embebidas en Excel (.xlsx)
     */
    async function exportReportWithChartsExcel({
        records,
        auditLogs = [],
        reportTitle = 'INFORME ESTADÍSTICO — INFORMÁTICA FORENSE FGE',
        scopeLabel = 'General',
        dateRangeLabel = 'Todas las fechas',
        chartImages = [],
        summaryTables = [],
        filePrefix = 'INFORME_INFORMATICA_FGE'
    }) {
        if (typeof window.ExcelJS === 'undefined') {
            throw new Error('La librería ExcelJS offline no se cargó correctamente.');
        }
        const wb = new window.ExcelJS.Workbook();
        wb.creator = 'Sistema Registro Informática Forense — FGE Morelos';
        wb.created = new Date();

        // Hoja 1: Registros incluidos en el informe
        const wsRecords = wb.addWorksheet('REGISTROS DEL INFORME', {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        populateRecordsWorksheet(wsRecords, records, `${reportTitle} (${scopeLabel})`);

        // Hoja 2: Resumen Estadístico por Columnas
        const wsSummary = wb.addWorksheet('RESUMEN ESTADISTICO');
        wsSummary.columns = [
            { width: 44 },
            { width: 16 },
            { width: 16 }
        ];

        wsSummary.mergeCells('A1:C1');
        const stTitle = wsSummary.getCell('A1');
        stTitle.value = reportTitle.toUpperCase();
        stTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        stTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        stTitle.alignment = { vertical: 'middle', horizontal: 'center' };
        wsSummary.getRow(1).height = 28;

        wsSummary.mergeCells('A2:C2');
        const stSub = wsSummary.getCell('A2');
        stSub.value = `Alcance: ${scopeLabel}   |   Periodo: ${dateRangeLabel}   |   Total de registros: ${(records || []).length}`;
        stSub.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
        stSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        stSub.alignment = { vertical: 'middle', horizontal: 'center' };
        wsSummary.getRow(2).height = 22;

        let cursorRow = 4;
        (summaryTables || []).forEach((tbl) => {
            wsSummary.mergeCells(`A${cursorRow}:C${cursorRow}`);
            const secCell = wsSummary.getCell(`A${cursorRow}`);
            secCell.value = tbl.title.toUpperCase();
            secCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            secCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } };
            secCell.alignment = { vertical: 'middle', horizontal: 'left' };
            wsSummary.getRow(cursorRow).height = 22;
            cursorRow++;

            const colHdr = wsSummary.getRow(cursorRow);
            ['CATEGORÍA / VALOR', 'CANTIDAD', 'PORCENTAJE (%)'].forEach((h, i) => {
                const c = colHdr.getCell(i + 1);
                c.value = h;
                c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
                c.border = THIN_BORDER;
            });
            cursorRow++;

            (tbl.rows || []).forEach((r) => {
                const row = wsSummary.getRow(cursorRow);
                row.getCell(1).value = r.label;
                row.getCell(2).value = r.count;
                row.getCell(3).value = `${r.percent}%`;
                row.eachCell((cell, i) => {
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                    cell.border = THIN_BORDER;
                    cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
                });
                cursorRow++;
            });

            cursorRow += 1;
        });

        // Hoja 3: Gráficas PNG de alta resolución incrustadas en cuadrícula de 2 columnas
        const wsCharts = wb.addWorksheet('GRAFICAS DEL INFORME', {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        wsCharts.mergeCells('A1:P1');
        const cTitle = wsCharts.getCell('A1');
        cTitle.value = `GRÁFICAS ESTADÍSTICAS — ${scopeLabel.toUpperCase()} (${dateRangeLabel})`;
        cTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        cTitle.alignment = { vertical: 'middle', horizontal: 'center' };
        wsCharts.getRow(1).height = 30;

        // Configurar anchos uniformes para anclar las imágenes limpiamente
        for (let col = 1; col <= 18; col++) {
            wsCharts.getColumn(col).width = 11;
        }

        (chartImages || []).forEach((imgObj, idx) => {
            const imageId = wb.addImage({
                base64: imgObj.base64,
                extension: 'png'
            });
            const colSlot = idx % 2; // 0 = izquierda, 1 = derecha
            const rowSlot = Math.floor(idx / 2);
            const startCol = colSlot === 0 ? 0.3 : 8.8;
            const startRow = 2.2 + (rowSlot * 16.5);

            wsCharts.addImage(imageId, {
                tl: { col: startCol, row: startRow },
                ext: { width: 560, height: 290 }
            });
        });

        // Hoja 4: Historial de Cambios de los registros del informe (si hay)
        const recIds = new Set((records || []).map(r => r.id));
        const relevantLogs = (auditLogs || []).filter(l => recIds.has(l.recordId));
        if (relevantLogs.length > 0) {
            const wsAudit = wb.addWorksheet('HISTORIAL DE CAMBIOS');
            populateAuditWorksheet(wsAudit, relevantLogs);
        }

        const buffer = await wb.xlsx.writeBuffer();
        const dateTag = window.FGEUI ? window.FGEUI.getTodayISO() : new Date().toISOString().slice(0, 10);
        const safePrefix = String(filePrefix || 'INFORME_FGE').replace(/[^a-zA-Z0-9_-]+/g, '_');
        downloadWorkbookBuffer(buffer, `${safePrefix}_${dateTag}.xlsx`);
    }

    window.FGEExcel = {
        exportFullDatabaseExcel,
        exportReportWithChartsExcel
    };
})();
