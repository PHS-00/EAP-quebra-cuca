/**
 * Lógica da Página de Comparação & Resultado (Controlador enxuto que utiliza a engine do canvas.js)
 */

window.isModoComparacao = true;

// Estado isolado para o Zoom, Pan e Exibição de Níveis do Modal de Gabarito
let gabState = { zoom: 1.0, panX: 0, panY: 0 };
let exibirGabCaixasNivel = false;

document.addEventListener('DOMContentLoaded', () => {
    inicializarPaginaComparacao();
});

function inicializarPaginaComparacao() {
    window.eapAtual = EAPStorage.obterEAP();
    if (!window.eapAtual || !window.eapAtual.nos) return;

    // 1. Diagnóstico do Exercício
    const nosAvaliados = prepararNosParaComparacao(window.eapAtual);
    window.eapAtual.nos = nosAvaliados;

    // 2. Renderiza o Canvas Principal usando a Engine
    renderizarArvoreCanvas();
    setTimeout(() => {
        ajustarAoDiagrama('canvas-area', 'canvas-nodes', null, null, 'canvas-viewport');
    }, 120);

    // 3. Popover da Legenda
    inicializarPopoverLegenda();

    // 4. Instância do Canvas no Modal do Gabarito
    configurarInstanciaPanZoom('modal-gabarito-area', 'gabarito-viewport',
        () => gabState,
        (pX, pY, z) => { gabState.panX = pX; gabState.panY = pY; gabState.zoom = z; },
        atualizarVisualizacaoGabarito
    );

    configurarOuvintesCollapse('gabarito-nodes', atualizarVisualizacaoGabarito);

    // Botão de Níveis do Gabarito
    configurarBotaoToggleNiveisGabarito();

    // Controles de Zoom do Gabarito
    document.getElementById('btn-gab-zoom-in')?.addEventListener('click', () => atualizarZoomGabarito(gabState.zoom + 0.1));
    document.getElementById('btn-gab-zoom-out')?.addEventListener('click', () => atualizarZoomGabarito(gabState.zoom - 0.1));
    document.getElementById('btn-gab-zoom-reset')?.addEventListener('click', () => {
        ajustarAoDiagrama('modal-gabarito-area', 'gabarito-nodes', () => gabState, (pX, pY, z) => { gabState = { panX: pX, panY: pY, zoom: z }; }, 'gabarito-viewport');
    });

    // Evento ao abrir o Modal
    const modalGabaritoEl = document.getElementById('modalGabaritoOriginal');
    if (modalGabaritoEl) {
        modalGabaritoEl.addEventListener('shown.bs.modal', () => {
            const nosGabarito = JSON.parse(JSON.stringify(window.eapAtual.nosOriginal || window.eapAtual.nos));
            nosGabarito.forEach(n => n.noCanvas = true);
            renderizarArvoreCanvas('gabarito-nodes', nosGabarito, 'gab-node-', true);
            setTimeout(() => {
                ajustarAoDiagrama('modal-gabarito-area', 'gabarito-nodes', () => gabState, (pX, pY, z) => { gabState = { panX: pX, panY: pY, zoom: z }; }, 'gabarito-viewport');
                atualizarVisualizacaoGabarito();
            }, 80);
        });
    }
}

function atualizarVisualizacaoGabarito() {
    // Atualiza o texto da porcentagem de zoom do Modal do Gabarito
    const text = document.getElementById('gab-zoom-percentage');
    if (text) text.textContent = `${Math.round(gabState.zoom * 100)}%`;

    const nosGabarito = window.eapAtual.nosOriginal || window.eapAtual.nos;
    desenharCaixasDeNivel('gabarito-level-boxes', 'gabarito-nodes', gabState.zoom, exibirGabCaixasNivel);
    desenharLinhasConexaoSVG(nosGabarito, 'gabarito-nodes', 'gabarito-svg', gabState.zoom, 'gab-node-');
}

function atualizarZoomGabarito(novoZoom) {
    gabState.zoom = Math.min(Math.max(novoZoom, 0.3), 1.6);
    aplicarTransformacaoViewport('gabarito-viewport', gabState.panX, gabState.panY, gabState.zoom);
    const text = document.getElementById('gab-zoom-percentage');
    if (text) text.textContent = `${Math.round(gabState.zoom * 100)}%`;
    atualizarVisualizacaoGabarito();
}

function configurarBotaoToggleNiveisGabarito() {
    const btnToggle = document.getElementById('btn-gab-toggle-niveis');
    if (!btnToggle || btnToggle.dataset.iniciado) return;
    btnToggle.dataset.iniciado = 'true';

    btnToggle.addEventListener('click', () => {
        exibirGabCaixasNivel = !exibirGabCaixasNivel;
        const icone = btnToggle.querySelector('i');
        const btnText = btnToggle.querySelector('.btn-text');

        if (exibirGabCaixasNivel) {
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
        atualizarVisualizacaoGabarito();
    });
}

function normalizarId(val) {
    if (val === null || val === undefined || val === '') return '';
    return String(val).trim();
}

function prepararNosParaComparacao(eap) {
    const nosTrabalho = JSON.parse(JSON.stringify(eap.nos));
    const nosOriginal = JSON.parse(JSON.stringify(eap.nosOriginal || eap.nos));

    nosTrabalho.forEach(no => {
        const noRef = nosOriginal.find(n => normalizarId(n.id) === normalizarId(no.id));
        const paiNo = normalizarId(no.paiId);
        const paiRef = noRef ? normalizarId(noRef.paiId) : '';

        if (no.isNovo || !noRef) {
            no.statusComparacao = 'extra';
        } else if (!no.noCanvas) {
            no.statusComparacao = 'missing';
        } else if (paiNo === paiRef) {
            no.statusComparacao = 'correct';
        } else {
            no.statusComparacao = 'wrong-parent';
        }
    });

    nosOriginal.forEach(noOrig => {
        const idOrigNormalized = normalizarId(noOrig.id);
        const noNoCanvas = nosTrabalho.find(n => normalizarId(n.id) === idOrigNormalized && n.noCanvas);

        if (!noNoCanvas) {
            const noNaLista = nosTrabalho.find(n => normalizarId(n.id) === idOrigNormalized);
            if (noNaLista) {
                noNaLista.noCanvas = true;
                noNaLista.paiId = noOrig.paiId;
                noNaLista.statusComparacao = 'missing';
            } else {
                nosTrabalho.push({
                    ...noOrig,
                    noCanvas: true,
                    paiId: noOrig.paiId,
                    statusComparacao: 'missing'
                });
            }
        }
    });

    return nosTrabalho;
}

function inicializarPopoverLegenda() {
    const btnPopover = document.getElementById('btn-popover-legenda');
    if (!btnPopover || typeof bootstrap === 'undefined') return;

    const conteudoLegendaHTML = `
        <div class="p-1">
            <div class="d-flex flex-column gap-1">
                <span class="badge bg-success-subtle text-success border border-success-subtle text-start p-1.5">
                    <i class="bi bi-check-circle-fill me-1"></i>Correto
                </span>
                <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle text-start p-1.5">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>Diferente
                </span>
                <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle text-start p-1.5">
                    <i class="bi bi-plus-circle-fill me-1"></i>Item Extra
                </span>
                <span class="badge bg-danger-subtle text-danger border border-danger-subtle text-start p-1.5">
                    <i class="bi bi-x-circle-fill me-1"></i>Faltando
                </span>
            </div>
        </div>
    `;

    new bootstrap.Popover(btnPopover, {
        content: conteudoLegendaHTML,
        html: true,
        trigger: 'focus',
        placement: 'bottom'
    });
}