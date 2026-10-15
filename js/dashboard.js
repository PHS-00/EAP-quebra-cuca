/**
 * Lógica da Dashboard / Área de Trabalho do Quebra-Cuca EAP (Versão Estável)
 */

let eapAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega os dados da EAP salvos no localStorage
    carregarEAP();

    // 2. Configura eventos da interface (Offcanvas e cliques)
    configurarEventosUI();

    // 3. Configura o formulário de criação de novo nó via Modal
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

    // Exibe o título
    const tituloDisplay = document.getElementById('eap-titulo-display');
    if (tituloDisplay) {
        tituloDisplay.textContent = eapAtual.titulo || 'EAP sem título';
    }

    atualizarStatusSalvamento('salvo');
    renderizarListaNos();
    renderizarPecasSidebar();
}

/**
 * Gerencia o badge visual de salvamento no Navbar
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
 * Renderiza a lista de nós na área principal
 */
function renderizarListaNos() {
    const container = document.getElementById('container-lista-nos');
    if (!container || !eapAtual || !eapAtual.nos) return;

    container.innerHTML = '';

    eapAtual.nos.forEach(no => {
        const isRaiz = no.paiId === null;
        const itemHTML = `
            <div class="list-group-item p-3 d-flex align-items-center justify-content-between">
                <div>
                    <div class="d-flex align-items-center gap-2 mb-1">
                        ${isRaiz ? '<span class="badge bg-warning text-dark fw-bold">RAIZ</span>' : '<span class="badge bg-secondary">Nó</span>'}
                        ${no.isNovo ? '<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle">Novo</span>' : '<span class="badge bg-warning-subtle text-warning-subtle border border-warning-subtle">Normal</span>'}
                        <h6 class="fw-semibold mb-0">${no.label}</h6>
                    </div>
                    <small class="text-muted">${no.descricao || 'Sem descrição cadastrada.'}</small>
                </div>
                <span class="font-monospace text-muted small">ID: ${no.id} | Pai: ${no.paiId || 'Nenhum'}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

/**
 * Renderiza os nós na gaveta lateral (Offcanvas)
 */
function renderizarPecasSidebar() {
    const container = document.getElementById('container-nos-sidebar');
    const badgeTotal = document.getElementById('total-eaps-badge');

    if (!container || !eapAtual) return;

    const pecas = eapAtual.nos.filter(no => no.paiId !== null);

    if (badgeTotal) badgeTotal.textContent = pecas.length;

    container.innerHTML = '';

    pecas.forEach(no => {
        const cardHTML = `
            <div class="card my-2 shadow-sm border p-2">
                <div class="card-body p-2">
                    <span class="fw-semibold text-dark fs-6">${no.label}</span>
                    ${no.descricao ? `<p class="small text-muted mb-0 mt-1">${no.descricao}</p>` : ''}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}

/**
 * Eventos básicos de UI
 */
function configurarEventosUI() {
    // Reservado para interações de modal/offcanvas se necessário
}

/**
 * Processa a criação de novos nós pelo formulário modal
 */
function configurarFormularioNovoNo() {
    const form = document.getElementById('form-criar-no');
    const modalEl = document.getElementById('modalCriarNo');

    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const inputTitulo = document.getElementById('input-no-label');
        const inputDesc = document.getElementById('input-no-desc');

        const titulo = inputTitulo.value.trim();
        const descricao = inputDesc ? inputDesc.value.trim() : '';

        if (!titulo) return;

        const noRaiz = eapAtual.nos.find(n => n.paiId === null);
        const novoNo = {
            id: `custom-${Date.now()}`,
            label: titulo,
            descricao: descricao,
            paiId: noRaiz ? noRaiz.id : '1',
            isNovo: true
        };

        eapAtual.nos.push(novoNo);

        atualizarStatusSalvamento('salvando');
        EAPStorage.salvarEAP(eapAtual);

        setTimeout(() => {
            atualizarStatusSalvamento('salvo');
        }, 300);

        renderizarListaNos();
        renderizarPecasSidebar();

        form.reset();
        const bsModal = bootstrap.Modal.getInstance(modalEl);
        if (bsModal) bsModal.hide();
    });
}