AGENTS.md — LAB-AIEDU

1. Contexto do projeto

O LAB-AIEDU é um projeto acadêmico de pesquisa e desenvolvimento de uma plataforma extensível baseada em Learning Analytics e Inteligência Artificial.

O backend será desenvolvido inicialmente com Node.js, Fastify e Jest, utilizando uma arquitetura modular orientada a plugins.

O projeto está em fase de prototipação. As implementações devem priorizar simplicidade, clareza, testabilidade e possibilidade de evolução.

2. Tecnologias e restrições

Tecnologias atualmente utilizadas:

Node.js 24;

JavaScript com CommonJS;

Fastify 5;

@fastify/helmet;

Jest 30;

JSON Schema e Ajv, integrados ao Fastify.

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

core/main.js

Responsável por construir e inicializar a aplicação Fastify.

Deve preservar a separação entre a função buildApp() e a inicialização do servidor HTTP.

A integração com o sistema de plugins deverá ser planejada de modo a evitar concentração excessiva de responsabilidades.

core/cody.js

Será responsável por disponibilizar uma interface controlada entre o núcleo da aplicação e os plugins.

A API deverá permitir o registro de rotas, inicialmente por meio de uma operação denominada addRouter().

O contrato definitivo de addRouter() ainda precisa ser aprovado.

Evitar estado global compartilhado entre diferentes instâncias da aplicação.

Sistema de plugins

Os plugins ficarão no diretório Plugins/.

O sistema deverá:

Descobrir os plugins disponíveis.

Ler e validar seus arquivos de configuração.

Identificar cada plugin por ID e versão.

Selecionar a versão mais recente de cada ID.

Executar somente os plugins selecionados.

Exigir uma função exportada setup(config).

Disponibilizar o objeto Cody por meio da configuração recebida por setup().

O formato definitivo do manifesto, a política de erros e a convenção de rotas devem ser definidos antes da implementação.

Inicialmente, apenas um plugin experimental deverá ser desenvolvido.

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

As rotas adicionadas por plugins deverão respeitar as políticas globais de segurança.

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

Preservar os oito testes existentes.

Criar testes proporcionais às funcionalidades implementadas.

Verificar casos válidos, inválidos, limites e falhas relevantes.

A execução atual dos testes pode exigir NODE_OPTIONS=--experimental-vm-modules.

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

Após cada alteração autorizada, fornecer obrigatoriamente um bloco Markdown pronto para ser acrescentado ao arquivo docs/semana02.md.

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

Não modificar automaticamente docs/semana02.md sem autorização expressa.

Preservar o conteúdo já existente no documento, evitando duplicações.

9. Comunicação e aprovação

Distinguir claramente:

Requisitos definidos pelo orientador;

Decisões aprovadas pelo usuário;

Recomendações técnicas;

Hipóteses ainda não verificadas.

Quando houver alternativas relevantes, apresentar vantagens, limitações e impactos antes de escolher.

Priorizar soluções simples, compreensíveis e adequadas ao estágio acadêmico do projeto.
