AGENTS.md — LAB-AIEDU

1. Contexto do projeto

O LAB-AIEDU é um projeto acadêmico de pesquisa e desenvolvimento de uma plataforma extensível baseada em Learning Analytics e Inteligência Artificial.

O backend utiliza Node.js, Fastify e Jest em uma arquitetura modular orientada a plugins.

O projeto está em fase de prototipação. As implementações devem priorizar simplicidade, clareza, testabilidade e possibilidade de evolução.

2. Tecnologias e restrições

Tecnologias atualmente utilizadas:

Node.js 24;

JavaScript com CommonJS;

Fastify 5;

@fastify/helmet;

Jest 30;

JSON Schema e Ajv, integrados ao Fastify.

sanitize-html para os fragmentos HTML dos plugins.

Restrições da etapa atual:

Não implementar banco de dados.

Não implementar Docker ou Docker Compose.

Não configurar Git ou GitHub Actions.

Não instalar, remover ou atualizar dependências sem autorização.

Não migrar o projeto para TypeScript ou ESM sem autorização.

Não implementar funcionalidades fora do escopo solicitado.

Desenvolver inicialmente apenas um plugin experimental.

As restrições são temporárias e poderão ser revisadas em etapas futuras.

3. Organização e arquitetura

- `core/main.js` constrói e configura o Fastify, registra as rotas nativas e coordena a inicialização. Preservar a separação entre `buildApp()` e `start()`.
- `core/plugin-loader.js` descobre candidatos em `Plugins/`, valida manifestos com `id`, `version` e `entry`, seleciona a versão mais recente de cada ID e aguarda o `setup({ cody })` dos módulos escolhidos. A falha de inicialização interrompe o carregamento.
- `core/cody.js` registra as rotas dos plugins, adapta as requisições e controla status, serialização, MIME e envio. Manter o estado por aplicação ou fachada conforme o contrato.
- `core/html-sanitizer.js` aplica a lista de tags permitidas, sem atributos, e limita a entrada a 100.000 unidades UTF-16. Descarta o conteúdo de `head`, `title`, `script`, `style`, `textarea`, `option` e `xmp`.
- `core/render.js` sanitiza o fragmento por meio do módulo de sanitização e monta o documento com título `LAB-AIEDU`.
- `core/public-assets.js` publica o ativo CSS fixo em rota nativa. A geração das páginas dos plugins permanece sem CSS e sem templates.

Contrato público do Cody

- `cody.addRouter(path, routes)` aceita GET, POST, PUT e DELETE com `handler` e `schema` opcional. Preservar a validação de caminhos e conflitos, o encerramento do registro em `onReady` e o HEAD automático.
- Handlers síncronos e assíncronos recebem um único objeto com `params`, `query`, `body`, `headers` e `method`, copiados em profundidade após a validação. A chamada não fornece `request` ou `reply` nativos nem vincula `this` ao Fastify. HEAD aparece como método efetivo.
- `cody.newPage().out(html)` produz um resultado declarativo para GET sem schema de resposta e para o HEAD automático dessa rota. O núcleo sanitiza e renderiza antes de enviar.
- `cody.json(valor, options)` usa 200 por padrão. Aceita apenas opções simples de protótipo local padrão ou nulo, com `status` próprio, enumerável e de dados quando presente. O status deve ser inteiro de 200 a 599, exceto 204, 205 e 304. A identificação dos resultados declarativos usa `WeakMap` privado por fachada.
- O Cody valida dados JSON em profundidade e rejeita retornos especiais, proxies, acessores e ciclos. String comum sem schema é texto simples. Strings declaradas como JSON ou em rotas com schema de resposta passam pela serialização JSON. Preservar a seleção de schemas por status e MIME.
- O `onSend` local atua como defesa complementar contra HTML fora do fluxo de páginas. Erros internos usam HTTP 500 com JSON fixo. Falhas de diagnóstico ficam contidas, e os erros nativos de Ajv, parsing e limite de corpo continuam no Fastify.

Restrições dos plugins

Os plugins serão desenvolvidos pela equipe do projeto.

Os arquivos JavaScript dos plugins não deverão importar bibliotecas externas utilizando require() ou import.

Essa restrição é uma regra de desenvolvimento e não deve ser considerada uma garantia de isolamento de segurança.

4. Segurança

Preservar as proteções existentes:

Cabeçalhos HTTP configurados pelo Helmet.

Limitação do tamanho do corpo das requisições.

Validação de entradas com JSON Schema.

Desativação da conversão automática de tipos no Ajv.

Não inserir dados não confiáveis diretamente em respostas HTML sem tratamento adequado ao contexto.

Acrescentar testes de segurança contra XSS conforme os requisitos da etapa atual.

Não afirmar que a aplicação está livre de vulnerabilidades apenas porque os testes passaram.

As rotas dos plugins devem respeitar Helmet e CSP, o limite global de 1 KiB e a validação do Fastify. Os módulos CommonJS compartilham o processo Node.js com o núcleo. A interface restrita, os `WeakMap`s e o `WeakSet` não constituem sandbox.

A Semana 04 não oferece suporte ampliado a outros contextos JavaScript, limites próprios de tamanho ou profundidade do JSON de saída, respostas binárias, streams como resposta ou cabeçalhos personalizados.

5. Regras de intervenção

Antes de realizar alterações relevantes:

Inspecionar os arquivos relacionados.

Explicar o problema ou requisito.

Apresentar uma proposta de solução.

Identificar os arquivos que serão modificados.

Informar os testes previstos.

Aguardar autorização do usuário.

Durante a implementação:

Realizar mudanças pequenas e incrementais.

Preservar o comportamento existente, salvo autorização explícita.

Não reestruturar arquivos sem necessidade.

Não adicionar abstrações ou dependências desnecessárias.

Não modificar arquivos fora do escopo aprovado.

Não tomar decisões arquiteturais pendentes como se estivessem confirmadas.

Em revisões solicitadas somente para leitura, não modificar arquivos nem gerar artefatos no repositório.

6. Testes

Utilizar Jest para os testes automatizados.

Utilizar app.inject() do Fastify para verificar o comportamento das rotas sem iniciar um servidor HTTP de rede.

Preservar as funcionalidades e os objetivos de cobertura válidos. As nove suítes cobrem núcleo, segurança, Cody, páginas, sanitizador, plugin experimental, bootstrap, carregador e ativos públicos. Concentrar regressões no arquivo responsável pelo comportamento.

Criar testes proporcionais às funcionalidades implementadas.

Verificar casos válidos, inválidos, limites e falhas relevantes.

Executar primeiro as suítes afetadas. Para a verificação geral, usar `npm test -- --runInBand --no-cache`. Usar `npm test -- --runInBand --no-cache --detectOpenHandles` na verificação de recursos abertos. O script do projeto já inclui `--experimental-vm-modules`. Capturar o código do Jest separadamente e conferir o escopo com `git diff --check`, `git status --short` e `git diff --stat`.

Nunca afirmar que um teste passou sem executá-lo.

Informar os comandos executados, os resultados obtidos e as limitações da verificação.

7. Explicação didática das alterações

O projeto também possui finalidade formativa.

Após cada implementação, apresentar:

Objetivo da alteração.

Arquivos criados ou modificados.

Funcionamento do código implementado.

Conceitos técnicos utilizados.

Justificativa das decisões adotadas.

Testes executados e resultados.

Limitações e próximos passos.

Explicar especialmente novos métodos, funções, estruturas de dados, mecanismos assíncronos e decisões arquiteturais.

Não apresentar apenas o código final sem contextualização.

8. Documentação semanal

Após cada alteração autorizada, fornecer obrigatoriamente um bloco Markdown pronto para ser acrescentado ao arquivo docs/semana0X.md.

O registro deverá conter, quando aplicável:

Atividade realizada;

Arquivos modificados;

Decisões técnicas;

Dificuldades encontradas;

Soluções adotadas;

Testes executados;

Resultados efetivamente observados;

Pendências.

Registrar somente fatos confirmados.

Não declarar funcionalidades como concluídas antes de sua implementação e verificação.

Não modificar automaticamente docs/semana0X.md sem autorização expressa.

Preservar o conteúdo já existente no documento, evitando duplicações.

9. Comunicação e aprovação

Distinguir claramente:

Requisitos definidos pelo orientador;

Decisões aprovadas pelo usuário;

Recomendações técnicas;

Hipóteses ainda não verificadas.

Quando houver alternativas relevantes, apresentar vantagens, limitações e impactos antes de escolher.

Priorizar soluções simples, compreensíveis e adequadas ao estágio acadêmico do projeto.
