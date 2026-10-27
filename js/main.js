document.addEventListener('DOMContentLoaded', () => {
    // Lista de cenários padrão disponíveis na pasta /data
    const cenariosPadrao = [
        'data/eap-construcao-porta.json',
        'data/schema-eap.json',
        // Adicione aqui novos arquivos à medida que forem criados:
        // 'data/eap-exemplo-1.json',
        // 'data/eap-exemplo-2.json'
    ];

    initIndexPage(cenariosPadrao);
});

/**
 * Inicializa a lógica da página principal
 */
async function initIndexPage(listaCenarios) {
    const containerCards = document.getElementById('container-cards-eap');
    const badgeTotal = document.getElementById('total-eaps-badge');
    const eapsCarregadas = [];

    // 1. Carrega os JSONs dos cenários padrão
    for (const caminho of listaCenarios) {
        try {
            const resposta = await fetch(caminho);
            if (!resposta.ok) throw new Error(`Erro HTTP! status: ${resposta.status}`);
            const dadosEAP = await resposta.json();
            eapsCarregadas.push(dadosEAP);
        } catch (erro) {
            console.error(`Falha ao carregar o cenário ${caminho}:`, erro);
        }
    }

    // 2. Atualiza a contagem de cenários e limpa estado de carregamento
    badgeTotal.textContent = `${eapsCarregadas.length}`;
    containerCards.innerHTML = '';

    // 3. Caso nenhum JSON seja carregado
    if (eapsCarregadas.length === 0) {
        containerCards.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-exclamation-triangle fs-2 text-warning"></i>
                <p class="mt-2">Nenhum cenário padrão encontrado na pasta <code>data/</code>.</p>
            </div>
        `;
    } else {
        // 4. Renderiza os cards para cada EAP
        eapsCarregadas.forEach(eap => {
            const cardHTML = criarCardEAP(eap);
            containerCards.insertAdjacentHTML('beforeend', cardHTML);
        });

        // Adiciona evento aos botões dos cards
        configurarBotoesSelecao(eapsCarregadas);
    }

    // 5. Configura o envio de JSON customizado pelo Modal
    configurarUploadCustomizado();
}

/**
 * Prepara o objeto da EAP isolando o Gabarito Original (nosOriginal) 
 * e resetando a área de trabalho para a montagem do aluno.
 */
function iniciarCenario(dadosJson) {
    if (!dadosJson || !dadosJson.nos) return;

    // 1. Clona e preserva o Gabarito Original intocado do arquivo JSON
    const nosOriginal = JSON.parse(JSON.stringify(dadosJson.nos));

    // 2. Prepara os nós de trabalho do aluno (apenas a RAIZ inicia no canvas)
    const nosTrabalho = dadosJson.nos.map(no => {
        const isRaiz = (!no.paiId || no.paiId === null || no.paiId === '');
        return {
            ...JSON.parse(JSON.stringify(no)),
            noCanvas: isRaiz,
            paiId: isRaiz ? null : null
        };
    });

    // 3. Monta o objeto EAP com a referência limpa do Gabarito
    const eapObjeto = {
        ...JSON.parse(JSON.stringify(dadosJson)),
        nosOriginal: nosOriginal, // Gabarito intacto para comparação
        nos: nosTrabalho          // Lista dinâmica do jogo
    };

    // 4. Salva no Storage e redireciona para a Dashboard
    if (typeof EAPStorage !== 'undefined') {
        EAPStorage.salvarEAP(eapObjeto);
    }
    window.location.href = 'dashboard.html';
}

/**
 * Gera o HTML de um card de EAP
 */
function criarCardEAP(eap) {
    const qtdNos = eap.nos ? eap.nos.length : 0;

    return `
        <div class="col-12 col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm border-0 hover-shadow transition">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <span class="badge bg-primary-subtle text-primary border border-primary-subtle">
                            <i class="bi bi-diagram-2 me-1"></i>${qtdNos} elementos
                        </span>
                        <small class="px-2 py-2 badge bg-${eap.versao == null ? 'warning' : 'primary'}-subtle text-${eap.versao == null ? 'warning' : 'primary'}-emphasis border border-${eap.versao == null ? 'warning' : 'primary'} rounded-pill text-bg-${eap.versao == null ? 'warning' : 'primary'}" style="font-size: 0.7rem;">${eap.versao || 'Teste'}</small>
                    </div>
                    <h5 class="card-title fw-bold text-dark">${eap.titulo}</h5>
                    <p class="card-text text-secondary small flex-grow-1">
                        ${eap.descricao || 'Sem descrição cadastrada.'}
                    </p>
                    <small class="text-muted text-truncate text-break"><i class="bi bi-person me-1"></i>${eap.autor || 'Anônimo'}</small>
                    <div class="p-2 border-top d-flex align-items-center justify-content-end">
                        <button class="btn btn-outline-primary btn-lg rounded-pill btn-selecionar-eap btn-hover-text" data-id="${eap.id}">
                            <span class="btn-text small m-0">Iniciar</span>
                            <i class="bi bi-arrow-right m-0"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Registra os eventos de clique nos cards para salvar e redirecionar
 */
function configurarBotoesSelecao(listaEAPs) {
    const botoes = document.querySelectorAll('.btn-selecionar-eap');
    botoes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eapId = e.currentTarget.getAttribute('data-id');
            const eapSelecionada = listaEAPs.find(item => item.id === eapId);

            if (eapSelecionada) {
                iniciarCenario(eapSelecionada);
            }
        });
    });
}

/**
 * Gerencia o upload de JSON via Modal
 */
function configurarUploadCustomizado() {
    const btnConfirmar = document.getElementById('btnConfirmarUpload');
    const inputArquivo = document.getElementById('inputJsonFile');
    const alertFeedback = document.getElementById('uploadFeedback');

    if (!btnConfirmar) return;

    btnConfirmar.addEventListener('click', () => {
        const arquivo = inputArquivo.files[0];

        if (!arquivo) {
            exibirErro('Por favor, selecione um arquivo .json antes de prosseguir.');
            return;
        }

        const leitor = new FileReader();

        leitor.onload = function (e) {
            try {
                const conteudoJSON = JSON.parse(e.target.result);

                // Validação básica do schema da EAP
                if (!conteudoJSON.id || !conteudoJSON.titulo || !Array.isArray(conteudoJSON.nos)) {
                    throw new Error('O arquivo JSON não possui a estrutura esperada (campos "id", "titulo" e "nos" são obrigatórios).');
                }

                // Salva com nosOriginal e inicializa a montagem do aluno
                iniciarCenario(conteudoJSON);

            } catch (erro) {
                exibirErro(`Arquivo inválido: ${erro.message}`);
            }
        };

        leitor.readAsText(arquivo);
    });

    function exibirErro(mensagem) {
        alertFeedback.textContent = mensagem;
        alertFeedback.classList.remove('d-none');
    }
}