/**
 * Gerenciamento do Canvas Nativo: Pan, Zoom, Árvore Híbrida Alinhada ao Pai e Conexões SVG
 */

let nivelZoom = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0, startY = 0;

let isTouchPanning = false;
let touchStartX = 0, touchStartY = 0;
let initialPinchDistance = 0;
let initialZoom = 1.0;

// Estado de exibição das caixas pontilhadas de nível
let exibirCaixasNivel = false;

/**
 * Utilitário central para recuperar os dados ativos da EAP
 */
function obterEAPAtiva() {
    return (typeof eapAtual !== 'undefined' && eapAtual) ? eapAtual : EAPStorage.obterEAP();
}

function inicializarCanvasNativo() {
    configurarPanEZoom();
    configurarControlesZoom();
    configurarBotaoToggleNiveis();
    configurarOuvintesCollapse();
    renderizarArvoreCanvas();
}

function configurarPanEZoom() {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea || canvasArea.dataset.canvasIniciado) return;
    canvasArea.dataset.canvasIniciado = 'true';

    canvasArea.addEventListener('mousedown', (e) => {
        if (e.target.closest('.eap-card-node, button, .offcanvas')) return;
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        canvasArea.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        aplicarTransformacaoViewport();
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            canvasArea.style.cursor = 'default';
        }
    });

    canvasArea.addEventListener('wheel', (e) => {
        e.preventDefault();
        atualizarZoom(nivelZoom + (e.deltaY < 0 ? 0.1 : -0.1));
    }, { passive: false });

    canvasArea.addEventListener('touchstart', (e) => {
        if (e.target.closest('.eap-card-node, button, .offcanvas')) return;

        if (e.touches.length === 1) {
            isTouchPanning = true;
            touchStartX = e.touches[0].clientX - panX;
            touchStartY = e.touches[0].clientY - panY;
        } else if (e.touches.length === 2) {
            isTouchPanning = false;
            initialPinchDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoom = nivelZoom;
        }
    }, { passive: true });

    canvasArea.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isTouchPanning) {
            if (e.cancelable) e.preventDefault();
            panX = e.touches[0].clientX - touchStartX;
            panY = e.touches[0].clientY - touchStartY;
            aplicarTransformacaoViewport();
        } else if (e.touches.length === 2 && initialPinchDistance > 0) {
            if (e.cancelable) e.preventDefault();
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (currentDist > 0) {
                atualizarZoom(initialZoom * (currentDist / initialPinchDistance));
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

function ajustarAoDiagrama() {
    const canvasArea = document.getElementById('canvas-area');
    const containerNodes = document.getElementById('canvas-nodes');
    if (!canvasArea || !containerNodes) return;

    const elementos = containerNodes.querySelectorAll('.eap-card-node, .eap-drop-zone');
    if (elementos.length === 0) {
        panX = 0; panY = 0;
        atualizarZoom(1.0);
        return;
    }

    const rectCanvas = containerNodes.getBoundingClientRect();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    elementos.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;

        const left = (r.left - rectCanvas.left) / nivelZoom;
        const right = (r.right - rectCanvas.left) / nivelZoom;
        const top = (r.top - rectCanvas.top) / nivelZoom;
        const bottom = (r.bottom - rectCanvas.top) / nivelZoom;

        if (left < minX) minX = left;
        if (right > maxX) maxX = right;
        if (top < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
    });

    if (minX === Infinity || minY === Infinity) {
        panX = 0; panY = 0;
        atualizarZoom(1.0);
        return;
    }

    const larguraDiag = maxX - minX;
    const alturaDiag = maxY - minY;
    const margin = 70;

    let novoZoom = Math.min((canvasArea.clientWidth - margin * 2) / larguraDiag, (canvasArea.clientHeight - margin * 2) / alturaDiag);
    novoZoom = Math.min(Math.max(novoZoom, 0.35), 1.1);

    panX = (canvasArea.clientWidth / 2) - ((minX + larguraDiag / 2) * novoZoom);
    panY = (canvasArea.clientHeight / 2) - ((minY + alturaDiag / 2) * novoZoom);

    atualizarZoom(novoZoom);
}

function configurarOuvintesCollapse() {
    const containerNodes = document.getElementById('canvas-nodes');
    if (!containerNodes || containerNodes.dataset.collapseIniciado) return;
    containerNodes.dataset.collapseIniciado = 'true';

    let intervalRedraw = null;
    const iniciarAcompanhamento = () => {
        if (intervalRedraw) clearInterval(intervalRedraw);
        intervalRedraw = setInterval(desenharNiveisELinhas, 16);
        setTimeout(() => {
            if (intervalRedraw) clearInterval(intervalRedraw);
            desenharNiveisELinhas();
        }, 360);
    };

    containerNodes.addEventListener('show.bs.collapse', iniciarAcompanhamento);
    containerNodes.addEventListener('hide.bs.collapse', iniciarAcompanhamento);
    containerNodes.addEventListener('shown.bs.collapse', desenharNiveisELinhas);
    containerNodes.addEventListener('hidden.bs.collapse', desenharNiveisELinhas);
}

function aplicarTransformacaoViewport() {
    const viewport = document.getElementById('canvas-viewport');
    if (viewport) {
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${nivelZoom})`;
    }
}

function atualizarZoom(novoZoom) {
    nivelZoom = Math.min(Math.max(novoZoom, 0.3), 1.6);
    aplicarTransformacaoViewport();

    const zoomText = document.getElementById('zoom-percentage');
    if (zoomText) zoomText.textContent = `${Math.round(nivelZoom * 100)}%`;

    desenharNiveisELinhas();
}

function configurarControlesZoom() {
    const btnIn = document.getElementById('btn-zoom-in');
    const btnOut = document.getElementById('btn-zoom-out');
    const btnReset = document.getElementById('btn-zoom-reset');

    if (btnIn && !btnIn.dataset.iniciado) {
        btnIn.dataset.iniciado = 'true';
        btnIn.addEventListener('click', () => atualizarZoom(nivelZoom + 0.1));
    }
    if (btnOut && !btnOut.dataset.iniciado) {
        btnOut.dataset.iniciado = 'true';
        btnOut.addEventListener('click', () => atualizarZoom(nivelZoom - 0.1));
    }
    if (btnReset && !btnReset.dataset.iniciado) {
        btnReset.dataset.iniciado = 'true';
        btnReset.addEventListener('click', () => ajustarAoDiagrama());
    }
}

/**
 * Configura o botão flutuante que mostra/oculta os quadros de nível
 */
function configurarBotaoToggleNiveis() {
    let btnToggle = document.getElementById('btn-toggle-niveis');

    if (btnToggle && !btnToggle.dataset.iniciado) {
        btnToggle.dataset.iniciado = 'true';
        btnToggle.addEventListener('click', () => {
            exibirCaixasNivel = !exibirCaixasNivel;
            
            const icone = btnToggle.querySelector('i');
            const btnText = btnToggle.querySelector('.btn-text');

            if (exibirCaixasNivel) {
                btnToggle.classList.add('active');
                if (icone) icone.className = 'bi bi-layers-fill fs-5';
                btnToggle.title = 'Ocultar Molduras de Nível';
            } else {
                btnToggle.classList.remove('active');
                if (icone) icone.className = 'bi bi-layers fs-5';
                btnToggle.title = 'Exibir Molduras de Nível';
            }

            desenharCaixasDeNivel();
        });
    }
}

function renderizarArvoreCanvas() {
    const containerNodes = document.getElementById('canvas-nodes');
    const eap = obterEAPAtiva();
    if (!containerNodes || !eap || !eap.nos) return;

    containerNodes.innerHTML = '';

    const noRaiz = eap.nos.find(n => (!n.paiId || n.paiId === null || n.paiId === '') && !n.isNovo);
    if (!noRaiz) return;

    noRaiz.noCanvas = true;
    noRaiz.paiId = null;

    const levelBoxesContainer = document.createElement('div');
    levelBoxesContainer.id = 'canvas-level-boxes';
    containerNodes.appendChild(levelBoxesContainer);

    const treeWrapper = document.createElement('div');
    treeWrapper.id = 'canvas-tree-wrapper';
    treeWrapper.className = 'd-flex flex-column align-items-center gap-5 py-5 px-4 w-100 justify-content-start position-relative';

    treeWrapper.appendChild(renderizarRamoArvore(noRaiz, 1));
    containerNodes.appendChild(treeWrapper);

    requestAnimationFrame(() => {
        setTimeout(desenharNiveisELinhas, 60);
    });
}

function renderizarRamoArvore(noPai, level) {
    const branchDiv = document.createElement('div');
    branchDiv.className = 'eap-node-branch d-flex flex-column align-items-center gap-5 position-relative';
    branchDiv.appendChild(criarHTMLCardNativo(noPai, level));

    const eap = obterEAPAtiva();
    const filhos = eap.nos ? eap.nos.filter(n => n.noCanvas && String(n.paiId) === String(noPai.id)) : [];

    const childrenRow = document.createElement('div');
    childrenRow.className = 'eap-children-row d-flex justify-content-center align-items-start gap-4 position-relative';

    filhos.forEach(filho => {
        childrenRow.appendChild(renderizarRamoArvore(filho, level + 1));
    });

    childrenRow.appendChild(criarHTMLDropZoneExterna(noPai, level + 1));
    branchDiv.appendChild(childrenRow);

    return branchDiv;
}

function criarHTMLCardNativo(no, level) {
    const div = document.createElement('div');
    const isRaiz = (!no.paiId || no.paiId === null || no.paiId === '') && !no.isNovo;
    const idSanitizado = String(no.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const temDescricao = no.descricao && no.descricao.trim() !== '';

    // Limita o texto do cartão a no máximo 5 palavras
    const palavras = no.label ? no.label.trim().split(/\s+/) : [];
    const labelExibido = palavras.length > 5 
        ? palavras.slice(0, 5).join(' ') + '...' 
        : (no.label || '');

    div.id = `node-${no.id}`;
    div.dataset.id = no.id;
    div.dataset.level = level;
    div.className = isRaiz
        ? 'card shadow bg-dark text-white border-warning eap-card eap-card-node p-2'
        : 'card shadow-sm border border-primary-subtle bg-white eap-card eap-card-node p-2';

    if (isRaiz) {
        div.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    <span class="badge bg-warning text-dark fw-bold me-1 mb-1" style="font-size: 0.7rem;">RAIZ</span>
                    <span class="fw-semibold text-white fs-6 flex-grow-1 text-center text-nowrap" title="${no.label}">
                        ${labelExibido}
                    </span>
                    ${temDescricao ? `
                        <button class="btn btn-lg btn-outline-warning text-warning border-0 p-2" type="button" data-bs-toggle="collapse" data-bs-target="#desc-no-${idSanitizado}" aria-expanded="false" title="Ver descrição">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    ` : ''}
                </div>
                ${temDescricao ? `<div class="collapse mt-2 pt-2 border-top small text-white-50 border-secondary" id="desc-no-${idSanitizado}">${no.descricao}</div>` : ''}
            </div>
        `;
    } else {
        div.innerHTML = `
            <div class="card-body p-2">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    ${no.isNovo ? '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle me-1 mb-1" style="font-size: 0.7rem;">Novo</span>' : '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning me-1 mb-1" style="font-size: 0.7rem;">Normal</span>'}
                    
                    <span class="fw-semibold text-dark fs-6 d-block lh-sm text-center text-nowrap" title="${no.label}">
                        ${labelExibido}
                    </span>

                    <button class="btn btn-lg btn-outline-danger border-0 p-2 ms-1" title="Devolver para a gaveta" onclick="devolverNoParaSidebar('${no.id}')">
                        <i class="bi bi-x-circle"></i>
                    </button>
                    
                    ${temDescricao ? `
                        <button class="btn btn-lg btn-outline-light border-0 text-secondary p-2 flex-shrink-0" type="button" data-bs-toggle="collapse" data-bs-target="#desc-no-${idSanitizado}" aria-expanded="false" aria-controls="desc-no-${idSanitizado}" title="Ver descrição">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    ` : '<i class="bi bi-exclamation-diamond text-warning-emphasis p-2" title="Sem descrição"></i>'}
                </div>
                ${temDescricao ? `<div class="collapse mt-2 pt-2 border-top small text-secondary text-break" id="desc-no-${idSanitizado}">${no.descricao}</div>` : ''}
            </div>
        `;
    }

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
        <small class="text-muted text-truncate w-100 px-1" style="font-size: 0.7rem;" title="Pai: ${noPai.label}">
            Pai: <strong>${noPai.label}</strong>
        </small>
    `;

    return div;
}

function desenharNiveisELinhas() {
    desenharCaixasDeNivel();
    desenharLinhasConexaoSVG();
}

/**
 * Desenha dinamicamente uma moldura pontilhada ao redor de cada nível (respeitando a chave toggle)
 */
function desenharCaixasDeNivel() {
    const levelContainer = document.getElementById('canvas-level-boxes');
    const containerNodes = document.getElementById('canvas-nodes');
    if (!levelContainer || !containerNodes) return;

    levelContainer.innerHTML = '';

    if (!exibirCaixasNivel) {
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

            const left = (r.left - rectCanvas.left) / nivelZoom;
            const right = (r.right - rectCanvas.left) / nivelZoom;
            const top = (r.top - rectCanvas.top) / nivelZoom;
            const bottom = (r.bottom - rectCanvas.top) / nivelZoom;

            if (left < minX) minX = left;
            if (right > maxX) maxX = right;
            if (top < minY) minY = top;
            if (bottom > maxY) maxY = bottom;
        });

        if (minX === Infinity || minY === Infinity) return;

        const padX = 30;
        const padY = 18;
        const boxX = minX - padX;
        const boxY = minY - padY;
        const boxW = (maxX - minX) + padX * 2;
        const boxH = (maxY - minY) + padY * 2;

        const levelBox = document.createElement('div');
        levelBox.className = `eap-level-box eap-level-box-${Math.min(lvl, 10)}`;
        levelBox.style.left = `${boxX.toFixed(1)}px`;
        levelBox.style.top = `${boxY.toFixed(1)}px`;
        levelBox.style.width = `${boxW.toFixed(1)}px`;
        levelBox.style.height = `${boxH.toFixed(1)}px`;

        const tagColorClass = 'text-dark';
        const tag = document.createElement('span');
        tag.className = `eap-level-tag ${tagColorClass}`;
        tag.textContent = `Nível ${lvl}`;
        levelBox.appendChild(tag);

        levelContainer.appendChild(levelBox);
    });
}

function desenharLinhasConexaoSVG() {
    const svgEl = document.getElementById('canvas-svg');
    const containerNodes = document.getElementById('canvas-nodes');
    const eap = obterEAPAtiva();
    if (!svgEl || !containerNodes || !eap || !eap.nos) return;

    svgEl.innerHTML = '';
    const rectCanvas = containerNodes.getBoundingClientRect();

    eap.nos.forEach(noPai => {
        if (!noPai.noCanvas) return;

        const elPai = document.getElementById(`node-${noPai.id}`);
        if (!elPai) return;

        const filhos = eap.nos.filter(n => n.noCanvas && String(n.paiId) === String(noPai.id));
        const dropZone = document.getElementById(`dropzone-pai-${noPai.id}`);

        if (filhos.length === 0 && !dropZone) return;

        desenharConexaoHorizontal(elPai, filhos, dropZone, rectCanvas, svgEl);
    });
}

function desenharConexaoHorizontal(elPai, filhos, dropZone, rectCanvas, svgEl) {
    const rectPai = elPai.getBoundingClientRect();
    if (rectPai.width === 0) return;

    const xPai = (rectPai.left + rectPai.width / 2 - rectCanvas.left) / nivelZoom;
    const yPaiBottom = (rectPai.bottom - rectCanvas.top) / nivelZoom;

    const targets = [];
    filhos.forEach(f => {
        const elF = document.getElementById(`node-${f.id}`);
        if (elF) targets.push({ el: elF, isDrop: false });
    });
    if (dropZone) targets.push({ el: dropZone, isDrop: true });

    if (targets.length === 0) return;

    let minTargetX = Infinity, maxTargetX = -Infinity, minYTop = Infinity;

    targets.forEach(t => {
        const r = t.el.getBoundingClientRect();
        if (r.width === 0) return;
        const xCenter = (r.left + r.width / 2 - rectCanvas.left) / nivelZoom;
        const yTop = (r.top - rectCanvas.top) / nivelZoom;

        t.xCenter = xCenter;
        t.yTop = yTop;

        if (xCenter < minTargetX) minTargetX = xCenter;
        if (xCenter > maxTargetX) maxTargetX = xCenter;
        if (yTop < minYTop) minYTop = yTop;
    });

    const yMid = yPaiBottom + (minYTop - yPaiBottom) / 2;

    criarLinhaSVG(svgEl, `M ${xPai.toFixed(1)} ${yPaiBottom.toFixed(1)} L ${xPai.toFixed(1)} ${yMid.toFixed(1)}`, false);

    const busMinX = Math.min(xPai, minTargetX);
    const busMaxX = Math.max(xPai, maxTargetX);
    criarLinhaSVG(svgEl, `M ${busMinX.toFixed(1)} ${yMid.toFixed(1)} L ${busMaxX.toFixed(1)} ${yMid.toFixed(1)}`, false);

    targets.forEach(t => {
        criarLinhaSVG(svgEl, `M ${t.xCenter.toFixed(1)} ${yMid.toFixed(1)} L ${t.xCenter.toFixed(1)} ${t.yTop.toFixed(1)}`, t.isDrop);
    });
}

function criarLinhaSVG(svgEl, pathD, isTracejada) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', '#212529');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', isTracejada ? 'eap-connection-line-dashed' : 'eap-connection-line');
    svgEl.appendChild(path);
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