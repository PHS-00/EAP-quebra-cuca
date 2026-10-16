/**
 * Gerenciamento do Canvas Nativo: Pan, Zoom e Renderização Inicial da EAP
 */

// Estado global do Canvas
let nivelZoom = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

/**
 * Inicialização Principal do Canvas
 */
function inicializarCanvasNativo() {
    configurarPanEZoom();
    configurarControlesZoom();
    configurarOuvintesCollapse();
    renderizarInicialCanvas();
}

/**
 * Configura o Pan (arraste com mouse) e Zoom (scroll do mouse)
 */
function configurarPanEZoom() {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea || canvasArea.dataset.canvasIniciado) return;
    canvasArea.dataset.canvasIniciado = 'true';

    // Evento de Pan
    canvasArea.addEventListener('mousedown', (e) => {
        if (e.target.closest('.eap-card-node') || e.target.closest('button') || e.target.closest('.offcanvas')) return;
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

    // Evento de Zoom
    canvasArea.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        atualizarZoom(nivelZoom + delta);
    }, { passive: false });
}

/**
 * Configura ouvintes para acompanhar a animação de expandir/recolher a descrição dos cards
 */
function configurarOuvintesCollapse() {
    const containerNodes = document.getElementById('canvas-nodes');
    if (!containerNodes || containerNodes.dataset.collapseIniciado) return;
    containerNodes.dataset.collapseIniciado = 'true';

    let intervalRedraw = null;

    const iniciarAcompanhamento = () => {
        if (intervalRedraw) clearInterval(intervalRedraw);
        // Recalcula as linhas SVG durante a transição CSS do Bootstrap (~350ms)
        intervalRedraw = setInterval(desenharLinhaPontilhadaSVG, 16);
        setTimeout(() => {
            if (intervalRedraw) clearInterval(intervalRedraw);
            desenharLinhaPontilhadaSVG();
        }, 360);
    };

    // Eventos nativos disparados pelo Bootstrap Collapse
    containerNodes.addEventListener('show.bs.collapse', iniciarAcompanhamento);
    containerNodes.addEventListener('hide.bs.collapse', iniciarAcompanhamento);
    containerNodes.addEventListener('shown.bs.collapse', desenharLinhaPontilhadaSVG);
    containerNodes.addEventListener('hidden.bs.collapse', desenharLinhaPontilhadaSVG);
}

/**
 * Aplica transformações CSS no Viewport
 */
function aplicarTransformacaoViewport() {
    const viewport = document.getElementById('canvas-viewport');
    if (viewport) {
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${nivelZoom})`;
    }
}

/**
 * Atualiza o nível de Zoom e o contador visual
 */
function atualizarZoom(novoZoom) {
    nivelZoom = Math.min(Math.max(novoZoom, 0.4), 1.6);
    aplicarTransformacaoViewport();

    const zoomText = document.getElementById('zoom-percentage');
    if (zoomText) {
        zoomText.textContent = `${Math.round(nivelZoom * 100)}%`;
    }

    desenharLinhaPontilhadaSVG();
}

/**
 * Associa os cliques dos botões de Zoom (+, - e Reset)
 */
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
        btnReset.addEventListener('click', () => {
            panX = 0;
            panY = 0;
            atualizarZoom(1.0);
        });
    }
}

/**
 * Renderiza o Nó Raiz com seu design original e a área pontilhada diretamente abaixo
 */
function renderizarInicialCanvas() {
    const containerNodes = document.getElementById('canvas-nodes');
    if (!containerNodes) return;

    // Busca os dados da EAP carregados
    const eap = (typeof eapAtual !== 'undefined' && eapAtual) 
        ? eapAtual 
        : (typeof EAPStorage !== 'undefined' ? EAPStorage.obterEAP() : null);

    if (!eap || !eap.nos) return;

    containerNodes.innerHTML = '';

    // Encontra o nó raiz original
    const noRaiz = eap.nos.find(n => (!n.paiId || n.paiId === null || n.paiId === '') && !n.isNovo);
    if (!noRaiz) return;

    const idSanitizado = String(noRaiz.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const temDescricao = noRaiz.descricao && noRaiz.descricao.trim() !== '';

    // Wrapper com alinhamento central vertical
    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex flex-column align-items-center gap-5 py-5 w-100 justify-content-start';

    wrapper.innerHTML = `
        <!-- Card do Nó Raiz (Design mantido intacto) -->
        <div id="node-raiz-${noRaiz.id}" 
             class="card shadow bg-dark text-white border-warning eap-card eap-card-node p-2" 
             data-id="${noRaiz.id}"
             style="min-width: 240px; max-width: 380px;">
            <div class="card-body p-2">
                <div class="d-flex align-items-center justify-content-between gap-2">
                    <span class="badge bg-warning text-dark fw-bold me-1 mb-1" style="font-size: 0.7rem;">RAIZ</span>
                    <span class="fw-semibold text-white fs-6 flex-grow-1 text-truncate text-center">
                        ${noRaiz.label}
                    </span>
                    ${temDescricao ? `
                        <button class="btn btn-lg btn-outline-warning text-warning border-0 p-2" 
                                type="button" 
                                data-bs-toggle="collapse" 
                                data-bs-target="#desc-no-${idSanitizado}" 
                                aria-expanded="false"
                                title="Ver descrição">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    ` : ''}
                </div>
                ${temDescricao ? `
                    <div class="collapse mt-2 pt-2 border-top small text-white-50 border-secondary" id="desc-no-${idSanitizado}">
                        ${noRaiz.descricao}
                    </div>
                ` : ''}
            </div>
        </div>

        <!-- Área Pontilhada de Soltura -->
        <div id="drop-zone-raiz" 
             class="eap-drop-zone rounded-3 p-3 text-center text-secondary-emphasis d-flex flex-column align-items-center justify-content-center">
            <i class="bi bi-plus-circle-dotted fs-4 mb-1"></i>
            <small>Solte a peça aqui</small>
        </div>
    `;

    containerNodes.appendChild(wrapper);

    // Aguarda a renderização no DOM para calcular a geometria precisa no SVG
    setTimeout(desenharLinhaPontilhadaSVG, 60);
}

/**
 * Desenha a linha pontilhada no SVG conectando a base da Raiz ao topo da caixa de soltura
 */
function desenharLinhaPontilhadaSVG() {
    const svgEl = document.getElementById('canvas-svg');
    const containerNodes = document.getElementById('canvas-nodes');
    const cardRaiz = containerNodes ? containerNodes.querySelector('.eap-card-node') : null;
    const dropZone = document.getElementById('drop-zone-raiz');

    if (!svgEl || !containerNodes || !cardRaiz || !dropZone) return;

    svgEl.innerHTML = '';

    const rectCanvas = containerNodes.getBoundingClientRect();
    const rectRaiz = cardRaiz.getBoundingClientRect();
    const rectDrop = dropZone.getBoundingClientRect();

    if (rectRaiz.width === 0 || rectDrop.width === 0) return;

    // Calcula coordenadas relativas corrigidas pelo fator de zoom
    const x1 = (rectRaiz.left + rectRaiz.width / 2 - rectCanvas.left) / nivelZoom;
    const y1 = (rectRaiz.bottom - rectCanvas.top) / nivelZoom;

    const x2 = (rectDrop.left + rectDrop.width / 2 - rectCanvas.left) / nivelZoom;
    const y2 = (rectDrop.top - rectCanvas.top) / nivelZoom;

    const pathD = `M ${x1} ${y1} L ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', '#0d6efd');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '8,6');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'eap-connection-line-dashed');

    svgEl.appendChild(path);
}

// Redesenha a linha se a janela for redimensionada
window.addEventListener('resize', () => {
    desenharLinhaPontilhadaSVG();
});

// Auto-executa como salvaguarda após o carregamento completo da página
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(inicializarCanvasNativo, 100);
});