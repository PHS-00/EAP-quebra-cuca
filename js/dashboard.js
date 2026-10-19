/**
 * Lógica do Dashboard, Controle de Estado e Modal
 */

let eapAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega os dados da EAP salvos no localStorage
    carregarEAP();

    // 2. Configura os controles do formulário e do modal
    configurarFormularioNovoNo();
});

/**
 * Recupera e inicializa os dados da EAP
 */
function carregarEAP() {
    eapAtual = EAPStorage.obterEAP();

    if (!eapAtual) {
        alert('Nenhum cenário de EAP selecionado. Redirecionando...');
        window.location.href = 'index.html';
        return;
    }

    const tituloDisplay = document.getElementById('eap-titulo-display');
    if (tituloDisplay) {
        tituloDisplay.textContent = eapAtual.titulo || 'EAP sem título';
    }

    atualizarStatusSalvamento('salvo');
    renderizarPecasSidebar();

    // Chama a renderização dinâmica da árvore completa no canvas
    if (typeof renderizarArvoreCanvas === 'function') {
        renderizarArvoreCanvas();
    }
}

/**
 * Gerencia o badge visual de status de salvamento no Navbar
 */
function atualizarStatusSalvamento(status) {
    const badgeStatus = document.getElementById('eap-status-display');
    if (!badgeStatus) return;

    switch (status) {
        case 'salvo':
            badgeStatus.className = 'badge bg-success-subtle text-success border border-success-subtle font-monospace mt-1';
            badgeStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Salvo';
            break;
        case 'pendente':
            badgeStatus.className = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle font-monospace mt-1';
            badgeStatus.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i>Alterações pendentes';
            break;
        case 'salvando':
            badgeStatus.className = 'badge bg-info-subtle text-info border border-info-subtle font-monospace mt-1';
            badgeStatus.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i>Salvando...';
            break;
    }
}

/**
 * Salva as alterações no localStorage
 */
function salvarEstadoSilencioso() {
    atualizarStatusSalvamento('salvando');
    EAPStorage.salvarEAP(eapAtual);

    setTimeout(() => {
        atualizarStatusSalvamento('salvo');
    }, 300);
}

/**
 * Renderiza as peças disponíveis na gaveta lateral (Sidebar)
 */
function renderizarPecasSidebar() {
    const container = document.getElementById('container-nos-sidebar');
    const badgeTotal = document.getElementById('total-eaps-badge');

    if (!container || !eapAtual || !eapAtual.nos) return;

    // Filtra o nó raiz original para não exibir na gaveta
    const noRaizOriginal = eapAtual.nos.find(no => (!no.paiId || no.paiId === null || no.paiId === '') && !no.isNovo);
    const pecasDisponiveis = eapAtual.nos.filter(no => no !== noRaizOriginal && !no.noCanvas);

    if (badgeTotal) {
        badgeTotal.textContent = pecasDisponiveis.length;
    }

    container.innerHTML = '';

    if (pecasDisponiveis.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-check-circle fs-3 text-success d-block mb-2"></i>
                <small>Todas as peças foram posicionadas na árvore!</small>
            </div>
        `;
        return;
    }

    pecasDisponiveis.forEach(no => {
        const idSanitizado = String(no.id).replace(/[^a-zA-Z0-9_-]/g, '-');
        const temDescricao = no.descricao && no.descricao.trim() !== '';

        const cardHTML = `
            <div class="card shadow-sm border eap-card w-auto p-2" 
                 data-id="${no.id}" 
                 draggable="true">
                <div class="card-body p-2">
                    <div class="d-flex align-items-center justify-content-between gap-2">
                        ${no.isNovo ? '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle me-1 mb-1" style="font-size: 0.7rem;">Novo</span>' : '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning me-1 mb-1" style="font-size: 0.7rem;">Normal</span>'}
                        <span class="fw-semibold text-dark fs-6 d-block lh-sm text-truncate" title="${no.label}">
                            ${no.label}
                        </span>
                        
                        ${temDescricao ? `
                            <button class="btn btn-lg btn-outline-light border-0 text-secondary p-3 flex-shrink-0" 
                                    type="button" 
                                    data-bs-toggle="collapse" 
                                    data-bs-target="#desc-no-${idSanitizado}" 
                                    aria-expanded="false" 
                                    aria-controls="desc-no-${idSanitizado}"
                                    title="Ver descrição">
                                <i class="bi bi-chevron-down fs-6"></i>
                            </button>
                        ` : '<i class="bi bi-exclamation-diamond text-warning-emphasis p-3" title="Sem descrição"></i>'}
                    </div>
                    
                    ${temDescricao ? `
                        <div class="collapse mt-2 pt-2 border-top small text-secondary text-break" id="desc-no-${idSanitizado}">
                            ${no.descricao}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', cardHTML);
    });

    // Associa eventos de dragstart nos cards da gaveta
    container.querySelectorAll('.eap-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const noId = card.getAttribute('data-id');
            e.dataTransfer.setData('text/plain', noId);

            const sidebarEl = document.getElementById('sidebar-nos');
            if (sidebarEl) {
                const bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebarEl);
                if (bsOffcanvas) {
                    bsOffcanvas.hide();
                }
            }
        });
    });
}

/**
 * Processa a criação de um novo nó personalizado via Modal
 */
function configurarFormularioNovoNo() {
    const form = document.getElementById('form-criar-no');
    const modalEl = document.getElementById('modalCriarNo');

    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const inputTitulo = document.getElementById('input-no-label');
        const inputDesc = document.getElementById('input-no-desc');

        const titulo = inputTitulo ? inputTitulo.value.trim() : '';
        const descricao = inputDesc ? inputDesc.value.trim() : '';

        if (!titulo) return;

        const novoNo = {
            id: `custom-${Date.now()}`,
            label: titulo,
            descricao: descricao,
            paiId: null,
            noCanvas: false,
            isNovo: true
        };

        if (!eapAtual.nos) eapAtual.nos = [];
        eapAtual.nos.push(novoNo);

        salvarEstadoSilencioso();
        renderizarPecasSidebar();

        form.reset();

        if (modalEl) {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
            bsModal.hide();
        }

        const sidebarEl = document.getElementById('sidebar-nos');
        if (sidebarEl) {
            const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(sidebarEl);
            bsOffcanvas.show();
        }
    });
}