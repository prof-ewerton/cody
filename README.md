# LAB-AIEDU — Backend

## 1. Apresentação do LAB-AIEDU

O LAB-AIEDU é um projeto acadêmico de pesquisa e desenvolvimento de uma
plataforma extensível voltada a Learning Analytics e Inteligência Artificial.
O projeto está em prototipação. Este documento descreve o backend no encerramento documental da Semana 03.

## 2. Objetivo do backend e da arquitetura de plugins

O backend fornece um núcleo HTTP e uma arquitetura modular para incorporar
funcionalidades desenvolvidas pela equipe por meio de plugins. Nesta etapa,
as rotas do núcleo são demonstrativas e um único plugin experimental valida
a descoberta, a seleção de versões e o registro de rotas pela interface Cody.

`core/main.js` constrói e inicializa a aplicação; `core/plugin-loader.js`
descobre e carrega plugins; `core/cody.js` fornece a interface controlada
de registro de rotas, sem tabela global compartilhada entre aplicações.

## 3. Tecnologias utilizadas

- Node.js 24 e JavaScript com CommonJS.
- Fastify 5 e `@fastify/helmet`.
- Jest 30.
- JSON Schema e Ajv integrados ao Fastify para validação das rotas.
- Módulos nativos do Node.js para arquivos e caminhos no carregador.

O manifesto possui validação própria no carregador, sem Ajv.

## 4. Estrutura atual de diretórios

```text
Backend/
├── AGENTS.md
├── README.md
├── package.json
├── package-lock.json
├── core/
│   ├── main.js
│   ├── cody.js
│   ├── plugin-loader.js
│   ├── page-renderer.js
│   └── public-assets.js
├── Plugins/
│   ├── Plugin01/
│   │   ├── manifest.json
│   │   └── main.js
│   └── Plugin02/                  # vazio; ignorado pelo carregador
├── templates/
│   └── experimental.html
├── public/
│   └── css/
│       └── app.css
├── tests/
│   ├── core.test.js
│   ├── security.test.js
│   ├── cody.test.js
│   ├── plugin-loader.test.js
│   ├── experimental-plugin.test.js
│   ├── bootstrap-plugins.test.js
│   ├── pages.test.js
│   ├── public-assets.test.js
│   └── integrations/
│       └── LAB-AIEDU/              # coleção Bruno (OpenCollection YAML)
├── docs/                          # registros e documentos acadêmicos
└── node_modules/                  # dependências locais após instalação
```

## 5. Pré-requisitos e instalação

Utilize Node.js 24 e npm. Ambiente anteriormente verificado:

- Node.js `24.20.0` e npm `11.19.0`.
- Fastify `5.12.7`, `@fastify/helmet` `13.2.0` e Jest `30.5.2` instalados.

Na raiz de `Backend/`, para instalar as dependências do lockfile:

```bash
npm ci
```

Esse comando é uma instrução de instalação; instalação limpa não foi testada
nesta atualização documental. Os comandos seguintes pressupõem dependências
instaladas. Outras versões de ambiente não foram validadas no registro citado.

## 6. Como executar o servidor

Na raiz de `Backend/`:

```bash
npm start
```

O script executa `core/main.js`, ativa a pasta `Plugins/` do projeto e inicia
o servidor em `http://127.0.0.1:3000`, acessível pela máquina local.
Para desenvolvimento com reinicialização do processo ao alterar arquivos:

```bash
npm run dev
```

Encerre com `Ctrl+C`. A reinicialização por `node --watch` não constitui
hot reload de plugins dentro da aplicação em execução.

`buildApp()` é síncrona, retorna uma instância Fastify e não abre uma porta.
Sem argumentos (ou com `{}`), não ativa plugins.
`buildApp({ pluginsDir })` registra o carregador quando `pluginsDir` é
diferente de `undefined`; o carregador exige um caminho absoluto válido.
Importar `core/main.js` não inicia o servidor automaticamente.

`start()` resolve `Plugins/` a partir do próprio arquivo, aguarda `app.ready()`
e somente depois chama `app.listen()`. Assim, os setups assíncronos terminam
antes de o servidor começar a escutar.

## 7. Rotas demonstrativas do núcleo

| Método e caminho | Comportamento |
| --- | --- |
| `GET /` | Retorna HTML estático indicando que o backend está funcionando. |
| `POST /` | Valida o corpo e retorna HTML estático de recebimento. |
| `PUT /` | Retorna HTML estático de solicitação de atualização. |
| `DELETE /` | Retorna HTML estático de solicitação de exclusão. |

As respostas bem-sucedidas usam HTTP 200. Essas operações não persistem,
atualizam nem excluem dados.

O `POST /` exige um objeto com apenas `nome`, uma string de 1 a 100 caracteres.
Tipos incorretos, campo ausente e propriedades adicionais são rejeitados com
HTTP 400. Não há remoção de espaços nem exigência de texto não branco.
O valor de `nome` não é inserido no HTML retornado.

Com o servidor iniciado, exemplos de consulta:

```bash
curl -i http://127.0.0.1:3000/
curl -i -X POST http://127.0.0.1:3000/ \
  -H 'Content-Type: application/json' \
  -d '{"nome":"Atividade de Learning Analytics"}'
```

## 8. Plugin experimental: status JSON e página HTML

`Plugins/Plugin01/` contém o plugin de ID `experimental`, versão `1.0.0`.
Seu setup registra `GET /experimental/status`, que retorna HTTP 200 e JSON:

```json
{"plugin":"experimental","status":"ativo","version":"1.0.0"}
```

Após executar `npm start`, consulte com:

```bash
curl -i http://127.0.0.1:3000/experimental/status
```

O mesmo setup registra `GET /experimental/pagina`, que retorna HTTP 200 e
`text/html; charset=utf-8`, com o título “Plugin experimental” e a mensagem
“Plugin ativo no LAB-AIEDU.”. A página inclui o CSS do núcleo e um link para
o status em JSON, cujo contrato permanece preservado.

```bash
curl -i http://127.0.0.1:3000/experimental/pagina
curl -i http://127.0.0.1:3000/public/css/app.css
```

No navegador, abra `http://127.0.0.1:3000/experimental/pagina` para visualizar
a página ou `http://127.0.0.1:3000/experimental/status` para consultar o JSON.
As duas rotas do plugin ficam ausentes com `buildApp()` sem carregador.
Os comandos são exemplos de uso; nenhuma verificação HTTP manual foi realizada
nesta atualização documental.

## 9. Arquitetura e fluxo de carregamento dos plugins

1. O carregador verifica o ciclo de inicialização e cria uma interface Cody
   associada à instância Fastify de seu escopo.
2. Descobre subdiretórios imediatos da pasta configurada, sem busca recursiva.
   Arquivos comuns na raiz e diretórios vazios são ignorados. Links simbólicos
   na raiz são rejeitados.
3. Lê `manifest.json` e valida os metadados e caminhos de todos os candidatos,
   inclusive versões que depois seriam descartadas. Diretório não vazio sem
   manifesto, JSON malformado ou manifesto inválido interrompe a inicialização.
4. Seleciona a maior versão numérica de cada ID, comparando major, minor e patch.
   Duplicações exatas de ID e versão são rejeitadas, mesmo em versões antigas.
5. Carrega somente os módulos selecionados por `require()` e verifica todas
   as exportações `setup` antes de iniciar o primeiro setup.
6. Executa os setups sequencialmente, em ordem de ID, com `await`, passando
   `{ cody }`. Só após o bootstrap `start()` tenta abrir a porta.

Módulos e setups não executam a cada requisição. O cache CommonJS é preservado;
o setup é executado para cada aplicação. Estado específico de uma aplicação
deve ser criado dentro do setup, evitando estado global no módulo.

## 10. Como desenvolver um novo plugin

O procedimento descreve o contrato existente para desenvolvimento futuro;
a etapa atual mantém apenas um plugin experimental.

1. Crie uma subpasta imediata em `Plugins/` com um `manifest.json` válido.
2. Crie o módulo CommonJS indicado em `entry`, exportando `{ setup }`.
3. Registre as rotas dentro de `setup(config)`, usando `config.cody`.
4. Escolha caminhos sem conflitos e declare schemas para entradas recebidas.
5. Verifique o plugin com Jest e `app.inject()`, incluindo falhas relevantes,
   e reinicie o processo para carregar alterações.

O nome da pasta não determina o ID nem a versão: eles vêm do manifesto.
Não importe bibliotecas externas por `require()` ou `import` nos plugins.
Essa é uma convenção de desenvolvimento da equipe, não um bloqueio automático
do Node.js. O carregador não oferece sandbox.

## 11. Contrato de manifest.json

Exemplo real de `Plugins/Plugin01/manifest.json`:

```json
{
  "id": "experimental",
  "version": "1.0.0",
  "entry": "main.js"
}
```

O objeto JSON deve conter **exatamente** estes três campos:

| Campo | Regra |
| --- | --- |
| `id` | String iniciada por letra ASCII minúscula, seguida apenas de letras ASCII minúsculas, números ou hífens; sem espaços. |
| `version` | String `major.minor.patch`, com inteiros não negativos seguros, sem zeros à esquerda, prefixos, pré-lançamentos ou metadados de build. |
| `entry` | Caminho relativo para arquivo regular `.js` ou `.cjs` dentro da pasta do plugin; pode apontar para subpasta. |

Em `entry`, não são aceitos caminhos absolutos, segmentos vazios, `.` ou `..`,
barras invertidas, dois-pontos ou caracteres de controle. O carregador verifica
os caminhos resolvidos e reais do manifesto e da entrada: destinos de links
simbólicos que escapem da pasta do plugin são rejeitados. Essas verificações
de caminho não isolam a execução do código do plugin.

## 12. Contrato de setup(config) e config.cody

O módulo deve exportar uma propriedade própria `setup` do tipo função.
O carregador passa um objeto que atualmente contém apenas `cody`; ID, versão
e outros metadados não são repassados em `config`.

Trecho funcional da rota de status do plugin experimental:

```javascript
function setup(config) {
    config.cody.addRouter('/experimental/status', {
        GET: {
            handler: async () => ({
                plugin: 'experimental',
                status: 'ativo',
                version: '1.0.0'
            })
        }
    });
}

module.exports = { setup };
```

O setup pode ser síncrono ou assíncrono. Trabalho assíncrono necessário ao
registro deve ser aguardado dentro do setup ou incluído na Promise retornada:
o carregador aguarda esse resultado. Registre as rotas durante a inicialização;
o Cody encerra o registro em `onReady`.

## 13. API cody.addRouter()

```javascript
cody.addRouter(caminho, objetoDeRotas);
```

- `caminho` começa por `/`. São aceitos `/`, segmentos estáticos com letras,
  números, `.`, `_`, `~` e `-`, e parâmetros simples como `/:id`.
- Parâmetros começam por letra ASCII ou `_` e continuam com letras ASCII,
  números ou `_`; não podem se repetir no mesmo caminho.
- Não são aceitos espaços, controles, segmentos vazios, barra final fora de
  `/`, segmentos `.` e `..`, query string, fragmentos, curingas ou parâmetros
  opcionais/com expressão regular.
- `objetoDeRotas` deve ser um objeto simples não vazio, com chaves `GET`,
  `POST`, `PUT` ou `DELETE`, em maiúsculas.
- Cada definição é um objeto simples com `handler` obrigatório (função) e
  `schema` opcional (objeto simples) e `template` facultativo, conforme o
  contrato HTML abaixo. Outras opções são rejeitadas.

Sem `template`, os handlers usam o formato nativo do Fastify: `(request, reply)`, com acesso a
`request.params`, `request.query` e `request.body`. Podem retornar resultados
em handlers assíncronos ou usar `reply.send()`. Funções tradicionais preservam
o `this` nativo do Fastify. `schema` é encaminhado ao Fastify, incluindo schemas
de corpo, parâmetros, query string e resposta.

Exemplo dentro de um setup, em que `cody` é `config.cody`:

```javascript
cody.addRouter('/exemplo/:id', {
    GET: {
        handler: async (request, reply) => {
            return reply.code(200).send({ id: request.params.id });
        }
    }
});
```

Essa rota é ilustrativa e não faz parte das rotas instaladas no projeto.
Não há prefixo automático. O Cody valida as definições e os conflitos conhecidos
antes de registrar os métodos com `app.route()`, consultando `app.hasRoute()`.
Não sobrescreve rotas do núcleo ou de outros plugins. Preserva o HEAD automático
do Fastify para GET, embora `HEAD` não seja aceito como chave da API; GET também
é recusado diante de HEAD preexistente.

### Renderização HTML com `template`

A opção facultativa `template: 'experimental'` ativa a renderização pelo núcleo.
Inicialmente, ela é aceita somente em `GET`, sem `schema.response`. Schemas de
entrada continuam sendo encaminhados ao Fastify. Qualquer outro identificador
de template, inclusive um caminho de arquivo, é rejeitado no registro.

Exemplo real do registro da página em `Plugins/Plugin01/main.js`:

```javascript
config.cody.addRouter('/experimental/pagina', {
    GET: {
        template: 'experimental',
        handler: async () => ({
            titulo: 'Plugin experimental',
            mensagem: 'Plugin ativo no LAB-AIEDU.'
        })
    }
});
```

Diferentemente do handler tradicional `(request, reply)`, o handler com template
recebe apenas `request`, sem `reply` nem o `this` nativo do Fastify. Deve retornar,
sincronamente ou por Promise, um objeto simples com **exatamente** dois campos
próprios: `titulo` e `mensagem`, ambos strings. São aceitas strings vazias e
Unicode; não há limite de tamanho definido nesse contrato. Objetos sem protótipo
são aceitos; campos herdados, getters, valores de outros tipos e campos extras
são rejeitados. O plugin fornece dados; o núcleo monta e envia a resposta HTML.
Erros do handler ou dados inválidos resultam em HTTP 500 com JSON genérico,
sem expor a mensagem interna da falha.

### Templates e responsabilidade pela apresentação

`templates/experimental.html` pertence ao núcleo e contém os marcadores fixos
`{{titulo}}` e `{{mensagem}}`, usados no texto de um `<h1>` e de um `<p>`.
O campo `titulo` alimenta o `<h1>`; o `<title>` do documento é fixo.
`core/page-renderer.js` lê o template durante `onReady`, quando o modo HTML é
utilizado, valida o caminho real e exige um arquivo regular no diretório
`templates/`. Ausência ou destino inválido impede a inicialização.
O conteúdo fica em memória e não é relido por requisição.

O renderizador escapa `&`, `<`, `>`, `"` e `'` como `&amp;`, `&lt;`, `&gt;`,
`&quot;` e `&#39;`. A substituição ocorre em passagem única: marcadores contidos
nos dados não são processados novamente, e os valores não são executados como
código. Por exemplo, `<b>Olá</b>` aparece como texto, não como uma tag ativa.

Esse escape atende aos pontos de inserção atuais em texto HTML. Não é um
sanitizador genérico para HTML livre nem uma proteção adequada, por si só,
para inserir dados em JavaScript, CSS, URLs ou outros contextos. Templates
continuam sendo código de apresentação confiável, controlado pela equipe.
Não há seleção arbitrária de arquivos nem mecanismo genérico de templates.

### Recursos públicos autorizados

`public/css/app.css` define a apresentação da página. `core/public-assets.js`
publica exclusivamente `GET /public/css/app.css`, com
`text/css; charset=utf-8`, Helmet e HEAD automático do Fastify. Esse recurso
é registrado também em `buildApp()` sem plugins.

Na inicialização, o núcleo exige um arquivo regular e verifica que seu caminho
real permanece dentro de `public/`, impedindo escape por links simbólicos.
O CSS é lido uma vez e mantido em memória. A URL é fixa e não usa um caminho
fornecido pelo cliente para escolher arquivos. Não há listagem de diretórios
nem suporte genérico a arquivos públicos: `/public/css/outro.css` e
`/templates/experimental.html`, por exemplo, não são publicados e retornam 404.
CSS ausente ou inválido impede a inicialização da aplicação.

## 14. Validação, segurança e tratamento de falhas

- Helmet configura cabeçalhos HTTP de segurança, inclusive nas rotas de plugins.
- O limite global do corpo é de 1.024 bytes; acima dele, a resposta é HTTP 413.
- O Ajv usa `coerceTypes: false` e `removeAdditional: false`: não converte tipos
  nem remove propriedades adicionais automaticamente. Rejeitar propriedades
  adicionais depende de `additionalProperties: false` no schema da rota,
  como ocorre no `POST /`.
- Os schemas dos plugins usam a validação do Fastify. O Cody valida seu formato
  externo; a compilação pode falhar durante o bootstrap.
- As quatro respostas HTML demonstrativas de `/` permanecem estáticas. No
  modo template, o núcleo escapa os dados nos pontos de texto autorizados;
  isso não elimina a necessidade de tratamento adequado em outros contextos.

Os testes incluem ausência de reflexão de marcadores XSS nas rotas anteriores,
escape no template, rejeição de dados inválidos, restrições de arquivos,
cabeçalhos, validação e limites. Não executam scripts em navegador nem demonstram ausência
de todas as vulnerabilidades.

Erros do carregador indicam a fase (ciclo de vida, descoberta, validação,
seleção, carregamento ou setup), o contexto disponível e preservam `cause`.
O processamento para na falha, sem fallback para versão anterior.
No fluxo de `npm start`, falhas de inicialização impedem a abertura do servidor:
`start()` registra o diagnóstico, tenta fechar a aplicação e propaga o erro
original. Na execução direta, a falha resulta em `process.exitCode = 1`.

Não há rollback de registros ou efeitos colaterais dos módulos e setups.
Uma falha do Fastify durante o registro bloqueia novas tentativas pela mesma
interface Cody. Aplicações com falha de inicialização devem ser descartadas.
Plugins executam no processo Node.js, sem sandbox ou isolamento de segurança.

## 15. Como executar os testes e a cobertura

Na raiz de `Backend/`:

```bash
npm test
```

Para execução sequencial sem cache do Jest:

```bash
npm test -- --runInBand --no-cache
```

Para cobertura com relatório somente no terminal:

```bash
npm run test:coverage -- --runInBand --no-cache --coverageReporters=text
```

Sem essas opções, `npm run test:coverage` usa os relatórios padrão do Jest,
que podem gerar arquivos em `coverage/`. As suítes do carregador e do bootstrap
criam fixtures em diretórios temporários e os removem ao final.

As oito suítes cobrem núcleo, segurança, Cody, carregador, plugin experimental,
bootstrap, páginas e recursos públicos. As rotas usam `app.inject()`, sem servidor HTTP de rede.
Nos testes de `start()`, `listen()` é substituído por uma simulação.

O relatório mais recente registrado em [docs/semana03.md](docs/semana03.md)
apresentou **274 testes aprovados em 8 suítes e 99,12% de cobertura global
de linhas**. Esses números correspondem
à última execução registrada e podem mudar conforme o desenvolvimento.
Os testes não foram reexecutados nesta atualização do README.

Os scripts invocam o Jest local com `node --experimental-vm-modules`.
No ambiente anteriormente verificado, essa opção habilita as APIs de módulos
de `node:vm` usadas pelo Jest para carregar a dependência ESM `cookie`, utilizada
por `light-my-request` na execução de `app.inject()`.
O Node pode emitir um aviso experimental. O projeto e os testes permanecem
em CommonJS; os scripts já fornecem a opção, sem necessidade de definir
`NODE_OPTIONS` manualmente. Essa configuração deve ser reavaliada quando
o ambiente ou as dependências forem atualizados.

## 16. Testes manuais com Bruno

A coleção em `tests/integrations/LAB-AIEDU/` contém `opencollection.yml` e
quatro requisições YAML. No Bruno com suporte ao formato OpenCollection,
use a opção de abrir uma coleção (Open Collection) e selecione essa pasta.
O arquivo `opencollection.yml` identifica a coleção como LAB-AIEDU.

Na raiz de `Backend/`, com as dependências instaladas, execute `npm start`
e mantenha o terminal aberto. No Bruno, abra cada requisição e use o comando
de envio (Send). Todas usam URLs completas em `http://127.0.0.1:3000`, sem
necessidade de configurar variáveis de ambiente na coleção.

| Arquivo | Requisição presente | Resultado esperado pelo código |
| --- | --- | --- |
| `01 - Status do Plugin.yml` | `GET /experimental/status` | HTTP 200 e JSON com plugin, status e versão. |
| `02 - Página Experimental.yml` | `GET /experimental/pagina` | HTTP 200 e HTML da página experimental. |
| `03 - POST Válido.yml` | `POST /` com `{"nome":"LAB-AIEDU"}` | HTTP 200 e HTML estático de recebimento. |
| `04 - POST Inválido.yml` | `POST /` com `{"nome":"LAB-AIEDU","idade":20}` | HTTP 400: propriedade adicional não permitida. |

Confira manualmente o status, os cabeçalhos e o corpo retornados. Os arquivos
não contêm scripts de teste nem assertions automatizadas; os resultados acima
são expectativas derivadas do código, não resultados de uma execução Bruno
nesta revisão. A coleção não substitui as suítes Jest. Para conferir a
apresentação e o carregamento do CSS, abra a página no navegador.
Ao terminar, encerre o servidor com `Ctrl+C` no terminal.

Os arquivos da coleção podem ser versionados junto ao projeto no GitHub,
permitindo compartilhar e revisar as requisições. Isso não exige uma integração
automatizada com o GitHub; esta atualização não executa add, commit ou push.

## 17. Estado atual, limitações e próximos passos

A Semana 03 acrescenta renderização HTML controlada pelo núcleo e um recurso
CSS autorizado à arquitetura existente. Cody, seleção de versões, setups
aguardados e construção isolada por `buildApp()` permanecem implementados.
O plugin experimental fornece JSON e HTML, e as quatro rotas demonstrativas
do núcleo permanecem disponíveis.

Não há banco de dados, persistência, sandbox, rollback ou hot reload de plugins.
Não há configuração de Docker, Docker Compose ou GitHub Actions nesta etapa.
A API Cody aceita GET, POST, PUT e DELETE nos formatos descritos; a renderização
HTML aceita somente GET com o template explicitamente autorizado `experimental`.
Não há suporte genérico a arquivos públicos: somente o CSS fixo é publicado.

A instalação limpa, a conexão HTTP real, a disponibilidade da porta e a
execução da coleção Bruno não foram verificadas nesta atualização documental.
Os resultados de Jest e cobertura citados são os registrados no diário.

Próximos passos a avaliar, sujeitos à aprovação de escopo: conferir a página no
navegador, executar as requisições Bruno, reavaliar VM Modules quando necessário
e documentar futuras evoluções dos contratos. Essas possibilidades não
representam funcionalidades adicionais implementadas.
