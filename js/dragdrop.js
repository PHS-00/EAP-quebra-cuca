/**
 * Lógica de Arrastar e Soltar (Drag & Drop) com Suporte Híbrido: Desktop (HTML5) e Mobile (Touch com Press & Hold)
 */

let cardArrasteMobile = null;
let cloneFlutuanteMobile = null;
let dropZoneDestocada = null;
let offsetXTouch = 0;
let offsetYTouch = 0;

// Variáveis para controle de tempo e rolagem no touch
let touchTimer = null;
let touchStartPos = { x: 0, y: 0 };
const LONG_PRESS_DELAY = 250; // Tempo em ms segurando para ativar o arrasto

function configurarEventosDragDrop() {
    configurarDragDropDesktop();
    configurarDragDropMobile();
}

/* ==========================================================================
   1. DRAG & DROP DESKTOP (HTML5 Native)
   ========================================================================== */

function configurarDragDropDesktop() {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

    // Fecha o offcanvas no início do arrasto no Desktop
    document.addEventListener('dragstart', (e) => {
        const cardEl = e.target.closest('.eap-card[draggable="true"]');
        if (cardEl && cardEl.closest('.offcanvas')) {
            fecharOffcanvasMobile();
        }
    });

    canvasArea.addEventListener('dragover', (e) => {
        const dropZone = e.target.closest('.eap-drop-zone');
        if (dropZone) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            dropZone.classList.add('border-primary', 'bg-primary-subtle');
        }
    });

    canvasArea.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('.eap-drop-zone');
        if (dropZone) {
            dropZone.classList.remove('border-primary', 'bg-primary-subtle');
        }
    });

    canvasArea.addEventListener('drop', (e) => {
        const dropZone = e.target.closest('.eap-drop-zone');
        if (!dropZone) return;

        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-primary-subtle');

        const noId = e.dataTransfer.getData('text/plain');
        const paiId = dropZone.dataset.paiId || extrairIdPaiDoDropzone(dropZone);

        if (noId) adicionarNoNaHierarquia(noId, paiId);
    });
}

/* ==========================================================================
   2. DRAG & DROP MOBILE (Touch Events com Press & Hold)
   ========================================================================== */

function configurarDragDropMobile() {
    document.addEventListener('touchstart', tratarTouchStart, { passive: false });
    document.addEventListener('touchmove', tratarTouchMove, { passive: false });
    document.addEventListener('touchend', tratarTouchEnd, { passive: false });
    document.addEventListener('touchcancel', limparEstadoTouchMobile);
}

function tratarTouchStart(e) {
    const cardEl = e.target.closest('.eap-card[draggable="true"]');
    if (!cardEl) return;

    // Se o toque foi direto em um botão ou elemento de colapso, ignora o arrasto
    if (e.target.closest('button, .collapse, [data-bs-toggle="collapse"]')) return;

    const touch = e.touches[0];
    const noId = cardEl.dataset.id;
    if (!noId) return;

    touchStartPos = { x: touch.clientX, y: touch.clientY };

    if (touchTimer) clearTimeout(touchTimer);

    // Inicia temporizador para esperar o usuário segurar a peça
    touchTimer = setTimeout(() => {
        iniciarArrasteMobile(cardEl, noId, touch);
    }, LONG_PRESS_DELAY);
}

function iniciarArrasteMobile(cardEl, noId, touch) {
    cardArrasteMobile = { id: noId, el: cardEl };
    const estavaNoOffcanvas = !!cardEl.closest('.offcanvas');

    const rect = cardEl.getBoundingClientRect();
    offsetXTouch = touch.clientX - rect.left;
    offsetYTouch = touch.clientY - rect.top;

    // Cria clone flutuante do card
    cloneFlutuanteMobile = cardEl.cloneNode(true);
    cloneFlutuanteMobile.style.position = 'fixed';
    cloneFlutuanteMobile.style.left = `${touch.clientX - offsetXTouch}px`;
    cloneFlutuanteMobile.style.top = `${touch.clientY - offsetYTouch}px`;
    cloneFlutuanteMobile.style.width = `${rect.width}px`;
    cloneFlutuanteMobile.style.opacity = '0.88';
    cloneFlutuanteMobile.style.pointerEvents = 'none';
    cloneFlutuanteMobile.style.zIndex = '9999';
    cloneFlutuanteMobile.style.boxShadow = '0 12px 24px rgba(0,0,0,0.25)';

    document.body.appendChild(cloneFlutuanteMobile);

    // Vibração tátil no smartphone para dar feedback de "peça agarrada"
    if (navigator.vibrate) navigator.vibrate(40);

    // Se estava na gaveta, fecha ela para liberar a visão do canvas
    if (estavaNoOffcanvas) {
        fecharOffcanvasMobile();
    }
}

function tratarTouchMove(e) {
    const touch = e.touches[0];

    // Se o usuário moveu o dedo antes de dar 250ms, significa que ele está rolando a tela
    if (touchTimer && !cardArrasteMobile) {
        const dist = Math.hypot(touch.clientX - touchStartPos.x, touch.clientY - touchStartPos.y);
        if (dist > 8) { // Movel mais de 8px: cancela o arrasto e permite scroll da gaveta
            clearTimeout(touchTimer);
            touchTimer = null;
        }
        return;
    }

    if (!cardArrasteMobile || !cloneFlutuanteMobile) return;

    if (e.cancelable) e.preventDefault();

    // Atualiza a posição do clone no dedo do usuário
    cloneFlutuanteMobile.style.left = `${touch.clientX - offsetXTouch}px`;
    cloneFlutuanteMobile.style.top = `${touch.clientY - offsetYTouch}px`;

    // Detecta qual área de soltura está sob o toque
    const elementoSobOToque = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZoneAtual = elementoSobOToque ? elementoSobOToque.closest('.eap-drop-zone') : null;

    if (dropZoneDestocada && dropZoneDestocada !== dropZoneAtual) {
        dropZoneDestocada.classList.remove('border-primary', 'bg-primary-subtle');
        dropZoneDestocada = null;
    }

    if (dropZoneAtual) {
        dropZoneAtual.classList.add('border-primary', 'bg-primary-subtle');
        dropZoneDestocada = dropZoneAtual;
    }
}

function tratarTouchEnd(e) {
    // Se o toque terminou antes de dar 250ms, trata-se de um clique normal (abrir descrição)
    if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
    }

    if (!cardArrasteMobile) return;

    if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const elementoSobOToque = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropZone = elementoSobOToque ? elementoSobOToque.closest('.eap-drop-zone') : null;

        if (dropZone) {
            const noId = cardArrasteMobile.id;
            const paiId = dropZone.dataset.paiId || extrairIdPaiDoDropzone(dropZone);

            if (noId) {
                adicionarNoNaHierarquia(noId, paiId);
            }
        }
    }

    limparEstadoTouchMobile();
}

function limparEstadoTouchMobile() {
    if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
    }
    if (cloneFlutuanteMobile && cloneFlutuanteMobile.parentNode) {
        cloneFlutuanteMobile.parentNode.removeChild(cloneFlutuanteMobile);
    }
    if (dropZoneDestocada) {
        dropZoneDestocada.classList.remove('border-primary', 'bg-primary-subtle');
    }

    cardArrasteMobile = null;
    cloneFlutuanteMobile = null;
    dropZoneDestocada = null;
}

/* ==========================================================================
   3. FUNÇÕES AUXILIARES
   ========================================================================== */

function extrairIdPaiDoDropzone(dropZone) {
    if (dropZone.id === 'drop-zone-raiz') {
        const eap = (typeof eapAtual !== 'undefined' && eapAtual) ? eapAtual : EAPStorage.obterEAP();
        const noRaiz = eap.nos ? eap.nos.find(n => (!n.paiId || n.paiId === null || n.paiId === '') && !n.isNovo) : null;
        return noRaiz ? noRaiz.id : null;
    }
    return dropZone.dataset.paiId || null;
}

function adicionarNoNaHierarquia(noId, paiId) {
    const eap = (typeof eapAtual !== 'undefined' && eapAtual) ? eapAtual : EAPStorage.obterEAP();
    if (!eap || !eap.nos) return;

    const noArrastado = eap.nos.find(n => String(n.id) === String(noId));
    if (!noArrastado || String(noArrastado.id) === String(paiId)) return;

    noArrastado.paiId = paiId;
    noArrastado.noCanvas = true;

    if (typeof salvarEstadoSilencioso === 'function') salvarEstadoSilencioso();
    if (typeof renderizarPecasSidebar === 'function') renderizarPecasSidebar();
    if (typeof renderizarArvoreCanvas === 'function') renderizarArvoreCanvas();
}

function fecharOffcanvasMobile() {
    const offcanvasEl = document.querySelector('.offcanvas.show');
    if (!offcanvasEl) return;

    if (typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
        const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
        if (bsOffcanvas) {
            bsOffcanvas.hide();
            return;
        }
    }

    const btnClose = offcanvasEl.querySelector('.btn-close, [data-bs-dismiss="offcanvas"]');
    if (btnClose) {
        btnClose.click();
    } else {
        offcanvasEl.classList.remove('show');
        const backdrop = document.querySelector('.offcanvas-backdrop');
        if (backdrop) backdrop.remove();
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }
}

document.addEventListener('DOMContentLoaded', configurarEventosDragDrop);