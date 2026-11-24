# Semana 04 — Sanitização de HTML e segurança na apresentação de plugins 10/11/26

## 1. Objetivo da semana

Implementar um mecanismo de sanitização de HTML no núcleo do LAB-AIEDU, permitindo que desenvolvedores de plugins forneçam conteúdos HTML próprios para apresentação na plataforma, com aplicação de regras de segurança antes da renderização no navegador.

A implementação será realizada de forma incremental, iniciando pela criação de uma função independente de sanitização, seguida de testes unitários e, posteriormente, da integração com a API do Cody.

## 2. Estudo e planejamento da arquitetura

Inicialmente, foi realizada uma análise da arquitetura existente com auxílio do Codex, utilizado exclusivamente para inspeção e revisão do código, sem realizar alterações automáticas.

Foram analisados os módulos responsáveis pelo carregamento de plugins, registro de rotas, renderização de páginas e disponibilização de recursos estáticos.

Durante essa análise, foram identificadas as seguintes responsabilidades:

plugin-loader.js: descoberta, validação e inicialização dos plugins, disponibilizando a interface do Cody.

cody.js: gerenciamento do registro das rotas e integração dos handlers dos plugins ao Fastify.

render.js: renderização de conteúdo HTML a partir do mecanismo de templates existente.

public-assets.js: disponibilização de recursos estáticos autorizados, como arquivos CSS.

Foi definida uma proposta de arquitetura na qual a sanitização do HTML será independente do servidor HTTP, permitindo testar a função sem inicializar o Fastify.

Também foi adotada a nomenclatura cody.newPage().out(html) para a futura interface de apresentação de páginas. Essa funcionalidade ainda não foi implementada.

## 3. Correção de referência entre módulos

Durante a análise, foi identificada uma inconsistência na importação do módulo responsável pela renderização.

O arquivo havia sido renomeado de page-renderer.js para render.js, porém cody.js continuava utilizando a referência antiga.

Essa inconsistência impedia o carregamento dos módulos e ocasionava falha nas oito suítes de testes existentes.

A referência foi corrigida para:

const { validateTemplate, createPageRenderer } = require('./render');

A correção foi registrada no controle de versão.

## 4. Estudo sobre segurança e sanitização HTML

Foram estudados conceitos relacionados à vulnerabilidade Cross-Site Scripting (XSS), caracterizada pela possibilidade de execução de código não confiável no navegador.

Foram discutidos exemplos de conteúdo potencialmente perigoso, incluindo tags <script>, atributos de eventos como onclick e onerror, além de elementos HTML capazes de introduzir comportamentos indesejados.

Foi definida a utilização de uma política baseada em listas de permissões (allowlist), na qual apenas elementos HTML previamente autorizados poderão permanecer no conteúdo sanitizado.

Também foi identificada uma limitação importante: a sanitização de HTML não impede que um plugin JavaScript malicioso execute código no processo Node.js. A necessidade de mecanismos adicionais de isolamento e segurança será discutida futuramente com a equipe.

## 5. Implementação inicial do sanitizador

Foi selecionada a biblioteca sanitize-html, versão 2.18.2, compatível com o ambiente Node.js utilizado no projeto.

Foi criado o módulo:

core/html-sanitizer.js

Nesse arquivo, foi implementada a função sanitizeHtml(html), responsável por:

Receber conteúdo HTML no formato de string.

Validar o tipo da entrada.

Rejeitar valores incompatíveis por meio de TypeError.

Aplicar uma política de tags e atributos permitidos.

Retornar o conteúdo sanitizado.

A política inicial permite elementos estruturais e de formatação, como títulos, parágrafos, listas e tabelas.

Inicialmente, nenhum atributo HTML fornecido pelo plugin é autorizado, utilizando a configuração allowedAttributes: {}.

Elementos como scripts, estilos, formulários e recursos incorporados não fazem parte da lista de permissões desta etapa.

O módulo utiliza CommonJS, com require() para importar a biblioteca e module.exports para disponibilizar a função aos demais módulos da aplicação.

## 6. Testes unitários com Jest

Foi criado o arquivo:

tests/html-sanitizer.test.js

Foram implementados dois testes unitários iniciais:

Preservação de tags HTML permitidas: verifica se títulos e parágrafos autorizados permanecem inalterados após a sanitização.

Remoção de scripts: verifica se elementos <script> e seu conteúdo são removidos, preservando os elementos permitidos.

Os testes foram executados utilizando o Jest, sem necessidade de inicializar o servidor HTTP.

O resultado da execução específica foi:

1 suíte de testes aprovada.

2 testes aprovados.

Nenhuma falha.

Também foi realizada a execução completa dos testes existentes no projeto, com aprovação de todas as suítes.

## 7. Conhecimentos adquiridos

Durante as atividades, foram estudados e aplicados conceitos fundamentais de JavaScript e desenvolvimento de software:

Declaração de variáveis com const.

Manipulação de strings.

Declaração de funções, parâmetros e return.

Validação de tipos utilizando typeof.

Estruturas condicionais com if.

Lançamento de exceções com throw new TypeError().

Objetos e arrays.

Importação e exportação de módulos CommonJS.

Utilização de bibliotecas externas com npm.

Estruturação de testes unitários com describe(), test(), expect() e toBe().

Organização modular e separação de responsabilidades.

Controle de versão com Git e commits incrementais.

## 8. Resultados parciais

Até o momento, foi implementada uma primeira versão funcional e independente do sanitizador HTML, com uma política restritiva de elementos permitidos.

Os testes iniciais demonstraram a preservação de elementos autorizados e a remoção de scripts nos casos avaliados.

A implementação ainda não foi integrada ao Cody ou ao mecanismo de renderização HTTP.

## 9. Próximas atividades

As próximas etapas previstas são:

Ampliar os testes unitários para atributos perigosos, entradas inválidas e HTML malformado.

Verificar o tratamento de documentos HTML completos.

Definir limites para o tamanho do conteúdo recebido.

Implementar a interface cody.newPage().out(html).

Integrar a sanitização ao fluxo de renderização do núcleo.

Realizar testes de integração com o Fastify.

Documentar as regras de utilização, as proteções implementadas e suas limitações de segurança.

Situação da atividade: em desenvolvimento, com a implementação inicial do sanitizador concluída e os primeiros testes unitários aprovados.

## 10. Fechamento técnico — 24/11/2026

### Objetivo e mudança de abordagem

A Semana 04 consolidou a apresentação de páginas dos plugins e o controle
das respostas HTTP pelo núcleo. A implementação começou sobre a estrutura
da Semana 03, em que um template lia os campos `titulo` e `mensagem` e os
interpolava em posições fixas. As seções anteriores registram esse período,
incluindo a transição entre os módulos de renderização.

A equipe passou a precisar de marcação mais flexível, mantendo o controle
sobre o documento servido. A abordagem adotada permite ao plugin fornecer
um fragmento HTML. O núcleo aplica uma política de permissões e monta o
documento, retirando a interpolação e a dependência dos arquivos de template.

### Sanitização e documento externo

`core/html-sanitizer.js` usa o parser de `sanitize-html` para preservar
somente as tags autorizadas, remover atributos e limitar o fragmento a
100.000 unidades UTF-16. `core/render.js` recebe o HTML, chama o sanitizador
e insere o fragmento resultante no `body` do documento padrão com título
`LAB-AIEDU`.

Na correção final, `nonTextTags` passou a descartar também o conteúdo de
`head` e `title`, preservando os padrões `script`, `style`, `textarea`,
`option` e `xmp`. Remover apenas as tags deixava texto do cabeçalho de
entrada chegar ao corpo. A política final descarta os trechos que o parser
classifica dentro dessas regiões, inclusive em marcação incompleta, e
preserva o conteúdo permitido do corpo quando o parser reconhece a transição.

### Contrato dos plugins e controle das respostas

Os handlers recebem um único objeto com `params`, `query`, `body`,
`headers` e `method`, após o Fastify validar a entrada. `structuredClone()`
copia objetos e arrays aninhados, para que mutações locais não se propaguem
à requisição original. O Cody chama o handler sem o vínculo do Fastify e
mantém `request` e `reply` no núcleo.

```javascript
cody.addRouter('/resumo', {
    GET: { handler: () => cody.newPage().out('<h1>Resumo</h1>') }
});

cody.addRouter('/registros', {
    POST: { handler: () => cody.json({ criado: true }, { status: 201 }) }
});
```

Cada operação declarativa devolve um objeto cuja identidade é registrada
num `WeakMap` privado da fachada. Copiar esse objeto remove o reconhecimento
como página ou resposta com status especial. Páginas são aceitas em GET
registrado sem schema de resposta, incluindo o HEAD automático. O Cody
valida retornos JSON em profundidade, rejeita ciclos, acessores e tipos
especiais e mantém strings comuns sem schema como texto simples. Quando
a saída é JSON, o status e o tipo de mídia orientam a escolha do schema de
resposta, que pode filtrar propriedades. O handler recebe `HEAD` como método
efetivo e o Fastify suprime o corpo.

Como defesa complementar, o Cody marca em um `WeakSet` as requisições cujo
HTML foi renderizado. Seu `onSend` local troca HTML sem essa marca por
HTTP 500 genérico. Os erros internos usam um corpo JSON fixo preparado pelo
núcleo. Os erros nativos de Ajv, parsing e limite de corpo seguem pelo Fastify.

Na Etapa 5B, a preparação da resposta foi separada do diagnóstico. Obter e
registrar uma mensagem é uma tentativa protegida. Para objetos, o código
só considera uma mensagem própria de dados que seja string. Primitivos
podem ser descritos diretamente. Proxies e acessores ficam fora da leitura.
Uma exceção de `console.error` deixa o envelope HTTP intacto. A outra
correção do Cody passou a validar as opções de `cody.json()` antes de ler
`status`. Somente um campo próprio, enumerável e de dados com esse nome
é permitido. As opções ausentes e o valor `undefined` mantêm o padrão 200.

### Migração, limpeza e verificação

Os testes de interpolação, arquivos de template e receivers nativos deram
lugar a regressões do contrato vigente. A ampliação cobriu cópia profunda,
identidade declarativa, serialização, schemas, formatos de erro, sanitização,
proteção de MIME e HEAD. O template legado foi removido na Etapa 4B. Os
casos de rejeição da opção `template` e do endereço legado continuam
cobrindo a descontinuação. O ativo CSS público conserva sua rota própria.
Na Etapa 5B, a cobertura também passou a verificar HTTP 404 para
`/package.json` e `/core/main.js`.

| Marco | Resultado observado no Jest |
| --- | --- |
| Situação inicial da migração | 249 aprovados e 36 reprovados |
| Etapa 1B, após a alteração do contrato | 247 aprovados e 38 reprovados |
| Etapa 2B, após a migração | 269 aprovados em 9 suítes |
| Etapa 3B, após a ampliação | 349 aprovados em 9 suítes |
| Etapa 5B, após as correções finais | 391 aprovados em 9 suítes |

Na Etapa 5B, as quatro suítes afetadas passaram com 246 testes. A suíte
completa passou com `npm test -- --runInBand --no-cache` e com a variante
`--detectOpenHandles`. Ambas retornaram código 0, e o Jest não apontou
recursos abertos. Também passaram 16 verificações com `app.inject()` após
`ready()`, incluindo os exemplos do README, as rotas experimentais,
HEAD, CSS público, erros nativos e o erro genérico quando o diagnóstico
lança. As verificações foram executadas em memória, sem escuta de rede.

### Aprendizados, limites e próximos passos

A composição do documento e a sanitização têm responsabilidades distintas.
Os descritores de propriedades permitem distinguir dados de acessores,
enquanto a identidade do objeto permite controlar o resultado sem confiar
em campos que o plugin poderia copiar. Manter o corpo de erro separado do
diagnóstico torna a resposta previsível mesmo quando a emissão do log falha.

Os plugins CommonJS continuam no mesmo processo Node.js que o núcleo.
A proteção do contrato HTTP não oferece sandbox. Objetos e arrays de
outros contextos são rejeitados. Limites próprios de JSON de saída,
respostas binárias, streams e cabeçalhos personalizados seguem fora do
escopo. A auditoria apontou por leitura riscos separados no diagnóstico
de `start()` e na contextualização de erros do carregador, sem reproduzi-los.

A execução manual no Bruno e a revisão visual no navegador permanecem
pendentes. Devem ser registradas após sua realização, separadamente dos
resultados automatizados desta semana.
