/**
 * Lógica de Arrastar e Soltar (Drag & Drop) para a EAP
 */

function configurarEventosDragDrop() {
    const canvasArea = document.getElementById('canvas-area');
    if (!canvasArea) return;

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

function extrairIdPaiDoDropzone(dropZone) {
    if (dropZone.id === 'drop-zone-raiz') {
        const eap = (typeof eapAtual !== 'undefined' && eapAtual) ? eapAtual : EAPStorage.obterEAP();
        const noRaiz = eap.nos.find(n => (!n.paiId || n.paiId === null || n.paiId === '') && !n.isNovo);
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

document.addEventListener('DOMContentLoaded', configurarEventosDragDrop);