/* ==========================================================================
   MOTOR DE INFORMES Y GRÁFICAS (100% OFFLINE — Chart.js local)
   Genera estadísticas por columnas, gráficas interactivas oscuras en pantalla
   y gráficas PNG de alta resolución sobre fondo blanco para insertar en Excel
   ========================================================================== */

(function () {
    const PALETTE = [
        '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
        '#ef4444', '#0ea5e9', '#a855f7', '#eab308', '#22c55e'
    ];

    const REPORT_DIMENSIONS = [
        { key: 'fiscalia',          label: 'Peticiones por Fiscalía',             chartType: 'bar-horizontal', topN: 14 },
        { key: 'queSeEntrego',      label: 'Estatus / Qué se entregó',            chartType: 'doughnut',       topN: 10 },
        { key: 'pericialSolicita',  label: 'Pericial Solicitada (Evidencia)',     chartType: 'bar-horizontal', topN: 12 },
        { key: 'evidencia',         label: 'Recepción de Evidencia (SI / NO / Faltante)',chartType: 'pie',            topN: 8  },
        { key: 'perito',            label: 'Peticiones por Perito',               chartType: 'bar-vertical',   topN: 14 },
        { key: 'receptor',          label: 'Entregas por Receptor',               chartType: 'bar-vertical',   topN: 12 },
        { key: 'ministerioPublico', label: 'Top Ministerios Públicos',            chartType: 'bar-horizontal', topN: 10 },
        { key: 'fechaIngreso',      label: 'Tendencia por Fecha de Ingreso',      chartType: 'line',           topN: 30 }
    ];

    const activeCharts = new Map();

    function aggregateByField(records, fieldKey, { topN = 14, sortByKey = false } = {}) {
        const counts = new Map();
        (records || []).forEach((r) => {
            let val = String(r[fieldKey] || '').trim();
            if (!val) val = 'SIN ESPECIFICAR';
            counts.set(val, (counts.get(val) || 0) + 1);
        });

        let entries = Array.from(counts.entries());
        if (sortByKey) {
            entries.sort((a, b) => a[0].localeCompare(b[0], 'es'));
        } else {
            entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
        }

        if (entries.length > topN && !sortByKey) {
            const head = entries.slice(0, topN - 1);
            const restCount = entries.slice(topN - 1).reduce((sum, [, c]) => sum + c, 0);
            head.push(['OTROS', restCount]);
            entries = head;
        }

        const total = (records || []).length || 1;
        return {
            labels: entries.map(([k]) => fieldKey === 'fechaIngreso' ? window.FGEUI.formatDateDisplay(k) : k),
            rawKeys: entries.map(([k]) => k),
            values: entries.map(([, v]) => v),
            rows: entries.map(([k, v]) => ({
                label: fieldKey === 'fechaIngreso' ? window.FGEUI.formatDateDisplay(k) : k,
                count: v,
                percent: Number(((v / total) * 100).toFixed(1))
            }))
        };
    }

    function computeReportKPIs(records) {
        const list = records || [];
        let dictamenes = 0;
        let informes = 0;
        let pendientes = 0;
        let conEvidenciaSi = 0;
        let evidenciasEntregadas = 0;

        list.forEach((r) => {
            const q = window.FGEUI.normalizeText(r.queSeEntrego);
            if (q.includes('DICTAMEN')) dictamenes++;
            else if (q.includes('INFORME')) informes++;
            else if (q.includes('PENDIENTE')) pendientes++;

            const ev = window.FGEUI.normalizeText(r.evidencia);
            if (ev === 'SI' || ev === 'S') conEvidenciaSi++;

            if (r.fechaEntregaEvidencias || r.custodioRecibeEvidencia) {
                evidenciasEntregadas++;
            }
        });

        return {
            total: list.length,
            dictamenes,
            informes,
            pendientes,
            conEvidenciaSi,
            evidenciasEntregadas
        };
    }

    function buildChartConfig(dim, agg, { theme = 'dark', animate = true } = {}) {
        const isDark = theme === 'dark';
        const textColor = isDark ? '#e2e8f0' : '#0f172a';
        const mutedColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(51, 65, 85, 0.55)' : 'rgba(148, 163, 184, 0.35)';

        const colors = agg.labels.map((_, i) => PALETTE[i % PALETTE.length]);
        const isCircular = dim.chartType === 'doughnut' || dim.chartType === 'pie';
        const isHorizontal = dim.chartType === 'bar-horizontal';
        const isLine = dim.chartType === 'line';

        const chartJsType = isCircular
            ? dim.chartType
            : (isLine ? 'line' : 'bar');

        const dataset = isLine
            ? {
                label: 'Registros',
                data: agg.values,
                borderColor: '#06b6d4',
                backgroundColor: isDark ? 'rgba(6, 182, 212, 0.22)' : 'rgba(6, 182, 212, 0.16)',
                borderWidth: 3,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#ffffff',
                pointRadius: 4,
                fill: true,
                tension: 0.25
            }
            : {
                label: 'Cantidad',
                data: agg.values,
                backgroundColor: isCircular ? colors : colors.map(c => c + (isDark ? 'cc' : 'dd')),
                borderColor: isCircular ? (isDark ? '#0f172a' : '#ffffff') : colors,
                borderWidth: isCircular ? 2 : 1,
                borderRadius: isCircular ? 0 : 6
            };

        return {
            type: chartJsType,
            data: {
                labels: agg.labels,
                datasets: [dataset]
            },
            options: {
                responsive: animate,
                maintainAspectRatio: false,
                animation: animate ? { duration: 450 } : false,
                indexAxis: isHorizontal ? 'y' : 'x',
                plugins: {
                    title: {
                        display: !isDark,
                        text: dim.label.toUpperCase(),
                        color: '#0f172a',
                        font: { family: 'Arial, sans-serif', size: 15, weight: 'bold' },
                        padding: { top: 8, bottom: 14 }
                    },
                    legend: {
                        display: isCircular,
                        position: 'right',
                        labels: {
                            color: textColor,
                            font: { size: 12, weight: '600' },
                            padding: 12,
                            boxWidth: 14
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#67e8f9',
                        borderColor: 'rgba(34, 211, 238, 0.5)',
                        borderWidth: 1
                    }
                },
                scales: isCircular ? {} : {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            color: mutedColor,
                            precision: 0,
                            font: { size: 11 }
                        },
                        grid: { color: gridColor }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            precision: 0,
                            font: { size: 11 }
                        },
                        grid: { color: isHorizontal ? 'transparent' : gridColor }
                    }
                }
            },
            plugins: !isDark ? [{
                id: 'whiteBgAndValues',
                beforeDraw(chart) {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                },
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.font = 'bold 11px Arial, sans-serif';
                    ctx.fillStyle = '#0f172a';
                    const meta = chart.getDatasetMeta(0);
                    const dataArr = chart.data.datasets[0].data;
                    meta.data.forEach((el, idx) => {
                        const val = dataArr[idx];
                        if (val === undefined || val === null) return;
                        if (isCircular) {
                            const pos = el.tooltipPosition();
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(String(val), pos.x, pos.y);
                            ctx.fillStyle = '#0f172a';
                        } else if (isHorizontal) {
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(String(val), el.x + 6, el.y);
                        } else {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(String(val), el.x, el.y - 5);
                        }
                    });
                    ctx.restore();
                }
            }] : []
        };
    }

    function destroyChartsInContainer(containerId) {
        const prefix = containerId + '::';
        for (const [k, instance] of activeCharts.entries()) {
            if (k.startsWith(prefix)) {
                try { instance.destroy(); } catch (e) {}
                activeCharts.delete(k);
            }
        }
    }

    function renderInteractiveCharts(containerEl, records, selectedKeys = null) {
        if (!containerEl) return [];
        const containerId = containerEl.id || 'chartsContainer';
        destroyChartsInContainer(containerId);

        if (!records || records.length === 0) {
            containerEl.innerHTML = `
                <div class="empty-state col-span-full" style="grid-column: 1 / -1;">
                    <p class="text-muted">No hay registros en el rango/selección actual para generar gráficas.</p>
                </div>
            `;
            return [];
        }

        const dims = selectedKeys && selectedKeys.length
            ? REPORT_DIMENSIONS.filter(d => selectedKeys.includes(d.key))
            : REPORT_DIMENSIONS;

        containerEl.innerHTML = dims.map((dim) => `
            <div class="chart-card">
                <h4 class="chart-card-title">
                    <span>${window.FGEUI.escapeHtml(dim.label)}</span>
                    <span class="badge badge-cyan" style="font-size:0.68rem;">${records.length} reg.</span>
                </h4>
                <div class="chart-canvas-wrap">
                    <canvas id="${containerId}_canvas_${dim.key}"></canvas>
                </div>
            </div>
        `).join('');

        const summaryTables = [];

        dims.forEach((dim) => {
            const agg = aggregateByField(records, dim.key, {
                topN: dim.topN,
                sortByKey: dim.key === 'fechaIngreso'
            });
            summaryTables.push({
                key: dim.key,
                title: dim.label,
                rows: agg.rows
            });

            const canvas = document.getElementById(`${containerId}_canvas_${dim.key}`);
            if (canvas && typeof window.Chart !== 'undefined') {
                const cfg = buildChartConfig(dim, agg, { theme: 'dark', animate: true });
                const chartInstance = new window.Chart(canvas.getContext('2d'), cfg);
                activeCharts.set(`${containerId}::${dim.key}`, chartInstance);
            }
        });

        return summaryTables;
    }

    /**
     * Genera PNGs en fondo blanco de alta resolución (860x440) para insertar directamente en el Excel (.xlsx)
     */
    async function generateExportChartImages(records, selectedKeys = null) {
        if (!records || records.length === 0 || typeof window.Chart === 'undefined') {
            return { chartImages: [], summaryTables: [] };
        }
        const dims = selectedKeys && selectedKeys.length
            ? REPORT_DIMENSIONS.filter(d => selectedKeys.includes(d.key))
            : REPORT_DIMENSIONS;

        const chartImages = [];
        const summaryTables = [];

        for (const dim of dims) {
            const agg = aggregateByField(records, dim.key, {
                topN: dim.topN,
                sortByKey: dim.key === 'fechaIngreso'
            });
            summaryTables.push({
                key: dim.key,
                title: dim.label,
                rows: agg.rows
            });

            const offCanvas = document.createElement('canvas');
            offCanvas.width = 860;
            offCanvas.height = 440;
            const cfg = buildChartConfig(dim, agg, { theme: 'light', animate: false });
            const tempChart = new window.Chart(offCanvas.getContext('2d'), cfg);
            tempChart.update('none');
            const base64 = offCanvas.toDataURL('image/png', 1.0);
            tempChart.destroy();

            chartImages.push({
                key: dim.key,
                title: dim.label,
                base64,
                width: 860,
                height: 440
            });
        }

        return { chartImages, summaryTables };
    }

    window.FGECharts = {
        REPORT_DIMENSIONS,
        aggregateByField,
        computeReportKPIs,
        renderInteractiveCharts,
        generateExportChartImages,
        destroyChartsInContainer
    };
})();
