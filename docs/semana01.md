# Semana 01 — Estruturação inicial do backend 20/10/26

## 1. Objetivo

Estabelecer a estrutura inicial do backend do LAB-AIEDU,
utilizando Node.js e Fastify, com foco na implementação
do núcleo da aplicação, dos métodos HTTP, de mecanismos
básicos de segurança e de testes automatizados.

## 2. Estrutura inicial

Foram criados os seguintes diretórios:

- `core/`: destinado ao núcleo da aplicação.
- `docs/`: destinado à documentação técnica.
- `tests/`: destinado aos testes automatizados.

O arquivo `core/main.js` será o ponto central de entrada
da aplicação nesta etapa inicial.

## 3. Tecnologias e dependências

Foram selecionadas inicialmente:

- Node.js: ambiente de execução JavaScript.
- npm: gerenciador de pacotes.
- Fastify: framework para desenvolvimento do servidor HTTP.
- @fastify/helmet: plugin para configuração de cabeçalhos
  HTTP de segurança.
- Jest: framework para testes automatizados.

As versões utilizadas nesta etapa são provisórias e
poderão ser revisadas conforme as orientações do projeto.

## 4. Configuração do projeto

Foi criado o arquivo `package.json`, responsável por
declarar as dependências, identificar o projeto e definir
scripts de execução e testes.

O arquivo `package-lock.json` registra as versões
resolvidas das dependências, contribuindo para a
reprodutibilidade do ambiente de desenvolvimento.

## 5. Dificuldades e observações

Durante a instalação do Jest, o npm identificou
19 alertas de vulnerabilidade moderada associados
à árvore de dependências de desenvolvimento.

A auditoria realizada com `npm audit --omit=dev`
não identificou vulnerabilidades conhecidas nas
dependências de produção.

A atualização forçada das dependências foi evitada,
pois poderia introduzir alterações incompatíveis.
Os alertas permanecerão sob acompanhamento.

## 6. Limitações desta etapa

Nesta semana, não serão implementados banco de dados,
Docker, workflows de integração contínua ou plugins
acadêmicos.

Esses componentes estão previstos para etapas futuras
do desenvolvimento.

## 7. Implementação inicial do núcleo

Foi implementada a estrutura inicial do servidor HTTP
no arquivo `core/main.js`, utilizando o framework Fastify.

A implementação contempla:

- Criação da instância da aplicação por meio da função `buildApp()`;
- Definição inicial da rota GET `/`;
- Retorno de uma resposta HTML simples;
- Inicialização do servidor na porta 3000;
- Restrição inicial de acesso ao endereço local `127.0.0.1`;
- Separação entre criação da aplicação e inicialização do servidor;
- Exportação da função `buildApp()` para permitir testes automatizados.

A separação entre construção e inicialização da aplicação
foi adotada para facilitar a testabilidade e a futura
evolução da arquitetura orientada a plugins.

### Validação inicial

O servidor foi executado localmente com `npm run dev`,
e a rota GET `/` retornou a mensagem HTML esperada.

### Configuração inicial de rede

O servidor Fastify foi configurado para utilizar a porta
3000 e o endereço de loopback `127.0.0.1`.

A porta 3000 foi escolhida por ser uma convenção comum
em ambientes de desenvolvimento Node.js, não sendo
uma exigência do framework.

O endereço `127.0.0.1` restringe a escuta do servidor
à interface local, evitando sua exposição direta às
interfaces externas de rede nesta etapa.

Essas configurações são provisórias e poderão ser
revisadas durante a futura implantação da plataforma
em ambiente de servidor.

### Implementação dos métodos HTTP

Foram implementados os métodos GET, POST, PUT e DELETE
utilizando o framework Fastify.

Os quatro métodos foram associados à rota raiz (`/`),
estabelecendo um único caminho de acesso HTTP nesta
etapa inicial.

Cada método retorna uma resposta HTML simples,
sem utilização de mecanismos de renderização ou
formatação visual.

As funcionalidades foram verificadas manualmente
por meio da ferramenta `curl`, utilizando requisições
HTTP direcionadas ao endereço `127.0.0.1:3000`.

Todos os métodos responderam conforme esperado.

Nesta etapa, as operações são demonstrativas,
não realizando persistência, atualização ou
exclusão efetiva de dados.

Os testes automatizados com Jest serão
implementados posteriormente.

### Implementação de cabeçalhos HTTP de segurança

Foi integrado ao núcleo da aplicação o plugin
`@fastify/helmet`, utilizando o mecanismo de registro
de plugins do framework Fastify.

A configuração foi realizada no arquivo `core/main.js`
por meio do método `app.register(helmet)`.

O objetivo é adicionar cabeçalhos HTTP de segurança
para reduzir riscos relacionados à execução de
conteúdo não autorizado, interpretação inadequada
de respostas e exposição de informações de navegação.

A implementação foi verificada manualmente com:

`curl -I http://127.0.0.1:3000/`

A resposta apresentou status HTTP 200 e cabeçalhos
como Content-Security-Policy, X-Content-Type-Options,
X-Frame-Options e Referrer-Policy.

A verificação confirmou a presença dos cabeçalhos
configurados pelo Helmet. Os testes automatizados
serão implementados posteriormente com Jest.

### Limitação do tamanho das requisições HTTP

Foi configurada a propriedade `bodyLimit` do Fastify,
estabelecendo um limite inicial de 1.024 bytes (1 KiB)
para o corpo das requisições HTTP.

A medida busca reduzir o processamento de corpos
excessivamente grandes, contribuindo para a proteção
dos recursos do servidor.

A configuração foi validada manualmente por meio
de uma requisição POST contendo aproximadamente
2.000 caracteres no corpo.

O servidor rejeitou a requisição e retornou:

- Status HTTP: 413 (Payload Too Large);
- Código Fastify: FST_ERR_CTP_BODY_TOO_LARGE;
- Mensagem: Request body is too large.

O resultado confirmou o funcionamento do limite
configurado.

O valor de 1 KiB foi adotado exclusivamente para
os testes iniciais e poderá ser revisado conforme
os requisitos futuros da plataforma.

### Validação de entradas com JSON Schema

Foi implementada a validação de entradas da rota
POST `/`, utilizando JSON Schema e o validador Ajv,
integrado ao Fastify.

O schema inicial exige um objeto JSON contendo o
campo obrigatório `nome`, do tipo string, com
comprimento entre 1 e 100 caracteres.

Durante os testes, observou-se que o Fastify
realizava a conversão automática de valores
numéricos para strings.

Para estabelecer uma validação mais rigorosa,
foi configurada a opção `coerceTypes: false`.

Após a alteração, uma requisição POST contendo
`{"nome":12345}` foi rejeitada com o status
HTTP 400 (Bad Request), conforme esperado.

A validação constitui um contrato inicial de
entrada, que poderá ser adaptado às necessidades
dos futuros plugins da plataforma.

### Dificuldade na execução dos testes automatizados

Durante a primeira execução dos testes com Jest,
foram identificadas duas dificuldades.

A primeira ocorreu porque o arquivo
`tests/security.test.js` ainda não continha casos
de teste, fazendo com que o Jest sinalizasse
uma suíte vazia.

A segunda ocorreu durante a execução de
`app.inject()`, utilizado para simular requisições
HTTP ao Fastify.

O Jest apresentou uma incompatibilidade no
carregamento da dependência `cookie`, utilizada
indiretamente pelo pacote `light-my-request`,
devido à presença de um módulo ESM no ambiente
configurado com CommonJS.

A ocorrência demonstrou a importância de
verificar a compatibilidade entre as ferramentas
de testes e as dependências transitivas do projeto.

A resolução será investigada antes da ampliação
dos testes automatizados.

### Execução do primeiro teste automatizado

Para contornar a incompatibilidade de carregamento
de módulos ESM no ambiente Jest, foi utilizada
a opção experimental `--experimental-vm-modules`
do Node.js.

O teste foi executado com o comando:

`NODE_OPTIONS=--experimental-vm-modules npx jest tests/core.test.js`

A execução foi concluída com sucesso, apresentando:

- 1 suíte de testes aprovada;
- 1 teste aprovado;
- Nenhum teste reprovado.

O teste verificou o status HTTP 200, o tipo de
conteúdo HTML e a presença da identificação
LAB-AIEDU na resposta da rota GET `/`.

A solução foi validada no ambiente de
desenvolvimento, permanecendo necessária uma
avaliação posterior sobre a configuração definitiva
do Jest e a compatibilidade de suas dependências.

### Testes automatizados dos métodos HTTP

Foram implementados quatro testes automatizados
no arquivo `tests/core.test.js`, utilizando Jest
e o método `app.inject()` do Fastify.

Os testes verificam os métodos GET, POST, PUT e
DELETE associados à rota raiz (`/`).

Para cada método, foram verificadas:

- A resposta HTTP com status 200;
- A identificação do conteúdo como HTML;
- A presença de conteúdo esperado na resposta.

No teste POST, foi utilizado um payload válido
conforme o JSON Schema definido na aplicação.

A execução foi realizada com o comando:

`NODE_OPTIONS=--experimental-vm-modules npx jest tests/core.test.js`

Resultados:

- 1 suíte de testes aprovada;
- 4 testes aprovados;
- 0 testes reprovados.

Os testes utilizam a injeção de requisições do
Fastify, permitindo verificar o comportamento
das rotas sem iniciar um servidor HTTP de rede.

### Testes automatizados de segurança

Foram implementados quatro testes automatizados
de segurança no arquivo `tests/security.test.js`,
utilizando Jest e o método `app.inject()` do Fastify.

Os testes contemplaram:

1. Verificação dos cabeçalhos HTTP de segurança
   adicionados pelo plugin `@fastify/helmet`.

2. Verificação da rejeição de requisições cujo
   corpo ultrapassa o limite de 1.024 bytes,
   com retorno do status HTTP 413.

3. Verificação da rejeição de dados com tipo
   incompatível com o JSON Schema, utilizando
   um valor numérico no campo `nome`,
   com retorno do status HTTP 400.

4. Verificação da rejeição de requisições POST
   sem o campo obrigatório `nome`,
   com retorno do status HTTP 400.

### Resultado consolidado dos testes

A suíte completa foi executada por meio do comando:

`NODE_OPTIONS=--experimental-vm-modules npm test`

Resultados obtidos:

- Suítes executadas: 2;
- Suítes aprovadas: 2;
- Testes executados: 8;
- Testes aprovados: 8;
- Testes reprovados: 0;
- Tempo de execução: 0,443 segundo.

Os resultados confirmaram o funcionamento dos
quatro métodos HTTP e das proteções verificadas
no ambiente de desenvolvimento.

A execução ainda depende da opção experimental
`--experimental-vm-modules`, utilizada para
contornar uma incompatibilidade no carregamento
de dependências ESM pelo Jest.

## 8. Dificuldades encontradas

Senti um pouco de dificuldade com a linguagem mas acredito que seja porque nunca trabalhei com JS, mas como vou começar um curso de JS e TS, vou começar a entender melhor.

A parte de criar os testes também ficou um pouco embassado, mas também nunca trabalhei com testes unitários.

Em geral, a dificuldade que tive foi usar tecnologias e processos que nunca utilizei antes, então acredito que é normal no começo.
