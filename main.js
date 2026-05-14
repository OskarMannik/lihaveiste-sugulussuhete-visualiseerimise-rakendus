const STATUS_MAP = {
    1: 'lehmik',
    2: 'lehm',
    3: 'pull',
    5: 'lehmik',
    6: 'amm',
    7: 'pull',
    8: 'tõupull',
    9: 'härg',
    10: null, // need on loomad, kellel pole staatuse kirjet db-s
    11: null
};

document.addEventListener("DOMContentLoaded", function () {

    const config = window.GRAPH;

    if (config.view === "animal") {
        loadAnimalGraph();
    }

    if (config.view === "breeder") {
        loadBreederGraph();
    }

});

window.addEventListener("resize", () => {
    if (!window.currentTreeData) return;
    if (window.GRAPH.view === "breeder") {
        drawBreederGraph(window.currentTreeData, document.getElementById("herdId")?.value);
    } else {
        drawAnimalGraph(window.currentTreeData);
    }
});

/**
 * Sorteerib andmed põlvkonna järgi CSV, PDF ja XLS allalaadimiseks. Esimesena tuleb loom ise (tase 0), siis vanemad (tase -1) ja seejärel järglased.
 * @param data
 * @returns {*[]}
 */
function sortByPedigreeLevel(data) {
    const order = level => {
        if (level === 0) return 0;
        if (level === -1) return 1;
        return level + 1;
    };
    return [...data].sort((a, b) => {
        const la = (a.PEDIGREE_LEVEL ?? 1) - 1;
        const lb = (b.PEDIGREE_LEVEL ?? 1) - 1;
        return order(la) - order(lb);
    });
}

/**
 * Leiab loomade vanemate reg. nr-d ID-de kaudu.
 * @param data
 * @returns {{}}
 */
function buildParentRegMap(data) {
    const parentRegMap = {};
    data.forEach(d => {
        if (d.PARENT_ID) {
            const parent = data.find(p => p.ANIMAL_ID == d.PARENT_ID);
            parentRegMap[d.REGISTERED_NUMBER] = parent ? parent.REGISTERED_NUMBER : '';
        } else {
            parentRegMap[d.REGISTERED_NUMBER] = '';
        }
    });
    return parentRegMap;
}


/**
 * Genereerib ja loob võimaluse CSV faili põlvnemisandmetega alla laadida.
 * @param data
 */
function downloadCSV(data) {

    const subject = data.find(d => d.PEDIGREE_LEVEL == 1);
    const regNr = subject?.REGISTERED_NUMBER?.replace(/[^a-zA-Z0-9]/g, '_');

    if (!data || !data.length) return;

    data = sortByPedigreeLevel(data);

    const parentRegMap = buildParentRegMap(data);

    const headers = ['Reg. nr.', 'Põlvkond', 'Sünd', 'Väljaminek', 'Ema/isa reg. nr.', 'Tõug', 'Staatus', 'Inbr. koef (%)', 'Nimi'];

    const rows = data.map(d => [
        d.REGISTERED_NUMBER,
        d.PEDIGREE_LEVEL - 1,
        d.BIRTHDAY ?? '',
        d.DATE_OF_DEATH ?? '',
        parentRegMap[d.REGISTERED_NUMBER] ?? '',
        d.BREED ?? '',
        STATUS_MAP[d.STATUS] ?? '',
        d.INBR,
        d.NAME ?? ''
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sugupuu_${regNr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}


/**
 * Genereerib ja loob võimaluse XLSX faili põlvnemisandmetega alla laadida.
 * @param data
 */
function downloadXLSX(data) {

    const subject = data.find(d => d.PEDIGREE_LEVEL == 1);
    const regNr = subject?.REGISTERED_NUMBER?.replace(/[^a-zA-Z0-9]/g, '_');

    if (!data || !data.length) return;

    data = sortByPedigreeLevel(data);

    const parentRegMap = buildParentRegMap(data);

    const rows = data.map(d => ({
        'Reg. nr.':        d.REGISTERED_NUMBER,
        'Põlvkond':        d.PEDIGREE_LEVEL - 1,
        'Sünd':            d.BIRTHDAY ?? '',
        'Väljaminek':      d.DATE_OF_DEATH ?? '',
        'Ema/isa reg. nr.': parentRegMap[d.REGISTERED_NUMBER] ?? '',
        'Tõug':            d.BREED ?? '',
        'Staatus':         STATUS_MAP[d.STATUS] ?? '',
        'Inbr. koef (%)':  d.INBR,
        'Nimi':            d.NAME ?? ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sugupuu');
    XLSX.writeFile(wb, `sugupuu_${regNr}.xlsx`);
}


/**
 * Genereerib ja loob võimaluse PDF faili põlvnemisandmetega alla laadida.
 * @param data
 */
function downloadPDF(data) {

    const subject = data.find(d => d.PEDIGREE_LEVEL == 1);
    const regNr = subject?.REGISTERED_NUMBER?.replace(/[^a-zA-Z0-9]/g, '_');

    if (!data || !data.length) return;

    data = sortByPedigreeLevel(data);

    const parentRegMap = buildParentRegMap(data);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.autoTable({
        head: [['Reg. nr.', 'Põlvkond', 'Sünd', 'Väljaminek', 'Ema/isa reg. nr.', 'Tõug', 'Staatus', 'Inbr. koef (%)', 'Nimi']],
        body: data.map(d => [
            d.REGISTERED_NUMBER ?? '',
            d.PEDIGREE_LEVEL - 1,
            d.BIRTHDAY ?? '',
            d.DATE_OF_DEATH ?? '',
            parentRegMap[d.REGISTERED_NUMBER] ?? '',
            d.BREED ?? '',
            STATUS_MAP[d.STATUS] ?? '',
            d.INBR,
            d.NAME ?? ''
        ])
    });
    doc.save(`sugupuu_${regNr}.pdf`);
}


/**
 * Graafiku laadimise märke kuvamine kasutajale.
 * @param loading
 */
function setGraphLoading(loading) {
    const el = document.getElementById('graph-loading');
    if (el) el.style.display = loading ? 'flex' : 'none';
}


/**
 * Universaalne legendi koostamise funktsioon.
 * @param svg
 * @param W
 * @param H
 * @param items
 */
function renderGraphLegend(svg, W, H, items) {
    const padding     = 8;
    const itemHeight  = 22;
    const legendHeight = 14 + items.length * itemHeight;

    const legend = svg.append("g")
        .attr("transform", `translate(${padding}, ${H - legendHeight - padding})`);

    legend.append("rect")
        .attr("width", 180)
        .attr("height", legendHeight)
        .attr("rx", 8)
        .attr("fill", "rgba(255,255,255,0.85)")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 0.5);

    items.forEach((item, i) => {
        const y    = 10 + i * itemHeight;
        const g    = legend.append("g").attr("transform", `translate(14, ${y})`);
        const midY = 9;

        if (item.type === "node" || item.type === "dead") {
            const fillColor   = item.type === "dead" ? "#E0DED8" : item.color + "30";
            const strokeColor = item.type === "dead" ? "#B4B2A9" : item.color;
            const strokeDash  = item.type === "dead" ? "4,3" : null;

            g.append("rect")
                .attr("width", 18).attr("height", 18)
                .attr("rx", 4)
                .attr("fill", fillColor)
                .attr("stroke", strokeColor)
                .attr("stroke-width", 1.5)
                .attr("stroke-dasharray", strokeDash);

            g.append("circle")
                .attr("cx", 9).attr("cy", 9).attr("r", 3.5)
                .attr("fill", strokeColor);

        } else if (item.type === "highlight") {
            g.append("rect")
                .attr("width", 18).attr("height", 18)
                .attr("rx", 4)
                .attr("fill", "rgba(255,161,0,0.2)")
                .attr("stroke", "#FFA100")
                .attr("stroke-width", 2);

        } else if (item.type === "edge") {
            g.append("line")
                .attr("x1", 0).attr("y1", midY)
                .attr("x2", 14).attr("y2", midY)
                .attr("stroke", item.color)
                .attr("stroke-width", 2)
                .attr("stroke-opacity", 0.8);

            g.append("polygon")
                .attr("points", `10,${midY - 4} 18,${midY} 10,${midY + 4}`)
                .attr("fill", item.color)
                .attr("opacity", 0.8);
        }

        g.append("text")
            .attr("x", 28)
            .attr("y", midY)
            .attr("dominant-baseline", "central")
            .style("font-size", "11.5px")
            .style("font-family", "Merriweather Sans, sans-serif")
            .attr("fill", "#1b3d2b")
            .text(item.label);
    });
}

/**
 * Graafikul liikumiseks loodud juhtpaneeli loomise funktsioon.
 * @param wrapper
 * @param zoom
 * @param svg
 * @param centerX
 * @param centerY
 * @param scale
 */
function renderZoomButtons(wrapper, zoom, svg, centerX, centerY, scale = 1.0) {
    wrapper.style.position = 'relative';

    const old = wrapper.querySelector('.graph-controls-pod');
    if (old) old.remove();

    const pod = document.createElement('div');
    pod.className = 'graph-controls-pod';
    pod.style.cssText = `
        position: absolute;
        right: 16px;
        bottom: 16px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        user-select: none;
        padding: 10px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid #e0dfd9;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
    `;


    /**
     * Abifunktsioon nuppude loomiseks
     * @param html
     * @param title
     * @param onClick
     * @param gridArea
     * @returns {HTMLButtonElement}
     */
    function createBtn(html, title, onClick, gridArea = '') {
        const btn = document.createElement('button');
        btn.innerHTML = html;
        btn.title = title;
        btn.style.cssText = `
            width: 32px;
            height: 32px;
            border: 1px solid #e0dfd9;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #555;
            padding: 0;
            transition: all 0.15s ease;
            ${gridArea ? `grid-area: ${gridArea};` : ''}
        `;

        btn.onmouseenter = () => {
            btn.style.background = '#f8f9fa';
            btn.style.borderColor = '#00674A';
            btn.style.color = '#00674A';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'white';
            btn.style.borderColor = '#e0dfd9';
            btn.style.color = '#555';
        };

        btn.onmousedown = () => btn.style.transform = "scale(0.92)";
        btn.onmouseup   = () => btn.style.transform = "scale(1)";
        btn.onclick = onClick;
        return btn;
    }


    // Liikumise nuppude loomise loogika
    const dPad = document.createElement('div');
    dPad.style.cssText = `display: grid; grid-template-columns: repeat(3, 32px); grid-template-rows: repeat(3, 32px); gap: 4px;`;

    const iconColor = "currentColor";
    const arrowUp    = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>`;
    const arrowDown  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>`;
    const arrowLeft  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>`;
    const arrowRight = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>`;
    const centerIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><circle cx="12" cy="12" r="3" fill="${iconColor}"/><circle cx="12" cy="12" r="9"/></svg>`;

    const PAN = 180; // px arv, mis liigutakse pärast nupuvajutust
    const DUR = 250; // kestvus

    dPad.appendChild(createBtn(arrowUp, 'Üles', () => svg.transition().duration(DUR).call(zoom.translateBy, 0, PAN), '1/2'));
    dPad.appendChild(createBtn(arrowLeft, 'Vasakule', () => svg.transition().duration(DUR).call(zoom.translateBy, PAN, 0), '2/1'));

    // tsentreerimise nupp
    dPad.appendChild(createBtn(centerIcon, 'Tsentreeri', () => {
        const W = wrapper.clientWidth;
        const H = wrapper.clientHeight;
        svg.transition().duration(DUR * 1.5).call(
            zoom.transform,
            d3.zoomIdentity.translate(W/2, H/2).scale(scale).translate(-centerX, -centerY)
        );
    }, '2/2'));

    dPad.appendChild(createBtn(arrowRight, 'Paremale', () => svg.transition().duration(DUR).call(zoom.translateBy, -PAN, 0), '2/3'));
    dPad.appendChild(createBtn(arrowDown, 'Alla', () => svg.transition().duration(DUR).call(zoom.translateBy, 0, -PAN), '3/2'));

    const hr = document.createElement('div');
    hr.style.cssText = 'width: 100%; height: 1px; background: #e0dfd9; margin: 2px 0;';

    // zoomimise nupud
    const zoomGroup = document.createElement('div');
    zoomGroup.style.cssText = 'display: flex; gap: 6px;';
    const plusIcon  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg>`;
    const minusIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14"/></svg>`;

    zoomGroup.appendChild(createBtn(plusIcon, 'Suurenda', () => svg.transition().duration(DUR).call(zoom.scaleBy, 1.4)));
    zoomGroup.appendChild(createBtn(minusIcon, 'Vähenda', () => svg.transition().duration(DUR).call(zoom.scaleBy, 0.7)));

    pod.appendChild(dPad);
    pod.appendChild(hr);
    pod.appendChild(zoomGroup);
    wrapper.appendChild(pod);
}
