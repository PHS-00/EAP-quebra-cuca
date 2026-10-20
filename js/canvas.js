/**
 * Engine Unificada do Canvas Nativo (Pan, Pinch-Zoom, Árvore Híbrida e Conexões SVG)
 * Atende ao Dashboard (Edição), Tela de Comparação e Modal de Gabarito
 */

// Estado do Canvas Principal
let nivelZoom = 1.0;
let panX = 0, panY = 0;
let exibirCaixasNivel = false;

/**
 * Recupera os dados ativos da EAP respeitando os escopos do Dashboard e da Comparação
 */
function obterEAPAtiva() {
    if (typeof eapAtual !== 'undefined' && eapAtual) return eapAtual;
    if (typeof window.eapAtual !== 'undefined' && window.eapAtual) return window.eapAtual;
    return typeof EAPStorage !== 'undefined' ? EAPStorage.obterEAP() : null;
}

/**
 * Atualiza dinamicamente o texto indicador de porcentagem do zoom de qualquer canvas
 */
function atualizarIndicadorZoom(zoomVal, areaId = 'canvas-area', zoomTextId = null) {
    let el = zoomTextId ? document.getElementById(zoomTextId) : null;
    
    if (!el) {
        if (areaId === 'modal-gabarito-area') {
            el = document.getElementById('gab-zoom-percentage');
        } else {
            el = document.getElementById('zoom-percentage');
        }
    }

    if (!el && areaId) {
        const parent = document.getElementById(areaId)?.parentElement;
        if (parent) el = parent.querySelector('#zoom-percentage, #gab-zoom-percentage, .zoom-percentage');
    }

    if (el) {
        el.textContent = `${Math.round(zoomVal * 100)}%`;
    }
}

function inicializarCanvasNativo() {
    configurarInstanciaPanZoom('canvas-area', 'canvas-viewport', 
        () => ({ zoom: nivelZoom, panX, panY }),
        (pX, pY, z) => { panX = pX; panY = pY; nivelZoom = z; },
        desenharNiveisELinhas
    );
    configurarControlesZoom();
    configurarBotaoToggleNiveis();
    configurarOuvintesCollapse('canvas-nodes', () => desenharNiveisELinhas());
    renderizarArvoreCanvas();
}

/* ==========================================================================
   1. GERENCIADOR DE PAN E PINCH-ZOOM GENÉRICO
   ========================================================================== */

function configurarInstanciaPanZoom(areaId, viewportId, getState, setState, onUpdate) {
    const canvasArea = document.getElementById(areaId);
    if (!canvasArea || canvasArea.dataset.panIniciado) return;
    canvasArea.dataset.panIniciado = 'true';

    let isPanning = false, startX = 0, startY = 0;
    let isTouchPanning = false, touchStartX = 0, touchStartY = 0;
    let initialPinchDistance = 0, initialZoom = 1.0;

    // Mouse Pan
    canvasArea.addEventListener('mousedown', (e) => {
        if (e.target.closest('.eap-card-node, .gab-card-node, button, .offcanvas')) return;
        const st = getState();
        isPanning = true;
        startX = e.clientX - st.panX;
        startY = e.clientY - st.panY;
        canvasArea.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const st = getState();
        const nPanX = e.clientX - startX;
        const nPanY = e.clientY - startY;
        setState(nPanX, nPanY, st.zoom);
        aplicarTransformacaoViewport(viewportId, nPanX, nPanY, st.zoom);
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            canvasArea.style.cursor = 'default';
        }
    });

    // Zoom via Scroll
    canvasArea.addEventListener('wheel', (e) => {
        e.preventDefault();
        const st = getState();
        const nZoom = Math.min(Math.max(st.zoom + (e.deltaY < 0 ? 0.1 : -0.1), 0.3), 1.6);
        setState(st.panX, st.panY, nZoom);
        aplicarTransformacaoViewport(viewportId, st.panX, st.panY, nZoom);
        atualizarIndicadorZoom(nZoom, areaId);
        if (onUpdate) onUpdate();
    }, { passive: false });

    // Touch Mobile (Pan e Pinch-Zoom)
    canvasArea.addEventListener('touchstart', (e) => {
        if (e.target.closest('.eap-card-node, .gab-card-node, button, .offcanvas')) return;
        const st = getState();

        if (e.touches.length === 1) {
            isTouchPanning = true;
            touchStartX = e.touches[0].clientX - st.panX;
            touchStartY = e.touches[0].clientY - st.panY;
        } else if (e.touches.length === 2) {
            isTouchPanning = false;
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = st.zoom;
        }
    }, { passive: true });

    canvasArea.addEventListener('touchmove', (e) => {
        const st = getState();
        if (e.touches.length === 1 && isTouchPanning) {
            if (e.cancelable) e.preventDefault();
            const nPanX = e.touches[0].clientX - touchStartX;
            const nPanY = e.touches[0].clientY - touchStartY;
            setState(nPanX, nPanY, st.zoom);
            aplicarTransformacaoViewport(viewportId, nPanX, nPanY, st.zoom);
        } else if (e.touches.length === 2 && initialPinchDistance > 0) {
            if (e.cancelable) e.preventDefault();
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (currentDist > 0) {
                const nZoom = Math.min(Math.max(initialZoom * (currentDist / initialPinchDistance), 0.3), 1.6);
                setState(st.panX, st.panY, nZoom);
                aplicarTransformacaoViewport(viewportId, st.panX, st.panY, nZoom);
                atualizarIndicadorZoom(nZoom, areaId);
                if (onUpdate) onUpdate();
            }
        }
    }, { passive: false });

    const finalizarTouch = (e) => {
        if (e.touches.length < 2) initialPinchDistance = 0;
        if (e.touches.length === 0) isTouchPanning = false;
    };

    canvasArea.addEventListener('touchend', finalizarTouch);
    canvasArea.addEventListener('touchcancel', finalizarTouch);
}

function aplicarTransformacaoViewport(viewportId, panXVal, panYVal, zoomVal) {
    const vp = document.getElementById(viewportId);
    if (vp) vp.style.transform = `translate(${panXVal}px, ${panYVal}px) scale(${zoomVal})`;
}

/* ==========================================================================
   2. CENTRALIZAÇÃO E AJUSTE DO DIAGRAMA
   ========================================================================== */

function ajustarAoDiagrama(areaId = 'canvas-area', containerId = 'canvas-nodes', getState, setState, viewportId = 'canvas-viewport') {
    const area = document.getElementById(areaId);
    const container = document.getElementById(containerId);
    if (!area || !container) return;

    const elementos = container.querySelectorAll('.eap-card-node, .gab-card-node, .eap-drop-zone');
    if (elementos.length === 0) return;

    const st = getState ? getState() : { zoom: nivelZoom, panX, panY };
    const curZoom = st.zoom || 1.0;
    const rectCanvas = container.getBoundingClientRect();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    elementos.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;

        const left = (r.left - rectCanvas.left) / curZoom;
        const right = (r.right - rectCanvas.left) / curZoom;
        const top = (r.top - rectCanvas.top) / curZoom;
        const bottom = (r.bottom - rectCanvas.top) / curZoom;

        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
        if (top < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
    });

    if (minX === Infinity || minY === Infinity) return;

    const larguraDiag = maxX - minX;
    const alturaDiag = maxY - minY;
    const margin = 70;

    let novoZoom = Math.min((area.clientWidth - margin * 2) / larguraDiag, (area.clientHeight - margin * 2) / alturaDiag);
    novoZoom = Math.min(Math.max(novoZoom, 0.35), 1.1);

    const nPanX = (area.clientWidth / 2) - ((minX + larguraDiag / 2) * novoZoom);
    const nPanY = (area.clientHeight / 2) - ((minY + alturaDiag / 2) * novoZoom);

    if (setState) {
        setState(nPanX, nPanY, novoZoom);
    } else {
        panX = nPanX; panY = nPanY; nivelZoom = novoZoom;
    }

    aplicarTransformacaoViewport(viewportId, nPanX, nPanY, novoZoom);
    atualizarIndicadorZoom(novoZoom, areaId);
}

/* ==========================================================================
   3. RENDERIZAÇÃO DE ÁRVORE E CARDS
   ========================================================================== */

function renderizarArvoreCanvas(containerId = 'canvas-nodes', nosCustom = null, prefixo = 'node-', isGabarito = false) {
    const containerNodes = document.getElementById(containerId);
    const eap = obterEAPAtiva();
    const nosList = nosCustom || (eap ? eap.nos : null);

    if (!containerNodes || !nosList) return;

    containerNodes.innerHTML = '';

    // Garante a existência da camada de caixas de nível no Canvas principal
    if (containerId === 'canvas-nodes') {
        let levelBoxesContainer = document.getElementById('canvas-level-boxes');
        if (!levelBoxesContainer) {
            levelBoxesContainer = document.createElement('div');
            levelBoxesContainer.id = 'canvas-level-boxes';
            levelBoxesContainer.className = 'position-absolute top-0 start-0 w-100 h-100 pe-none';
            levelBoxesContainer.style.zIndex = '1';
            containerNodes.appendChild(levelBoxesContainer);
        } else {
            levelBoxesContainer.innerHTML = '';
        }
    }

    const noRaiz = nosList.find(n => (!n.paiId || n.paiId === null || n.paiId === '') && !n.isNovo);
    if (!noRaiz) return;

    if (!isGabarito && eap) {
        noRaiz.noCanvas = true;
        noRaiz.paiId = null;
    }

    const treeWrapper = document.createElement('div');
    treeWrapper.id = (containerId === 'canvas-nodes') ? 'canvas-tree-wrapper' : undefined;
    treeWrapper.className = 'd-flex flex-column align-items-center gap-5 py-5 px-4 w-100 justify-content-start position-relative';
    treeWrapper.appendChild(renderizarRamoArvore(noRaiz, 1, nosList, prefixo, isGabarito));
    containerNodes.appendChild(treeWrapper);

    requestAnimationFrame(() => {
        setTimeout(() => {
            if (isGabarito) {
                desenharLinhasConexaoSVG(nosList, containerId, 'gabarito-svg', 1.0, prefixo);
            } else {
                desenharNiveisELinhas();
            }
        }, 60);
    });
}

function renderizarRamoArvore(noPai, level, todosNos, prefixo, isGabarito) {
    const branchDiv = document.createElement('div');
    branchDiv.className = 'eap-node-branch d-flex flex-column align-items-center gap-5 position-relative';
    branchDiv.appendChild(criarHTMLCardNativo(noPai, level, prefixo, isGabarito));

    const filhos = isGabarito 
        ? todosNos.filter(n => String(n.paiId) === String(noPai.id))
        : todosNos.filter(n => n.noCanvas && String(n.paiId) === String(noPai.id));

    if (filhos.length > 0 || (!isGabarito && !window.isModoComparacao)) {
        const childrenRow = document.createElement('div');
        childrenRow.className = 'eap-children-row d-flex justify-content-center align-items-start gap-4 position-relative';

        filhos.forEach(filho => {
            childrenRow.appendChild(renderizarRamoArvore(filho, level + 1, todosNos, prefixo, isGabarito));
        });

        if (!isGabarito && !window.isModoComparacao) {
            childrenRow.appendChild(criarHTMLDropZoneExterna(noPai, level + 1));
        }

        branchDiv.appendChild(childrenRow);
    }

    return branchDiv;
}

function criarHTMLCardNativo(no, level, prefixo = 'node-', isGabarito = false) {
    const div = document.createElement('div');
    const isRaiz = (!no.paiId || no.paiId === null || no.paiId === '') && !no.isNovo;
    const idSanitizado = String(no.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const temDescricao = no.descricao && no.descricao.trim() !== '';

    const palavras = no.label ? no.label.trim().split(/\s+/) : [];
    const labelExibido = palavras.length > 5 ? palavras.slice(0, 5).join(' ') + '...' : (no.label || '');

    div.id = `${prefixo}${no.id}`;
    div.dataset.id = no.id;
    div.dataset.level = level;
    div.style.width = 'fit-content';
    div.style.minWidth = '180px';

    // 1. Modal Gabarito
    if (isGabarito) {
        div.className = isRaiz 
            ? 'card shadow bg-dark text-white border-warning eap-card gab-card-node p-2' 
            : 'card shadow-sm border border-secondary bg-white eap-card gab-card-node p-2';
        
        div.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    ${isRaiz ? '<span class="badge bg-warning text-dark fw-bold me-1 mb-1" style="font-size: 0.7rem;">RAIZ</span>' : ''}
                    <span class="fw-semibold ${isRaiz ? 'text-white' : 'text-dark'} fs-6 d-block lh-sm text-center text-nowrap flex-grow-1" title="${no.label}">
                        ${labelExibido}
                    </span>
                    ${temDescricao ? `
                        <button class="btn btn-sm ${isRaiz ? 'btn-outline-warning text-warning' : 'btn-outline-secondary text-secondary'} border-0 p-1 ms-1 flex-shrink-0" type="button" data-bs-toggle="collapse" data-bs-target="#desc-${prefixo}${idSanitizado}">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    ` : ''}
                </div>
                ${temDescricao ? `<div class="collapse mt-2 pt-2 border-top small ${isRaiz ? 'text-white-50 border-secondary' : 'text-secondary'} text-break" id="desc-${prefixo}${idSanitizado}">${no.descricao}</div>` : ''}
            </div>
        `;
        return div;
    }

    // 2. Modo Comparação
    if (window.isModoComparacao) {
        let classeStatus = 'eap-card-correct';
        let badgeStatus = '<span class="badge bg-success me-1"><i class="bi bi-check-lg"></i></span>';

        if (no.statusComparacao === 'wrong-parent') {
            classeStatus = 'eap-card-wrong-parent';
            badgeStatus = '<span class="badge bg-warning text-white me-1"><i class="bi bi-exclamation-triangle"></i></span>';
        } else if (no.statusComparacao === 'extra') {
            classeStatus = 'eap-card-extra';
            badgeStatus = '<span class="badge bg-info text-white me-1"><i class="bi bi-plus-lg"></i></span>';
        } else if (no.statusComparacao === 'missing') {
            classeStatus = 'eap-card-missing';
            badgeStatus = '<span class="badge bg-danger me-1"><i class="bi bi-x-lg"></i></span>';
        }

        div.className = `card shadow-sm eap-card eap-card-node p-2 ${classeStatus}`;
        div.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    ${badgeStatus}
                    <span class="fw-semibold text-dark fs-6 text-center text-nowrap" title="${no.label}">${labelExibido}</span>
                    ${temDescricao ? `
                        <button class="btn btn-sm btn-link text-secondary p-0 ms-1" type="button" data-bs-toggle="collapse" data-bs-target="#desc-${prefixo}${idSanitizado}">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    ` : ''}
                </div>
                ${temDescricao ? `<div class="collapse mt-2 pt-2 border-top small text-secondary" id="desc-${prefixo}${idSanitizado}">${no.descricao}</div>` : ''}
            </div>
        `;
        return div;
    }

    // 3. Modo Edição (Dashboard)
    div.className = isRaiz
        ? 'card shadow bg-dark text-white border-warning eap-card eap-card-node p-2'
        : 'card shadow-sm border border-primary-subtle bg-white eap-card eap-card-node p-2';

    div.innerHTML = `
        <div class="card-body p-2">
            <div class="d-flex align-items-center justify-content-between gap-2">
                ${isRaiz ? '<span class="badge bg-warning text-dark fw-bold me-1 mb-1" style="font-size: 0.7rem;">RAIZ</span>' : (no.isNovo ? '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle me-1 mb-1" style="font-size: 0.7rem;">Novo</span>' : '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning me-1 mb-1" style="font-size: 0.7rem;">Normal</span>')}
                <span class="fw-semibold ${isRaiz ? 'text-white' : 'text-dark'} fs-6 d-block lh-sm text-center text-nowrap" title="${no.label}">${labelExibido}</span>
                ${!isRaiz ? `<button class="btn btn-lg btn-outline-danger border-0 p-2 ms-1" title="Devolver" onclick="devolverNoParaSidebar('${no.id}')"><i class="bi bi-x-circle"></i></button>` : ''}
                ${temDescricao ? `
                    <button class="btn btn-lg ${isRaiz ? 'btn-outline-warning text-warning' : 'btn-outline-light text-secondary'} border-0 p-2 ms-1" type="button" data-bs-toggle="collapse" data-bs-target="#desc-${prefixo}${idSanitizado}">
                        <i class="bi bi-chevron-down"></i>
                    </button>
                ` : ''}
            </div>
            ${temDescricao ? `<div class="collapse mt-2 pt-2 border-top small ${isRaiz ? 'text-white-50 border-secondary' : 'text-secondary'}" id="desc-${prefixo}${idSanitizado}">${no.descricao}</div>` : ''}
        </div>
    `;

    return div;
}

function criarHTMLDropZoneExterna(noPai, level) {
    const div = document.createElement('div');
    div.id = `dropzone-pai-${noPai.id}`;
    div.dataset.paiId = noPai.id;
    div.dataset.level = level;
    div.className = 'eap-drop-zone rounded-3 p-2 text-center text-dark d-flex flex-column align-items-center justify-content-center';
    div.innerHTML = `
        <i class="bi bi-plus-circle-dotted fs-5 text-secondary mb-1"></i>
        <span class="fw-semibold text-dark lh-sm" style="font-size: 0.78rem;">Adicionar no <strong>Nível ${level}</strong></span>
        <small class="text-muted text-truncate w-100 px-1" style="font-size: 0.7rem;" title="Pai: ${noPai.label}">Pai: <strong>${noPai.label}</strong></small>
    `;
    return div;
}

/* ==========================================================================
   4. DESENHO DAS CONEXÕES SVG E CAIXAS DE NÍVEL
   ========================================================================== */

function desenharNiveisELinhas() {
    atualizarIndicadorZoom(nivelZoom, 'canvas-area');
    desenharCaixasDeNivel();
    const eap = obterEAPAtiva();
    if (eap && eap.nos) desenharLinhasConexaoSVG(eap.nos, 'canvas-nodes', 'canvas-svg', nivelZoom, 'node-');
}

function desenharLinhasConexaoSVG(nos, containerId = 'canvas-nodes', svgId = 'canvas-svg', zoom = 1.0, prefixo = 'node-') {
    const svgEl = document.getElementById(svgId);
    const containerNodes = document.getElementById(containerId);
    if (!svgEl || !containerNodes || !nos) return;

    svgEl.innerHTML = '';
    const rectCanvas = containerNodes.getBoundingClientRect();

    nos.forEach(noPai => {
        const elPai = document.getElementById(`${prefixo}${noPai.id}`);
        if (!elPai) return;

        const isGab = (containerId === 'gabarito-nodes');
        const filhos = isGab 
            ? nos.filter(n => String(n.paiId) === String(noPai.id))
            : nos.filter(n => n.noCanvas && String(n.paiId) === String(noPai.id));
        
        const dropZone = !isGab ? document.getElementById(`dropzone-pai-${noPai.id}`) : null;

        if (filhos.length === 0 && !dropZone) return;

        const rectPai = elPai.getBoundingClientRect();
        if (rectPai.width === 0) return;

        const xPai = (rectPai.left + rectPai.width / 2 - rectCanvas.left) / zoom;
        const yPaiBottom = (rectPai.bottom - rectCanvas.top) / zoom;

        const targets = [];
        filhos.forEach(f => {
            const elF = document.getElementById(`${prefixo}${f.id}`);
            if (elF) {
                const rF = elF.getBoundingClientRect();
                if (rF.width > 0) {
                    targets.push({ xCenter: (rF.left + rF.width / 2 - rectCanvas.left) / zoom, yTop: (rF.top - rectCanvas.top) / zoom, isDrop: false });
                }
            }
        });

        if (dropZone) {
            const rDZ = dropZone.getBoundingClientRect();
            if (rDZ.width > 0) {
                targets.push({ xCenter: (rDZ.left + rDZ.width / 2 - rectCanvas.left) / zoom, yTop: (rDZ.top - rectCanvas.top) / zoom, isDrop: true });
            }
        }

        if (targets.length === 0) return;

        const minYTop = Math.min(...targets.map(t => t.yTop));
        const yMid = yPaiBottom + (minYTop - yPaiBottom) / 2;

        criarLinhaSVG(svgEl, `M ${xPai.toFixed(1)} ${yPaiBottom.toFixed(1)} L ${xPai.toFixed(1)} ${yMid.toFixed(1)}`, false);

        const busMinX = Math.min(xPai, ...targets.map(t => t.xCenter));
        const busMaxX = Math.max(xPai, ...targets.map(t => t.xCenter));
        criarLinhaSVG(svgEl, `M ${busMinX.toFixed(1)} ${yMid.toFixed(1)} L ${busMaxX.toFixed(1)} ${yMid.toFixed(1)}`, false);

        targets.forEach(t => {
            criarLinhaSVG(svgEl, `M ${t.xCenter.toFixed(1)} ${yMid.toFixed(1)} L ${t.xCenter.toFixed(1)} ${t.yTop.toFixed(1)}`, t.isDrop);
        });
    });
}

function criarLinhaSVG(svgEl, pathD, isTracejada = false) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', '#212529');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    if (isTracejada) path.setAttribute('class', 'eap-connection-line-dashed');
    svgEl.appendChild(path);
}

/**
 * Desenha dinamicamente as molduras de nível para qualquer canvas (Principal ou Modal)
 */
function desenharCaixasDeNivel(levelContainerId = 'canvas-level-boxes', containerId = 'canvas-nodes', zoom = nivelZoom, exibirFlag = exibirCaixasNivel) {
    const levelContainer = document.getElementById(levelContainerId);
    const containerNodes = document.getElementById(containerId);
    if (!levelContainer || !containerNodes) return;

    levelContainer.innerHTML = '';
    if (!exibirFlag) {
        levelContainer.style.display = 'none';
        return;
    }
    levelContainer.style.display = 'block';

    const rectCanvas = containerNodes.getBoundingClientRect();
    const elementsWithLevel = containerNodes.querySelectorAll('[data-level]');
    const levelGroups = new Map();

    elementsWithLevel.forEach(el => {
        const lvl = parseInt(el.dataset.level);
        if (!isNaN(lvl)) {
            if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
            levelGroups.get(lvl).push(el);
        }
    });

    levelGroups.forEach((elements, lvl) => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        elements.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;

            const left = (r.left - rectCanvas.left) / zoom;
            const right = (r.right - rectCanvas.left) / zoom;
            const top = (r.top - rectCanvas.top) / zoom;
            const bottom = (r.bottom - rectCanvas.top) / zoom;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;
        });

        if (minX === Infinity || minY === Infinity) return;

        const padX = 30, padY = 18;
        const levelBox = document.createElement('div');
        levelBox.className = `eap-level-box eap-level-box-${Math.min(lvl, 10)}`;
        levelBox.style.left = `${(minX - padX).toFixed(1)}px`;
        levelBox.style.top = `${(minY - padY).toFixed(1)}px`;
        levelBox.style.width = `${((maxX - minX) + padX * 2).toFixed(1)}px`;
        levelBox.style.height = `${((maxY - minY) + padY * 2).toFixed(1)}px`;

        const tag = document.createElement('span');
        tag.className = 'eap-level-tag text-dark';
        tag.textContent = `Nível ${lvl}`;
        levelBox.appendChild(tag);
        levelContainer.appendChild(levelBox);
    });
}

function configurarControlesZoom() {
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        nivelZoom = Math.min(nivelZoom + 0.1, 1.6);
        aplicarTransformacaoViewport('canvas-viewport', panX, panY, nivelZoom);
        desenharNiveisELinhas();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        nivelZoom = Math.max(nivelZoom - 0.1, 0.3);
        aplicarTransformacaoViewport('canvas-viewport', panX, panY, nivelZoom);
        desenharNiveisELinhas();
    });
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
        ajustarAoDiagrama('canvas-area', 'canvas-nodes', () => ({ zoom: nivelZoom, panX, panY }), (pX, pY, z) => { panX = pX; panY = pY; nivelZoom = z; });
    });
}

function configurarBotaoToggleNiveis() {
    const btnToggle = document.getElementById('btn-toggle-niveis');
    if (!btnToggle || btnToggle.dataset.iniciado) return;
    btnToggle.dataset.iniciado = 'true';

    btnToggle.addEventListener('click', () => {
        exibirCaixasNivel = !exibirCaixasNivel;
        const icone = btnToggle.querySelector('i');
        const btnText = btnToggle.querySelector('.btn-text');

        if (exibirCaixasNivel) {
            btnToggle.classList.add('active');
            if (icone) icone.className = 'bi bi-layers-fill fs-5';
            if (btnText) btnText.textContent = 'Ocultar Níveis';
            btnToggle.title = 'Ocultar Molduras de Nível';
        } else {
            btnToggle.classList.remove('active');
            if (icone) icone.className = 'bi bi-layers fs-5';
            if (btnText) btnText.textContent = 'Exibir Níveis';
            btnToggle.title = 'Exibir Molduras de Nível';
        }
        desenharCaixasDeNivel();
    });
}

function configurarOuvintesCollapse(containerId, redrawCallback) {
    const containerNodes = document.getElementById(containerId);
    if (!containerNodes || containerNodes.dataset.collapseIniciado) return;
    containerNodes.dataset.collapseIniciado = 'true';

    let intervalRedraw = null;
    const iniciarAcompanhamento = () => {
        if (intervalRedraw) clearInterval(intervalRedraw);
        intervalRedraw = setInterval(redrawCallback, 16);
        setTimeout(() => {
            if (intervalRedraw) clearInterval(intervalRedraw);
            redrawCallback();
        }, 360);
    };

    containerNodes.addEventListener('show.bs.collapse', iniciarAcompanhamento);
    containerNodes.addEventListener('hide.bs.collapse', iniciarAcompanhamento);
    containerNodes.addEventListener('shown.bs.collapse', redrawCallback);
    containerNodes.addEventListener('hidden.bs.collapse', redrawCallback);
}

function devolverNoParaSidebar(noId) {
    const eap = obterEAPAtiva();
    if (!eap) return;

    const no = eap.nos.find(n => String(n.id) === String(noId));
    if (!no) return;

    const removerFilhosRecursivo = (idPai) => {
        const filhos = eap.nos.filter(n => String(n.paiId) === String(idPai));
        filhos.forEach(f => {
            removerFilhosRecursivo(f.id);
            f.paiId = null;
            f.noCanvas = false;
        });
    };

    removerFilhosRecursivo(no.id);
    no.noCanvas = false;
    no.paiId = null;

    if (typeof salvarEstadoSilencioso === 'function') salvarEstadoSilencioso();
    if (typeof renderizarPecasSidebar === 'function') renderizarPecasSidebar();
    renderizarArvoreCanvas();
}

window.addEventListener('resize', desenharNiveisELinhas);

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(inicializarCanvasNativo, 100);
});