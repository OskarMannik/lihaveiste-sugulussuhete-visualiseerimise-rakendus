/**
 * Aretajavaate API päringu jaoks URLi koostamine vastavalt kasutaja valitud filtritele
 */
function loadBreederGraph() {

    setGraphLoading(true);

    const herdId = document.getElementById("herdId")?.value;
    const status = document.querySelector('select[name="status"]')?.value;
    const breed  = document.querySelector('select[name="breed"]')?.value;
    const year   = document.querySelector('select[name="year"]')?.value;

    const generations = Array.from(document.querySelectorAll('input[name="generations[]"]:checked'))
        .map(cb => cb.value);

    const params = new URLSearchParams({
        action:  "getBreederGraph",
        herd_id: herdId
    });

    if (status && status !== 'NULL') params.append('status', status);
    if (breed  && breed  !== 'NULL') params.append('breed',  breed);
    if (year)                        params.append('year',   year);

    generations.forEach(g => params.append('generations[]', g));

    const url = window.GRAPH.moduleUrl + "&" + params.toString();

    fetch(url)
        .then(r => r.json())
        .then(json => {
            setGraphLoading(false);

            window.currentTreeData = json.data;
            drawBreederGraph(json.data, herdId);
            initAnimalHighlight();
        })
        .catch(err => {
            setGraphLoading(false);
            console.error("Viga aretaja graafi kuvamisega:", err)
            d3.select('#graph').html(''); //veateadete kuvamine
            d3.select('#graph').append('div')
                .style('height', '100%')
                .style('display', 'flex')
                .style('align-items', 'center')
                .style('justify-content', 'center')
                .style('color', '#c0392b')
                .style('font-size', '15px')
                .text('Graafiku laadimine ebaõnnestus. Palun proovi uuesti.');
        });
}


/**
 * Aretajagraafiku kuvamine d3.js abil massiivist saadud andmete põhjal
 * @param data
 */
function drawBreederGraph(data, herdId) {
    const wrapper = document.querySelector(".graph-wrapper");
    const W = wrapper.clientWidth;
    const H = wrapper.clientHeight;

    d3.select("#graph").html("");

    const svg = d3.select("#graph")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${W} ${H}`);

    svg.style('font-family', 'Merriweather Sans, sans-serif');

    svg.append("defs").append("marker")
        .attr("id", "arrowhead-out")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 6).attr("refY", 5)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L10,5 L0,10 Z")
        .attr("fill", "#00674A");

    svg.append("defs").append("marker")
        .attr("id", "arrowhead-in")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 6).attr("refY", 5)
        .attr("markerWidth", 6).attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L10,5 L0,10 Z")
        .attr("fill", "#8FD857");

    const container = svg.append("g");

    const zoom = d3.zoom()
        .scaleExtent([0.3, 3])
        .on("zoom", e => container.attr("transform", e.transform));

    svg.call(zoom);

    renderZoomButtons(wrapper, zoom, svg, W/2, H/2, 1.0);

    // tippude ehk karjade loomine

    const centralId = String(data.find(d => d.DIRECTION === 'center')?.SOURCE_HERD_ID);

    const herdMap = {};
    data.forEach(d => {
        if (d.DIRECTION === 'center') return;
        const srcId = String(d.SOURCE_HERD_ID);
        const tgtId = String(d.TARGET_HERD_ID);

        if (!herdMap[srcId]) {
            herdMap[srcId] = {
                id: srcId,
                name: d.SOURCE_HERD_NAME,
                isCentral: srcId === centralId,
                endOfAr: null
            };
        }
        if (!herdMap[tgtId]) {
            herdMap[tgtId] = {
                id: tgtId,
                name: d.TARGET_HERD_NAME,
                isCentral: tgtId === centralId,
                endOfAr: null
            };
        }

        if (d.DIRECTION === 'incoming' && d.END_OF_AR) {
            herdMap[srcId].endOfAr = d.END_OF_AR;
        } else if (d.DIRECTION === 'outgoing' && d.END_OF_AR) {
            herdMap[tgtId].endOfAr = d.END_OF_AR;
        }
    });


    // keskmise karja loomine

    if (!herdMap[centralId]) {
        const centerRow = data.find(d => d.DIRECTION === 'center');
        herdMap[centralId] = {
            id:        centralId,
            name:      centerRow.SOURCE_HERD_NAME,
            isCentral: true,
            endOfAr:   centerRow.END_OF_AR || null
        };
    }

    //otseste naabrite loomine

    const directNeighborIds = new Set(
        data
            .filter(d => d.DIRECTION !== 'center')
            .filter(d => String(d.SOURCE_HERD_ID) === centralId || String(d.TARGET_HERD_ID) === centralId)
            .flatMap(d => [String(d.SOURCE_HERD_ID), String(d.TARGET_HERD_ID)])
    );
    directNeighborIds.delete(centralId);

    Object.values(herdMap).forEach(n => {
        n.isDirect = directNeighborIds.has(n.id);
    });

    const nodes = Object.values(herdMap);
    const centralNode = nodes.find(n => n.isCentral);
    if (centralNode) {
        centralNode.fx = W / 2;
        centralNode.fy = H / 2;
    }

    // servade ehk noolte loomine

    const rawPairs = {};
    const linksRaw = data.filter(d => d.DIRECTION !== 'center');

    linksRaw.forEach(d => {
        const key = [String(d.SOURCE_HERD_ID), String(d.TARGET_HERD_ID)].sort().join('|');
        rawPairs[key] = (rawPairs[key] || 0) + 1;
    });

    const links = linksRaw.map(d => {
        const a = String(d.SOURCE_HERD_ID);
        const b = String(d.TARGET_HERD_ID);
        const key = [a, b].sort().join('|');
        const isBi = rawPairs[key] > 1;

        return {
            source:    a,
            target:    b,
            count:     parseInt(d.ANIMAL_COUNT) || 0,
            direction: d.DIRECTION,
            sideOffset: isBi ? 1 : 0
        };
    });

    const nodeCount = nodes.length;
    const chargeMult = Math.min(1 + (nodeCount / 60), 1.8);

    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance(d => {
                const srcId = String(d.source.id || d.source);
                const tgtId = String(d.target.id || d.target);
                return (srcId === centralId || tgtId === centralId) ? 350 : 800;
            })
            .strength(d => {
                const srcId = String(d.source.id || d.source);
                const tgtId = String(d.target.id || d.target);
                return (srcId === centralId || tgtId === centralId) ? 0.3 : 0.01;
            })
        )
        .force("charge", d3.forceManyBody()
            .strength(-1500 * chargeMult)
            .distanceMax(600 * chargeMult))
        .force("radial", d3.forceRadial(
            d => d.isCentral ? 0 : d.isDirect ? 350 : 800,
            W / 2, H / 2
        ).strength(d => d.isCentral ? 0 : 3.5))
        .force("collision", d3.forceCollide(Math.min(130 + nodeCount, 180)).strength(1))
        .alphaDecay(0.08)
        .velocityDecay(0.7);

    // servade ja sõlmede graafikule kuvamine

    const link = container.append("g")
        .selectAll("path")
        .data(links)
        .enter()
        .append("path")
        .attr("fill", "none")
        .attr("stroke", d => d.direction === "incoming" ? "#8FD857" : "#00674A")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.6)
        .attr("marker-end", d => d.direction === "incoming" ? "url(#arrowhead-in)" : "url(#arrowhead-out)")

    let selectedNode = null;

    const node = container.append("g")
        .selectAll("g")
        .data(nodes)
        .enter()
        .append("g")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();

            if (selectedNode === d.id) {
                selectedNode = null;
                return;
            }

            selectedNode = d.id;

            if (!d.isCentral) {// keskmisel karjal klikkimine ei ava loomade nimekirja
                openHerdModal(d.id, d.name);
            }
        })
        .call(d3.drag()
            .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.005).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on("drag", (event, d) => {
                d.fx = event.x; d.fy = event.y;
            })
            .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                if (!d.isCentral) { d.fx = null; d.fy = null; }
            })
        )

    svg.on("click", () => {
        selectedNode = null;
    });


    // aretajakaardi loomine

    const NODE_SIZE = 48;
    const ICON_SCALE = NODE_SIZE / 32;
    const CARD_SIZE = 80;

    node.append("rect")
        .attr("class", "herd-card-bg")
        .attr("x", -CARD_SIZE / 2).attr("y", -CARD_SIZE / 2)
        .attr("width", CARD_SIZE).attr("height", CARD_SIZE)
        .attr("rx", 12)
        .attr("fill", d => d.endOfAr
            ? "rgba(180,178,169,0.2)"
            : d.isCentral ? "rgba(0,103,74,0.08)" : "rgba(80,179,68,0.08)")
        .attr("stroke", "none");

    const icon = node.append("g")
        .attr("transform", `translate(${-NODE_SIZE/2}, ${-NODE_SIZE/2}) scale(${ICON_SCALE})`)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("fill", "none")
        .attr("stroke-width", 1.088);

    const iconColor = d => d.endOfAr
        ? "#B4B2A9"
        : d.isCentral ? "#00674A" : "#50B344";

    icon.append("polygon").attr("points", "25,11 16,6 7,11 5,17 27,17").attr("stroke", iconColor);
    icon.append("polygon").attr("points", "28,9 16,2 4,9 1,17 31,17").attr("stroke", iconColor);
    icon.append("rect").attr("x", 5).attr("y", 17).attr("width", 22).attr("height", 13).attr("stroke", iconColor);
    icon.append("rect").attr("x", 11).attr("y", 20).attr("width", 10).attr("height", 10).attr("stroke", iconColor);
    icon.append("line").attr("x1", 11).attr("y1", 20).attr("x2", 21).attr("y2", 30).attr("stroke", iconColor);
    icon.append("line").attr("x1", 21).attr("y1", 20).attr("x2", 11).attr("y2", 30).attr("stroke", iconColor);
    icon.append("rect").attr("x", 13).attr("y", 12).attr("width", 6).attr("height", 5).attr("stroke", iconColor);

    node.append("text")
        .attr("text-anchor", "middle")
        .attr("y", CARD_SIZE / 2 + 16)
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("font-family", "Merriweather Sans, sans-serif")
        .attr("fill", d => d.endOfAr ? "#6b6b66" : "#1b3d2b")
        .text(d => d.name?.length > 18 ? d.name.substring(0, 17) + "…" : d.name);

    node.append("text")
        .attr("text-anchor", "middle")
        .attr("y", CARD_SIZE / 2 + 30)
        .style("font-size", "10px")
        .attr("fill", "#4a6357")
        .text(d => d.id);

    simulation.on("tick", () => {

        link.attr("d", d => {
            const sx0 = d.source.x, sy0 = d.source.y;
            const tx0 = d.target.x, ty0 = d.target.y;

            const dx   = tx0 - sx0;
            const dy   = ty0 - sy0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return "";

            const sourcePadding = CARD_SIZE / 2 + 2;
            const targetPadding = CARD_SIZE / 2 + 6;

            const offset = 8;
            const perpX = dy / dist;
            const perpY = -(dx / dist);

            const osx = sx0 + perpX * offset * d.sideOffset;
            const osy = sy0 + perpY * offset * d.sideOffset;
            const otx = tx0 + perpX * offset * d.sideOffset;
            const oty = ty0 + perpY * offset * d.sideOffset;

            /**
             * Leiab punkti, kus serv lõikub aretajakaardi servaga
             * @param cx
             * @param cy
             * @param tx
             * @param ty
             * @param padding
             * @returns {*[]}
             */
            function squareIntersect(cx, cy, tx, ty, padding) {
                const adx = Math.abs(tx - cx);
                const ady = Math.abs(ty - cy);
                const dd  = Math.sqrt((tx-cx)**2 + (ty-cy)**2);
                if (dd === 0) return [cx, cy];
                const nx  = (tx - cx) / dd;
                const ny  = (ty - cy) / dd;
                const scale = adx > ady ? padding / Math.abs(nx) : padding / Math.abs(ny);
                return [cx + nx * scale, cy + ny * scale];
            }

            const [sx, sy] = squareIntersect(osx, osy, otx, oty, sourcePadding);
            const [tx, ty] = squareIntersect(otx, oty, osx, osy, targetPadding);

            return `M${sx},${sy} L${tx},${ty}`;
        });

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });


    // pärast simulatsiooni (karjade oma kohale liikumist) tõstetakse karjad esile
    simulation.on("end", () => {
        if (window.highlightedHerdIds) {
            applyAnimalHighlight(window.highlightedHerdIds);
        }
    });

    // legendi kuvamine
    renderGraphLegend(svg, W, H, [
        { label: "sinu kari",            color: "#00674A", type: "node" },
        { label: "seotud kari",          color: "#50B344", type: "node" },
        { label: "JK lõpetanud kari",     color: "#B4B2A9", type: "node" },
        { label: "looma suguluse levik", color: "#FFA100", type: "highlight" },
        { label: "vanemate sünnikarjad", color: "#8FD857", type: "edge" },
        { label: "järglaste sünnikarjad",color: "#00674A", type: "edge" },
    ]);
}

/**
 * Loomade nimekirja API päringu jaoks URLi koostamine vastavalt kasutaja valitud karjale ja filtritele
 * @param herdId
 * @param herdName
 */
function openHerdModal(herdId, herdName) {
    const sourceHerdId = document.getElementById("herdId")?.value;
    const status       = document.querySelector('select[name="status"]')?.value;
    const breed        = document.querySelector('select[name="breed"]')?.value;
    const year         = document.querySelector('select[name="year"]')?.value;

    const params = new URLSearchParams({
        action:         "getHerdAnimals",
        herd_id:        herdId,
        source_herd_id: sourceHerdId
    });

    if (status && status !== 'NULL') params.append('status', status);
    if (breed  && breed  !== 'NULL') params.append('breed',  breed);
    if (year)                        params.append('year',   year);

    const url = window.GRAPH.moduleUrl + "&" + params.toString();

    renderHerdModal(herdId, herdName, null);

    fetch(url)
        .then(r => r.json())
        .then(json => {
            renderHerdModal(herdId, herdName, json.data);
        })
        .catch(err => {
            console.error("Loomade nimekirja error:", err);
            renderHerdModal(herdId, herdName, [], true);
        });
}


/**
 * Karja loomade nimekirja kuvamine
 * @param herdId
 * @param herdName
 * @param animals
 */
function renderHerdModal(herdId, herdName, animals, isError = false) {
    let modal = document.getElementById("herd-modal");

    if (!modal) { // modali loomine
        modal = document.createElement("div");
        modal.id = "herd-modal";
        modal.innerHTML = `
            <div id="herd-modal-backdrop"></div>
            <div id="herd-modal-box">
                <div id="herd-modal-header">
                    <div id="herd-modal-title-wrap">
                        <span id="herd-modal-title"></span>
                        <span id="herd-modal-subtitle"></span>
                        <span id="herd-modal-info">Siin kuvatakse vaadeldavas karjas sündinud loomad, kes on sinu karjas sündinud loomade järeltulijad või eellased.</span>
                    </div>
                    <button id="herd-modal-close" title="Sulge">✕</button>
                </div>
                <div id="herd-modal-body"></div>
            </div>`;

        const style = document.createElement("style");
        style.textContent = `
            #herd-modal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 1000;
            }
            #herd-modal-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.45);
                backdrop-filter: blur(2px);
            }
            #herd-modal-box {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 8px 40px rgba(0,0,0,0.18);
                width: min(820px, 92vw);
                max-height: 78vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            #herd-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 18px 22px 14px;
                border-bottom: 1px solid #eee;
                gap: 12px;
            }
            #herd-modal-title-wrap {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            #herd-modal-title {
                font-size: 16px;
                font-weight: 600;
                color: #1a1a1a;
            }
            #herd-modal-subtitle {
                font-size: 12px;
                color: #888;
            }
            #herd-modal-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #999;
                line-height: 1;
                padding: 4px 6px;
                border-radius: 6px;
                transition: background 0.15s, color 0.15s;
            }
            #herd-modal-close:hover {
                background: #f2f2f2;
                color: #333;
            }
            #herd-modal-body {
                overflow-y: auto;
                padding: 0 22px 20px;
            }
            #herd-modal-body table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
                margin-top: 14px;
            }
            #herd-modal-body th {
                text-align: left;
                padding: 8px 10px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #888;
                border-bottom: 1px solid #eee;
                position: sticky;
                top: 0;
                background: #fff;
            }
            #herd-modal-body td {
                padding: 9px 10px;
                border-bottom: 1px solid #f4f4f4;
                color: #222;
            }
            #herd-modal-body tr:last-child td {
                border-bottom: none;
            }
            #herd-modal-body tr:hover td {
                background: #f9f9f9;
            }
            .herd-modal-loading {
                text-align: center;
                padding: 40px 0;
                color: #aaa;
                font-size: 14px;
            }
            .herd-modal-empty {
                text-align: center;
                padding: 40px 0;
                color: #bbb;
                font-size: 14px;
            }
            
            #herd-modal-info {
                font-size: 11px;
                color: #aaa;
                font-style: italic;
                margin-top: 2px;
            }
          
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);

        document.getElementById("herd-modal-close").onclick    = closeHerdModal;
        document.getElementById("herd-modal-backdrop").onclick = closeHerdModal;

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") closeHerdModal();
        });
    }

    document.getElementById("herd-modal-title").textContent    = herdName || `Kari ${herdId}`;
    document.getElementById("herd-modal-subtitle").textContent = `${herdId}`;
    document.getElementById("herd-modal").style.display        = "block";

    const body = document.getElementById("herd-modal-body");

    if (isError) { // veateate kuvamine
        body.innerHTML = `<div class="herd-modal-empty" style="color: #c0392b;">Loomade laadimine ebaõnnestus. Palun proovi uuesti.</div>`;
        return;
    }


    if (animals === null) { // kui veel laeb
        body.innerHTML = `<div class="herd-modal-loading">Otsin loomi…</div>`;
        return;
    }

    if (!animals.length) { // kui ei leitud loomi
        body.innerHTML = `<div class="herd-modal-empty">Ühtegi sellist looma ei leitud selles karjas.</div>`;
        return;
    }

    let sortCol = null;
    let sortAsc = true;


    /**
     * Teisendab kpv sorteeritavale kujule
     * @param str
     * @returns {number}
     */
    function parseDate(str) {
        if (!str || str === '—') return 0;
        const parts = str.split('.');
        if (parts.length !== 3) return 0;
        const day   = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        let year    = parseInt(parts[2]);
        if (year < 100) year += 2000;
        return new Date(year, month, day).getTime();
    }

    /**
     * Funktsioon, mis tagastab väärtuse, mida võrrelda.
     * @param a
     * @param col
     * @returns {number|*|string|string|number}
     */
    function getSortValue(a, col) {
        switch(col) {
            case 'reg':    return a.REGISTERED_NUMBER ?? a.ID ?? '';
            case 'breed':  return a.BREED ?? '';
            case 'status': return STATUS_MAP[a.STATUS] ?? '';
            case 'born': return parseDate(a.BIRTHDAY);
            case 'died': return parseDate(a.DATE_OF_DEATH);
            default:       return '';
        }
    }

    /**
     * Sorteerimisnoolte ja loomade nimekirja akna kuvamine
     * @param data
     */
    function renderTable(data) {
        const sorted = [...animals].sort((a, b) => {
            if (!sortCol) return 0;
            const av = getSortValue(a, sortCol);
            const bv = getSortValue(b, sortCol);
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortAsc ? av - bv : bv - av;
            }
            return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });

        body.querySelector("tbody").innerHTML = sorted.map(a => `
        <tr>
            <td><a href="./?module=AnimalCard&id=${a.ID}" target="_blank">${a.REGISTERED_NUMBER ?? a.ID ?? "—"}</a></td>
            <td>${a.BREED ?? "—"}</td>
            <td>${STATUS_MAP[a.STATUS] ?? "—"}</td>
            <td>${a.BIRTHDAY ?? "—"}</td>
            <td>${a.DATE_OF_DEATH ?? "—"}</td>
        </tr>`).join("");

        body.querySelectorAll("th[data-col]").forEach(th => {
            const col = th.dataset.col;
            th.querySelector(".sort-arrow").textContent =
                col === sortCol ? (sortAsc ? " ↑" : " ↓") : " ↕";
        });
    }

    body.innerHTML = `
    <table>
        <thead>
            <tr>
                <th data-col="reg"    style="cursor:pointer">Reg. nr.<span class="sort-arrow"> ↕</span></th>
                <th data-col="breed"  style="cursor:pointer">Tõug<span class="sort-arrow"> ↕</span></th>
                <th data-col="status" style="cursor:pointer">Staatus<span class="sort-arrow"> ↕</span></th>
                <th data-col="born"   style="cursor:pointer">Sünd<span class="sort-arrow"> ↕</span></th>
                <th data-col="died"   style="cursor:pointer">Väljaminek<span class="sort-arrow"> ↕</span></th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>`;

    body.querySelectorAll("th[data-col]").forEach(th => {
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (sortCol === col) {
                sortAsc = !sortAsc;
            } else {
                sortCol = col;
                sortAsc = true;
            }
            renderTable(animals);
        });
    });

    renderTable(animals);
}


/**
 * Sulgeb loomade nimekirja.
 */
function closeHerdModal() {
    const modal = document.getElementById("herd-modal");
    if (modal) modal.style.display = "none";
}


/**
 * Looma esiletõstmise protsessi algus pärast looma otsimist
 */
function initAnimalHighlight() {
    injectHighlightStyles();

    const animalIdInput = document.getElementById("animalId");
    const animalInput   = document.getElementById("search_animal");

    if (!animalIdInput || !animalInput) return;

    const initialId = animalIdInput.value;
    if (initialId) {
        highlightAnimalHerds(initialId);
    }

    animalInput.addEventListener("input", () => {
        if (!animalInput.value.trim()) {
            clearAnimalHighlight();
        }
    });
}


/**
 * Teeb päringu backendi endpointi vastu, kust saab karjad, kus valitud loom ja tema sugulased sündinud on.
 * @param animalId
 */
function highlightAnimalHerds(animalId) {
    const params = new URLSearchParams({
        action:    "getAnimalConnectionHerds",
        animal_id: animalId
    });

    const url = window.GRAPH.moduleUrl + "&" + params.toString();

    fetch(url)
        .then(r => r.json())
        .then(json => {
            if (!json.ok) return;
            const herdIds = new Set(json.data.map(r => String(r.HERD_ID)));
            window.highlightedHerdIds = herdIds;
            applyAnimalHighlight(herdIds);
        })
        .catch(err => console.error("Looma highlightimise error:", err));
}


/**
 * Lisab karjade esiletõstmise CSS-i poole HTML-ile
 */
function injectHighlightStyles() {
    if (document.getElementById("highlight-styles")) return;
    const style = document.createElement("style");
    style.id = "highlight-styles";
    style.textContent = `
        @keyframes herd-pulse {
            0%   { opacity: 1; }
            50%  { opacity: 0.4; }
            100% { opacity: 1; }
        }
        .herd-node-highlight .herd-card-bg {
            animation: herd-pulse 1.6s ease-in-out infinite;
            stroke: #FFA100 !important;
            stroke-width: 3 !important;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Rakendab esiletõstmise kõigile karjadele, mille ID on saadud päringu vastuses.
 * @param herdIds
 */
function applyAnimalHighlight(herdIds) {
    window.highlightedHerdIds = herdIds;

    injectHighlightStyles();

    d3.selectAll("#graph svg g g")
        .each(function(d) {
            if (!d) return;
            const isMatch = herdIds.has(String(d.id));

            d3.select(this)
                .classed("herd-node-highlight", isMatch)

            d3.select(this).select(".herd-card-bg")
                .attr("stroke",       isMatch ? "#FFA100" : "none")
                .attr("stroke-width", isMatch ? 3 : 0)
                .attr("fill", isMatch
                    ? "rgba(255,161,0,0.2)"
                    : d.endOfAr
                        ? "rgba(180,178,169,0.2)"
                        : (d.isCentral ? "rgba(0,103,74,0.08)" : "rgba(80,179,68,0.08)")
                );
        });
}


/**
 * Eemaldab karjade esiletõstmise.
 */
function clearAnimalHighlight() {
    window.highlightedHerdIds = null;

    d3.selectAll("#graph svg g g")
        .each(function(d) {
            if (!d) return;
            d3.select(this)
                .classed("herd-node-highlight", false)

            d3.select(this).select(".herd-card-bg")
                .attr("stroke", "none")
                .attr("stroke-width", 0)
                .attr("fill", d.endOfAr
                    ? "rgba(180,178,169,0.2)"
                    : (d.isCentral ? "rgba(0,103,74,0.08)" : "rgba(80,179,68,0.08)"));
        });
}
