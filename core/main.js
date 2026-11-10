const fastify = require('fastify');
const helmet = require('@fastify/helmet');
const path = require('node:path');
const { loadPlugins } = require('./plugin-loader');
const { publicAssets } = require('./public-assets');
// -> esse require é uma função do CommonJS utilizada para importar módulos

function buildApp({ pluginsDir } = {}) {
    const app = fastify({
        bodyLimit: 1024, // -> pesquisar depois
        ajv: {
            customOptions: {
                coerceTypes: false,
                removeAdditional: false
            }
        }
    });// -> fastify() cria uma nova instância do servidor Fastify
    app.register(helmet);
    app.register(publicAssets);

    //*/
    app.get('/', async (request, reply) => {
        return reply
        .type('text/html')
        .send('<h1>LAB-AIEDU - Backend funcionando!</h1>');
    });
    //*/

/*
async: declara uma função assíncrona.
request: objeto com informações sobre a requisição recebida.
reply: objeto utilizado para configurar e enviar a resposta.
=>: sintaxe de uma arrow function, uma maneira de declarar funções em JavaScript.
O método .type('text/html') informa ao cliente que o conteúdo retornado é HTML.
O método .send() envia esse conteúdo.
Estamos retornando HTML simples, sem CSS, JavaScript de frontend ou template engine.
*/

    const schemaPost = { // -> Aqui estamos definindo um formato aceito
        body: {
            type: 'object',
            required: ['nome'],
            additionalProperties: false,
            properties: {
                nome: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 100
                }
            }
        }
    };

    app.post('/', { schema: schemaPost }, async (request, reply) => {
        return reply
        .code(200)
        .type('text/html')
        .send('<h1>POST - Dados recebidos pelo LAB-AIEDU</h1>');
    });

    app.put('/', async (request, reply) => {
        return reply
        .type('text/html')
        .send('<h1>PUT - Solicitacao de atualizacao recebida</h1>');
    });

    app.delete('/', async (request, reply) => {
        return reply
        .type('text/html')
        .send('<h1>DELETE - Solicitacao de exclusao recebida</h1>');
    });

    if (pluginsDir !== undefined) {
        app.register(loadPlugins, { pluginsDir });
    }

    return app;
}

async function start() {
    const app = buildApp({ pluginsDir: path.resolve(__dirname, '..', 'Plugins') });

/*
await: aguarda a conclusão de uma operação assíncrona.
listen(): inicia o servidor HTTP.
port: 3000: define a porta utilizada.
host: '127.0.0.1': limita o acesso à própria máquina.
*/

    try {
        // Conclui a descoberta e os setups antes de tentar abrir a porta HTTP.
        await app.ready();
        await app.listen({      
            port:  3000, // -> 3000 pois é uma porta convencional em JS
            host: '127.0.0.1' // -> Localhost
        });

        console.log('Servidor iniciado na porta 3000');
    }   catch (error) {
        // O logger padrão está desativado; console.error mantém o diagnóstico e cause.
        console.error('Falha ao iniciar o backend LAB-AIEDU:', error);
        try {
            await app.close();
        } catch (closeError) {
            console.error('Falha ao encerrar a aplicação após erro de inicialização:', closeError);
        }
        throw error;
    }
}

if (require.main === module) {
    start().catch(() => {
        process.exitCode = 1;
    });
}

/*
O if verifica se main.js foi executado diretamente pelo Node.js.
Quando executamos node core/main.js, o servidor inicia.
Quando um teste importa o arquivo, o servidor não inicia automaticamente.
Já module.exports disponibiliza a função buildApp para outros arquivos CommonJS,
inclusive os testes Jest.
*/

module.exports = { buildApp, start };
