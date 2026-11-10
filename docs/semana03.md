# Semana 03 — Estruturação inicial do sistema de Plugins 10/11/26

## 01. Renderização HTML controlada pelo núcleo

- Atividade: implementação da opção facultativa `template` no Cody,
  preservando os handlers existentes sem template.
- Arquivos modificados: core/cody.js, core/main.js,
  Plugins/Plugin01/main.js, tests/cody.test.js e
  tests/experimental-plugin.test.js.
- Arquivos criados: core/page-renderer.js, core/public-assets.js,
  templates/experimental.html, public/css/app.css,
  tests/pages.test.js e tests/public-assets.test.js.
- Decisões técnicas: template experimental autorizado explicitamente,
  somente GET, dados com titulo e mensagem, escape de cinco caracteres
  HTML e substituição em passagem única.
- Recursos públicos: publicação exclusiva do CSS autorizado, com
  validação de arquivo regular e confinamento do caminho real.
- Dificuldade: o Jest executava um getter ao formatar um caso
  parametrizado. O caso foi separado para verificar sua rejeição
  sem execução pelo renderizador.
- Testes executados:
  `npm test -- --runInBand --no-cache`
  `npm run test:coverage -- --runInBand --no-cache --coverageReporters=text`
- Resultados: 274 testes aprovados em 8 suítes; cobertura global de
  99,17% das instruções, 97% das ramificações, 97,56% das funções
  e 99,12% das linhas.
- Compatibilidade: JSON experimental e rotas anteriores preservados.
  Nenhuma dependência adicionada e nenhum servidor de rede iniciado
  durante os testes.
- Pendências: inspeção manual no navegador e coleção Bruno.
- Limitação: os testes não demonstram ausência de todas as vulnerabilidades.

## 02. Revisão do README

- Atividade: atualização do README conforme o código e os testes existentes.
- Arquivo modificado: README.md.
- Decisões: preservar a arquitetura anterior e documentar HTML, templates,
  CSS autorizado, rotas experimentais e coleção Bruno.
- Divergência encontrada: coleção Bruno presente, mas ainda indicada como
  pendência no diário; documentada sua existência sem afirmar execução.
- Verificação: revisão documental e `git diff --check -- README.md`,
  sem problemas de espaçamento.
- Testes: Jest não reexecutado; números apresentados como resultados
  da última execução registrada.
- Pendências: verificação manual no navegador e execução da coleção Bruno.

## Considerações pessoais

Achei essa semana mais tranquila, e gostei de entender como as rotas e endpoints que fiz anteriormente se conectam com as páginas em html. Achei fácil de entender mas ainda preciso revisar o processo as partes anteriores.
