# Semana 02 — Estruturação inicial do sistema de Plugins 27/10/26

## 1. Teste de implementação com o codex

Estou estudando como utilizar agentes de IA para automatizar e melhorar o processo de criação, revisão e teste de código. Nesse semana, utilizarei o codex logado em uma conta do chatGPT plus. Definirei o AGENTS.md para definir um escopo de alteraçẽos permitidas por mim que o agente poderá fazer. Além de registrar cada etapa nesse arquivo para fazer o relatório.

## 2. Primeiro prompt

Para começar, pedi uma revisão geral do projeto com recomendações de melhorias para serem feitas. Esse foi o prompt:

Você atuará como revisor técnico e assistente de desenvolvimento do projeto acadêmico LAB-AIEDU, desenvolvido com Node.js, Fastify e Jest.

Sua primeira tarefa é realizar uma revisão técnica completa do projeto existente. Nesta etapa, trabalhe exclusivamente em modo de leitura. Não crie, edite, exclua ou mova arquivos, nem instale dependências.

Analise:

Toda a estrutura de diretórios e arquivos do projeto, incluindo core/, Plugins/, tests/, docs/, package.json, package-lock.json, .gitignore e README.md.

O funcionamento do backend, especialmente core/main.js e core/cody.js.

A implementação dos métodos GET, POST, PUT e DELETE.

Os mecanismos de segurança existentes: Helmet, JSON Schema, limites de requisição e possíveis vulnerabilidades XSS.

A qualidade, a cobertura funcional e a organização dos testes Jest.

A compatibilidade das dependências e a necessidade atual de --experimental-vm-modules.

A organização do código, a separação de responsabilidades, o tratamento de erros e a facilidade de manutenção.

A documentação existente e sua coerência com o código efetivamente implementado.

A preparação da estrutura atual para uma futura arquitetura extensível baseada em plugins.

Requisitos da nova etapa:

Os plugins ainda não foram implementados.

Inicialmente, será desenvolvido somente um plugin experimental para validar a arquitetura.

O sistema deverá descobrir plugins em Plugins/.

Cada plugin terá um arquivo próprio de configuração com ID, versão e ponto de entrada.

Havendo versões diferentes de um mesmo ID, somente a versão mais recente deverá ser selecionada.

Cada plugin deverá exportar uma função obrigatória setup(config).

O objeto de configuração disponibilizará o Cody, responsável pela interface entre os plugins e o núcleo.

O Cody deverá oferecer um mecanismo de registro de rotas, seguindo a ideia cody.addRouter(caminho, objetoDeRotas).

Os arquivos JavaScript dos plugins não deverão importar bibliotecas externas.

Os plugins serão desenvolvidos pela própria equipe.

Não implementar Git, Docker, GitHub Actions nem banco de dados nesta etapa.

Formato obrigatório do relatório:

1. Estado atual do projeto

Descreva o que realmente existe e funciona, com referências aos arquivos.

2. Problemas identificados

Apresente problemas concretos, distinguindo erros, riscos e oportunidades de melhoria.

3. Sugestões técnicas

Para cada sugestão, informe:

Arquivo afetado;

Problema ou necessidade;

Solução proposta;

Justificativa técnica;

Prioridade (alta, média ou baixa);

Impacto sobre a arquitetura e os testes.

4. Arquitetura de plugins

Proponha uma arquitetura inicial simples e extensível, sem implementá-la. Identifique decisões que ainda precisam de confirmação.

5. Plano incremental

Organize as futuras implementações em etapas pequenas, cada uma com seus testes e critérios de aceitação.

6. Proposta para o AGENTS.md

Sugira as regras que devem orientar suas futuras intervenções neste repositório.

7. Dificuldades e limitações

Informe qualquer ponto que não tenha sido possível verificar.

Regras de trabalho para as próximas etapas:

Antes de mudanças relevantes, apresente um plano e aguarde autorização.

Não adicione dependências sem autorização.

Não implemente funcionalidades fora do escopo.

Após cada alteração autorizada, explique os arquivos modificados, os conceitos utilizados e os testes executados.

Ao final de cada alteração, forneça um bloco Markdown pronto para ser acrescentado a docs/semana02.md, registrando apenas o que foi realmente realizado, as decisões técnicas, as dificuldades e os resultados dos testes.

Não registre testes como aprovados sem executá-los.

Não altere automaticamente docs/semana02.md, a menos que eu autorize expressamente.

Finalize a revisão apresentando suas recomendações e aguarde minhas instruções.

### Definição das regras de intervenção no repositório

- Atividade realizada: preenchimento do AGENTS.md na raiz de Backend/
  com o conteúdo integral aprovado pelo usuário.
- Arquivo modificado: AGENTS.md.
- Decisões registradas: restrições tecnológicas, organização do núcleo,
  requisitos iniciais dos plugins, segurança, autorização de mudanças,
  testes, explicações didáticas e documentação semanal.
- Verificação executada: comparação integral do arquivo gravado com
  o texto aprovado, utilizando Node.js.
- Resultado: conteúdo idêntico, com nove seções e 6.419 bytes em UTF-8.
- Testes Jest: não executados; alteração exclusivamente documental.
- Dificuldades: nenhuma.
- Pendências: contratos e decisões arquiteturais indicados no documento
  permanecem sujeitos à aprovação antes da implementação.
- Nenhum outro arquivo foi modificado.

## 3. Ajuste do ambiente de testes e dos metadados

- Arquivos modificados: package.json, package-lock.json e README.md.
- Os scripts de teste passaram a executar o Jest local com
  node --experimental-vm-modules, preservando CommonJS.
- O lockfile foi sincronizado com o nome lab-aiedu-backend e a versão
  0.1.0. A licença residual ISC foi removida, sem adicionar uma licença.
- As 365 entradas de terceiros do lockfile foram comparadas integralmente
  e permaneceram idênticas. As dependências declaradas não foram alteradas.
- O README passou a documentar tecnologias, ambiente verificado,
  execução do servidor, testes, cobertura e uso experimental de VM Modules.
  Também esclarece que Cody e plugins ainda não estão implementados.

Comandos executados:

- npm install --package-lock-only --ignore-scripts --no-audit --no-fund
- npm test -- --runInBand --no-cache
- npm run test:coverage -- --runInBand --no-cache --coverageReporters=text

Resultados observados:

- Sincronização concluída sem instalação de bibliotecas.
- Duas suítes e oito testes aprovados em cada execução.
- Cobertura: 69,56% de linhas/instruções, 50% de ramificações
  e 83,33% de funções.
- Nenhum arquivo de cobertura criado no repositório.
- core/, Plugins/, tests/, AGENTS.md e docs/ permaneceram inalterados.

Dificuldades: nenhuma. O aviso de VM Modules experimental apareceu,
sem impedir a execução.

Limitações: validação no Node 24.20.0 e npm 11.19.0, com dependências
já instaladas; instalação limpa e servidor em rede não foram testados.
A opção experimental permanece necessária no ambiente verificado.

## 4. Validação de entradas e testes de ausência de reflexão

- Arquivos modificados: core/main.js e tests/security.test.js.
- Acrescentado removeAdditional: false ao Ajv, preservando
  coerceTypes: false e o JSON Schema existente.
- Propriedades adicionais passaram a ser rejeitadas com HTTP 400.
- Preservados os oito testes originais e acrescentados 29 casos,
  totalizando 37 testes em duas suítes.
- Testados comprimentos, tipos inválidos, propriedades extras, espaço
  único, Unicode, JSON malformado e corpo ausente.
- POST sem corpo retornou HTTP 400 antes e depois da alteração.
- Corpos conferidos com Buffer.byteLength(): 1.024 bytes retornaram 200;
  1.025 bytes retornaram 413.
- Marcadores inofensivos não foram refletidos nas respostas verificadas:
  HTML do POST, query string do GET e erros de validação.
- Ampliadas as verificações de cabeçalhos e diretivas CSP em GET e POST,
  sem alterar a configuração do Helmet.
- As respostas HTML e os handlers de GET, PUT e DELETE foram preservados.

Comandos executados:

- npm test -- --runInBand --no-cache
- npm run test:coverage -- --runInBand --no-cache --coverageReporters=text

Resultados:

- Duas suítes e 37 testes aprovados em cada execução.
- Cobertura: 69,56% de linhas/instruções, 50% de ramificações
  e 83,33% de funções.
- Nenhuma dependência adicionada e nenhum arquivo de cobertura criado.
- Nenhum arquivo fora do escopo foi modificado.

Dificuldades: nenhuma falha nos testes. A conferência final identificou
e corrigiu uma quebra de linha acrescentada automaticamente em main.js.

Limitações: os testes verificam ausência de reflexão nos casos exercitados
e a política enviada nos cabeçalhos. Não executam scripts em navegador
nem demonstram ausência de todas as vulnerabilidades XSS.
O caminho de inicialização do servidor permanece sem cobertura.

## 5. Implementação inicial da API Cody

- Modificado core/cody.js e criado tests/cody.test.js.
- Implementada a fábrica CommonJS createCody(app), que fornece
  addRouter(caminho, objetoDeRotas).
- O contrato aceita GET, POST, PUT e DELETE, com handler obrigatório
  e schema opcional no formato do Fastify.
- Todas as definições são validadas antes do primeiro registro.
- Rotas são registradas diretamente com app.route(), sem prefixo
  automático e sem tabela global de roteamento.
- Conflitos são consultados com app.hasRoute(), incluindo rotas do
  núcleo, padrões parametrizados equivalentes e HEAD preexistente.
- HEAD automático foi preservado.
- Acrescentada guarda local em onReady para impedir registros após
  a inicialização. Falhas de registro preservam a causa e interrompem
  novas tentativas pela mesma interface, sem rollback.
- Preservados os 37 testes existentes e acrescentados 80 casos.

Dificuldade encontrada:

- A primeira execução apresentou 113 testes aprovados e um reprovado:
  após ready(), o Fastify retornou AVV_ERR_ROOT_PLG_BOOTED em vez do
  código esperado. A guarda local passou a rejeitar a chamada antes
  da tentativa de registro.

Comandos de verificação:

- npm test -- --runInBand --no-cache
- npm run test:coverage -- --runInBand --no-cache --coverageReporters=text

Resultados finais:

- Três suítes e 117 testes aprovados em ambas as execuções.
- Cody: 100% de linhas, instruções, funções e ramificações.
- Total: 90,54% de linhas, 90,78% de instruções, 90,90% de funções
  e 98,27% de ramificações.
- Nenhuma dependência adicionada ou artefato de cobertura criado.
- Verificação por hashes confirmou a preservação dos demais arquivos.

Limitações e pendências:

- Integração com main.js, carregador e setup(config) ainda não realizada.
- Contrato limitado a caminhos estáticos e parâmetros simples.
- Não há rollback; aplicações com falha de inicialização devem ser
  descartadas.
- Testes utilizaram app.inject(), sem servidor HTTP de rede.
- O aviso de VM Modules experimental permanece esperado.

## 6. Carregador de plugins com testes isolados

- Criados core/plugin-loader.js e tests/plugin-loader.test.js.
- Nenhum arquivo existente foi modificado, conforme comparação por hashes.
- Implementadas descoberta em subpastas imediatas, validação estrita de
  manifestos e seleção numérica da maior versão por ID.
- Duplicações exatas de ID e versão são rejeitadas.
- Todos os candidatos são validados antes de qualquer módulo ser carregado.
- Somente versões selecionadas são carregadas; todas as exportações setup
  são verificadas antes de iniciar os setups.
- Setups síncronos e assíncronos são aguardados sequencialmente por ID,
  recebendo config.cody.
- Implementadas verificações lexicais e físicas de caminhos, incluindo
  escapes por links simbólicos.
- Falhas preservam cause e interrompem o processamento, sem fallback
  ou rollback.

Fastify e ciclo de vida:

- Confirmada compatibilidade entre carregador assíncrono, encapsulamento
  nativo, segurança global e guarda onReady do Cody.
- A primeira execução apresentou 191 testes aprovados e um reprovado:
  uma chamada direta tardia ainda permitia executar o carregador.
- Acrescentada verificação pelo ciclo de bootstrap usando app.after()
  antes das leituras e importações. O Cody permaneceu inalterado.
- Confirmado isolamento entre aplicações, preservando o cache CommonJS
  e criando estado independente dentro dos setups.

Verificações finais:

- npm test -- --runInBand --no-cache
- npm run test:coverage -- --runInBand --no-cache --coverageReporters=text
- Quatro suítes e 193 testes aprovados em ambas as execuções.
- Preservados os 117 testes anteriores; acrescentados 76 casos.
- Carregador: 100% de linhas, instruções e funções; 94,52% de ramificações.
- Total: 95,70% de linhas, 95,97% de instruções, 96,15% de funções
  e 96,18% de ramificações.
- Diretórios temporários removidos; nenhum artefato de cobertura criado.
- Nenhuma dependência adicionada ou servidor de rede iniciado.

Limitações e pendências:

- Sem integração ao main.js e sem plugin experimental real.
- Imports seguem convenção e revisão de código, sem sandbox.
- Integração do bootstrap, tratamento de falhas e documentação dependem
  de autorização posterior.

## 7. Primeiro plugin experimental

- Substituído Plugins/Plugin01/manifest.json por JSON válido com
  id experimental, versão 1.0.0 e entrada main.js.
- Implementado setup(config) em CommonJS.
- O setup utiliza config.cody.addRouter() para registrar
  GET /experimental/status.
- A resposta JSON contém plugin experimental, status ativo
  e version 1.0.0.
- O plugin não importa bibliotecas ou arquivos do núcleo, não mantém
  estado global compartilhado e não registra rotas durante a importação.
- Criado tests/experimental-plugin.test.js com 11 casos.
- Verificados carregamento pelo loader, Helmet, preservação das quatro
  rotas demonstrativas, independência entre aplicações e funcionamento
  sem disponibilizar require ao módulo.
- Os 193 testes anteriores permaneceram inalterados.

Comandos executados:

- npm test -- --runInBand --no-cache
- npm run test:coverage -- --runInBand --no-cache --coverageReporters=text

Resultados:

- Cinco suítes e 204 testes aprovados em ambas as execuções.
- Plugin: 100% de linhas, instruções, funções e ramificações.
- Total: 95,78% de linhas, 96,04% de instruções, 96,42% de funções
  e 96,18% de ramificações.
- Nenhuma dependência adicionada ou artefato de cobertura criado.
- Conferência por hashes confirmou alterações somente nos três
  arquivos autorizados.

Dificuldades: nenhuma falha nos testes; aviso esperado de VM Modules
experimental.

Pendência: integrar o carregador ao bootstrap mediante autorização.
core/main.js permanece inalterado; npm start ainda não ativa o plugin.

## 8. Integração dos plugins ao bootstrap

- Modificado core/main.js e criado tests/bootstrap-plugins.test.js.
- buildApp() permanece síncrona e mantém plugins desativados quando
  chamada sem argumentos.
- Acrescentado buildApp({ pluginsDir }), que registra o carregador existente.
- start() ativa Plugins/ usando path.resolve() e \_\_dirname.
- app.ready() conclui carregamento e setups antes da tentativa de listen().
- Preservados host 127.0.0.1, porta 3000 e as quatro rotas demonstrativas.
- start foi exportada para permitir testes sem abertura de rede.
- Falhas apresentam diagnóstico, aguardam app.close() e propagam o erro
  original. Falhas de encerramento não substituem a causa inicial.
- A execução direta define process.exitCode = 1 após falha tratada.
- Confirmada compatibilidade com encapsulamento, guarda onReady do Cody
  e verificação de ciclo de vida do carregador.
- Confirmado que módulos e setups não executam a cada requisição.

Verificações executadas:

- npm test -- --runInBand --no-cache
- npm run test:coverage -- --runInBand --no-cache --coverageReporters=text

Resultados:

- Seis suítes e 225 testes aprovados em ambas as execuções.
- Preservados os 204 testes anteriores; acrescentados 21 casos.
- Cobertura total: 98,85% de linhas, 98,92% de instruções,
  96,55% de funções e 96,26% de ramificações.
- Nenhum servidor de rede iniciado ou artefato de cobertura criado.
- Diretórios temporários removidos.
- Conferência por hashes confirmou alterações somente nos dois arquivos
  autorizados.

Dificuldades: nenhuma falha nos testes; aviso esperado de VM Modules
experimental.

Limitações: listen foi substituído nos testes de start(). Conexão HTTP
real e disponibilidade da porta não foram verificadas. O trecho de
execução direta que define process.exitCode permanece sem cobertura.

Verificação manual proposta: executar npm start e consultar
GET http://127.0.0.1:3000/experimental/status, encerrando com Ctrl+C.
Essa verificação manual não foi executada nesta etapa.

## Atualização do README após a Etapa 6B

- Arquivo modificado: README.md.
- Organizada a documentação em 16 seções, conforme o código atual.
- Documentados bootstrap, carregador, Cody, plugin experimental,
  contratos, segurança, falhas e limitações.
- Incluídos exemplos de manifesto, setup, rotas e comandos de uso.
- Preservados os resultados da última execução registrada:
  6 suítes, 225 testes aprovados e 98,85% de cobertura de linhas.
- Verificação: leitura dos arquivos e suítes, conferência das seções
  e comparação de hashes dos demais arquivos, sem diferenças.
- Testes e verificação HTTP manual não foram executados nesta atualização.
- Nenhuma dependência foi alterada; docs/semana02.md permaneceu intacto.
- Pendências: instalação limpa, verificação HTTP manual e documentação
  de futuras evoluções aprovadas.

## Dificuldades pessoais

Bom, como estou testando o desenvolvimento de software integrado com agentes de IA, não tive muita dificuldade de orquestrar a ferramenta e ir conferindo o que foi sendo feito. Porém, nessa semana não tive tempo para revisar todo o código feito pelo agente, apesar disso, todos os testes passaram.
