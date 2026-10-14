# Quebra Cuca - EAP Interativa

<br/>

Aplicação web responsiva (desktop e mobile) desenvolvida para apoiar dinâmicas educacionais em sala de aula sobre Gerenciamento de Projetos, focada na montagem prática e interativa de uma **Estrutura Analítica do Projeto (EAP / WBS)** no formato de quebra-cabeça.

<br/>

## 🎯 Sobre o Projeto

O sistema transforma o aprendizado de decomposição de escopo em um desafio prático. Os alunos recebem componentes de um projeto pré-carregados via dados estruturados e devem organizá-los hierarquicamente, estimulando a análise crítica, a tomada de decisão e o debate em grupo sobre boas práticas de gestão.

<br/>

## 🚀 Como Funciona a Dinâmica

1. **Carga Inicial via JSON:** O sistema lê uma estrutura de EAP padrão em formato JSON, alimentando o menu lateral com os nós (entregáveis e pacotes de trabalho).
2. **Montagem Interativa (Drag & Drop):** Os alunos arrastam os nós do menu lateral para a área de trabalho (canvas), definindo o nível e a hierarquia (relação pai/filho) de cada elemento.
3. **Criação Livre de Nós:** Se identificarem falhas ou lacunas no escopo oferecido, os alunos podem criar novos nós manualmente.
4. **Validação e Comparação:** Ao concluir a montagem, o sistema compara a EAP construída pelo aluno com o modelo original do JSON e gera um feedback visual categorizado:
    - **Igual:** Nós colocados na posição idêntica ao modelo de referência.
    - **Diferente:** Nós presentes no modelo, mas posicionados em níveis ou hierarquias distintas.
    - **Novo:** Elementos inéditos adicionados pelos alunos.
5. **Debate Pedagógico:** A etapa final é dedicada à discussão orientada pelo professor para analisar as divergências, entender as inclusões de novos itens e validar a lógica por trás da estrutura de referência.
   
<br/>

## ✨ Funcionalidades Principais

- **Interface Multiplataforma:** Suporte a interações por toque (mobile) e clique/arraste (desktop).
- **Menu Lateral Dinâmico:** Organização visual dos componentes disponíveis para uso.
- **Canvas de Construção:** Área livre para organizar a árvore hierárquica por níveis.
- **Inclusão Customizada de Nós:** Liberdade para complementar o escopo com novos itens.
- **Módulo de Análise e Diff:** Comparação automática pós-envio entre a estrutura do usuário e o gabarito JSON.

<br/>
