const { Readable } = require('node:stream');
const { runInNewContext } = require('node:vm');
const { buildApp } = require('../core/main');
const { createCody } = require('../core/cody');

function expectInternalError(response) {
    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.json()).toStrictEqual({ statusCode: 500, message: 'Erro interno do servidor.' });
}

describe('API Cody', () => {
    let app;
    let cody;

    beforeEach(() => {
        app = buildApp();
        cody = createCody(app);
    });

    afterEach(async () => {
        await app.close();
    });

    test('Rejeita a opção legada template sem registro parcial', () => {
        expect(() => createCody(app).addRouter('/html', {
            POST: { handler: async () => ({ ok: true }) },
            GET: { template: 'experimental', handler: async () => ({}) }
        })).toThrow(/opção desconhecida template/);
        expect(app.hasRoute({ method: 'POST', url: '/html' })).toBe(false);
        expect(app.hasRoute({ method: 'GET', url: '/html' })).toBe(false);
    });

    const bodySchema = {
        type: 'object',
        required: ['nome'],
        additionalProperties: false,
        properties: { nome: { type: 'string', minLength: 1, maxLength: 100 } }
    };

    describe('Registro e integração com Fastify', () => {
        test('Registra os quatro métodos no mesmo caminho, sem prefixo', async () => {
            const routes = {};
            for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
                routes[method] = { handler: async () => ({ method }) };
            }
            cody.addRouter('/exemplo', routes);
            for (const method of Object.keys(routes)) {
                const response = await app.inject({ method, url: '/exemplo' });
                expect(response.statusCode).toBe(200);
                expect(response.json()).toEqual({ method });
            }
        });

        test('Encaminha params, query e corpo validados e serializa o JSON com status 201', async () => {
            cody.addRouter('/usuarios/:id', {
                POST: {
                    schema: {
                        body: bodySchema,
                        params: {
                            type: 'object', required: ['id'],
                            properties: { id: { type: 'string', pattern: '^[0-9]+$' } }
                        },
                        querystring: {
                            type: 'object', required: ['origem'],
                            properties: { origem: { type: 'string' } }
                        },
                        response: {
                            201: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' }, nome: { type: 'string' }, origem: { type: 'string' }
                                }
                            }
                        }
                    },
                    handler: async ({ params, query, body }) => cody.json({
                        id: params.id, nome: body.nome,
                        origem: query.origem, interno: 'não serializar'
                    }, { status: 201 })
                }
            });
            const response = await app.inject({
                method: 'POST', url: '/usuarios/42?origem=teste', payload: { nome: 'João' }
            });
            expect(response.statusCode).toBe(201);
            expect(response.json()).toEqual({ id: '42', nome: 'João', origem: 'teste' });
            for (const url of ['/usuarios/invalido?origem=teste', '/usuarios/42']) {
                expect((await app.inject({ method: 'POST', url, payload: { nome: 'Ana' } })).statusCode).toBe(400);
            }
        });

        test.each([
            ['campo adicional', { nome: 'Ana', extra: true }],
            ['tipo sem coerção', { nome: 123 }],
            ['campo ausente', {}]
        ])('Preserva validação Ajv: %s', async (_description, payload) => {
            const handler = jest.fn(async () => ({ recebido: true }));
            cody.addRouter('/validacao', { POST: { schema: { body: bodySchema }, handler } });
            const response = await app.inject({ method: 'POST', url: '/validacao', payload });
            expect(response.statusCode).toBe(400);
            expect(response.json().code).toBe('FST_ERR_VALIDATION');
            expect(handler).not.toHaveBeenCalled();
        });

        test('Preserva Helmet e o limite de corpo', async () => {
            cody.addRouter('/seguranca', {
                POST: { schema: { body: bodySchema }, handler: async () => ({ recebido: true }) }
            });
            const valid = await app.inject({ method: 'POST', url: '/seguranca', payload: { nome: 'Ana' } });
            expect(valid.statusCode).toBe(200);
            expect(valid.headers['x-content-type-options']).toBe('nosniff');
            expect(valid.headers['content-security-policy']).toContain("script-src 'self'");
            const large = await app.inject({ method: 'POST', url: '/seguranca', payload: { nome: 'A'.repeat(2000) } });
            expect(large.statusCode).toBe(413);
            expect(large.json().code).toBe('FST_ERR_CTP_BODY_TOO_LARGE');
        });

        test('Executa handler síncrono com um único argumento de dados', async () => {
            let received;
            let receiver;
            function handler(input) {
                'use strict';
                received = Array.from(arguments);
                receiver = this;
                return { method: input.method };
            }
            cody.addRouter('/sincrono', {
                GET: { handler }
            });
            const response = await app.inject('/sincrono');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ method: 'GET' });
            expect(received).toHaveLength(1);
            expect(received[1]).toBeUndefined();
            expect(receiver).toBeUndefined();
            expect(Reflect.ownKeys(received[0]).sort()).toEqual(['body', 'headers', 'method', 'params', 'query']);
            for (const key of ['raw', 'server', 'routeOptions', 'reply']) {
                expect(key in received[0]).toBe(false);
            }
        });
    });

    describe('Retornos JSON', () => {
        test('Rejeita getters sem executá-los', async () => {
            const getter = jest.fn(() => { throw new Error('não executar getter'); });
            const data = Object.defineProperty({}, 'nome', { get: getter, enumerable: true });
            cody.addRouter('/getter', { GET: { handler: async () => data } });

            const response = await app.inject('/getter');
            expect(response.statusCode).toBe(500);
            expect(response.headers['content-type']).toMatch(/^application\/json\b/);
            expect(response.json()).toEqual({ statusCode: 500, message: 'Erro interno do servidor.' });
            expect(getter).not.toHaveBeenCalled();
        });

        test('Aceita objeto simples sem protótipo', async () => {
            const data = Object.assign(Object.create(null), { nome: 'Ana' });
            cody.addRouter('/sem-prototipo', { GET: { handler: async () => data } });

            const response = await app.inject('/sem-prototipo');
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toMatch(/^application\/json\b/);
            expect(response.json()).toEqual({ nome: 'Ana' });
        });
    });


    describe('Dados da requisição', () => {
        test('Copia params, query, body e headers sem compartilhar referências aninhadas', async () => {
            let native;
            let received;
            let originalHeaders;
            app.addHook('preHandler', async request => {
                native = request;
                originalHeaders = request.headers;
            });
            cody.addRouter('/copia/:id', {
                POST: {
                    handler(input) {
                        received = input;
                        const original = {
                            method: input.method,
                            id: input.params.id,
                            query: [...input.query.tag],
                            item: input.body.items[0].nome,
                            header: input.headers['x-origem'],
                            cookies: [...input.headers['set-cookie']]
                        };
                        input.params.id = 'local';
                        input.query.tag.push('local');
                        input.body.items[0].nome = 'local';
                        input.body.items.push({ nome: 'local' });
                        input.headers['x-origem'] = 'local';
                        input.headers['set-cookie'].push('local');
                        return original;
                    }
                }
            });

            const response = await app.inject({
                method: 'POST', url: '/copia/42?tag=a&tag=b',
                headers: { 'x-origem': 'teste', 'set-cookie': ['a=1', 'b=2'] },
                payload: { items: [{ nome: 'Ana' }] }
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                method: 'POST', id: '42', query: ['a', 'b'], item: 'Ana',
                header: 'teste', cookies: ['a=1', 'b=2']
            });
            expect(received.params).not.toBe(native.params);
            expect(received.query).not.toBe(native.query);
            expect(received.query.tag).not.toBe(native.query.tag);
            expect(received.body).not.toBe(native.body);
            expect(received.body.items).not.toBe(native.body.items);
            expect(received.body.items[0]).not.toBe(native.body.items[0]);
            expect(received.headers).not.toBe(originalHeaders);
            expect(received.headers['set-cookie']).not.toBe(originalHeaders['set-cookie']);
            expect(native.params.id).toBe('42');
            expect(native.query.tag).toEqual(['a', 'b']);
            expect(native.body).toEqual({ items: [{ nome: 'Ana' }] });
            expect(originalHeaders['x-origem']).toBe('teste');
            expect(originalHeaders['set-cookie']).toEqual(['a=1', 'b=2']);
        });
    });

    describe('Valores e resultados declarativos', () => {
        const shared = { values: [[false, 0, '0', null], [true, 2.5, '']] };

        test.each([
            ['objeto com referência compartilhada', { first: shared, second: shared }],
            ['array aninhado', shared.values],
            ['null', null], ['booleano', false], ['número finito', 2.5]
        ])('Preserva %s em JSON', async (_label, value) => {
            cody.addRouter('/valor', { GET: { handler: () => value } });

            const response = await app.inject('/valor');
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.json()).toStrictEqual(value);
        });

        test.each(['', '<p>ação</p>'])('Distingue texto simples e string JSON: %p', async value => {
            cody.addRouter('/texto', { GET: { handler: () => value } });
            cody.addRouter('/string-json', { GET: { handler: () => cody.json(value) } });

            const text = await app.inject('/texto');
            expect(text.statusCode).toBe(200);
            expect(text.headers['content-type']).toBe('text/plain; charset=utf-8');
            expect(text.body).toBe(value);

            const json = await app.inject('/string-json');
            expect(json.statusCode).toBe(200);
            expect(json.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(json.body).toBe(JSON.stringify(value));
            expect(json.json()).toBe(value);
        });

        test.each([
            ['opções omitidas', [], null, 200],
            ['opções undefined', [undefined], null, 200],
            ['opções vazias', [{}], false, 200],
            ['opções sem protótipo', [Object.assign(Object.create(null), { status: 202 })], true, 202],
            ['status undefined', [{ status: undefined }], 0, 200],
            ['status 200 explícito', [{ status: 200 }], true, 200],
            ['status 599 explícito', [{ status: 599 }], 2.5, 599]
        ])('Produz JSON com %s', async (_label, options, value, status) => {
            cody.addRouter('/status-json', { GET: { handler: () => cody.json(value, ...options) } });

            const response = await app.inject('/status-json');
            expect(response.statusCode).toBe(status);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.json()).toBe(value);
        });

        test.each([199, 600, 200.5, NaN, Infinity, '201', null, true, {}, 204, 205, 304])(
            'Rejeita status inválido em cody.json(): %p', status => {
                expect(() => cody.json(null, { status })).toThrow(RangeError);
            }
        );

        test.each([
            ['null', null], ['array', []], ['string', '200'], ['número', 200],
            ['booleano', true], ['função', () => {}], ['instância de classe', new Date(0)],
            ['outro contexto', runInNewContext('({ status: 201 })')],
            ['chave desconhecida', { status: 200, extra: true }],
            ['chave simbólica', { [Symbol('status')]: 200 }],
            ['chave desconhecida não enumerável', Object.defineProperty({}, 'extra', { value: true })],
            ['status não enumerável', Object.defineProperty({}, 'status', { value: 200 })]
        ])('Recusa opções de json() com %s', (_label, options) => {
            expect(() => cody.json(null, options)).toThrow(TypeError);
        });

        test.each([
            ['getter', spy => Object.defineProperty({}, 'status', { get: spy, enumerable: true })],
            ['setter', spy => Object.defineProperty({}, 'status', { set: spy, enumerable: true })],
            ['getter herdado', spy => Object.create(Object.defineProperty({}, 'status', { get: spy }))],
            ['proxy', spy => new Proxy({}, { get: spy, getPrototypeOf: spy, ownKeys: spy, getOwnPropertyDescriptor: spy })]
        ])('Recusa opções de json() com %s sem executá-lo', (_label, makeOptions) => {
            const spy = jest.fn(() => { throw new Error('ACESSO_INDEVIDO'); });
            expect(() => cody.json(null, makeOptions(spy))).toThrow(TypeError);
            expect(spy).not.toHaveBeenCalled();
        });

        test('Aplica o status declarativo somente à identidade reconhecida pela fachada', async () => {
            const other = buildApp();
            try {
                const original = cody.json({ id: 42 }, { status: 202 });
                const results = [
                    ['original', original, 202, { id: 42 }],
                    ['mesma-app', createCody(app).json({ id: 42 }, { status: 202 }), 200, {}],
                    ['outra-app', createCody(other).json({ id: 42 }, { status: 202 }), 200, {}],
                    ['copia', { ...original }, 200, {}],
                    ['objeto', {}, 200, {}]
                ];
                for (const [name, result] of results) {
                    cody.addRouter('/json-' + name, { GET: { handler: () => result } });
                }
                for (const [name, , status, body] of results) {
                    const response = await app.inject('/json-' + name);
                    expect(response.statusCode).toBe(status);
                    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                    expect(response.json()).toStrictEqual(body);
                }
            } finally {
                await other.close();
            }
        });
    });

    describe('Seleção de schemas de resposta', () => {
        const fieldSchema = field => ({ type: 'object', properties: { [field]: { type: 'string' } } });

        test.each([
            [201, { exact: 'exato' }], [202, { group: 'classe' }], [409, { fallback: 'padrão' }]
        ])('Seleciona o schema de objeto aplicável ao status %i', async (status, expected) => {
            cody.addRouter('/schema', {
                GET: {
                    schema: { response: { 201: fieldSchema('exact'), '2xx': fieldSchema('group'), default: fieldSchema('fallback') } },
                    handler: () => cody.json({ exact: 'exato', group: 'classe', fallback: 'padrão' }, { status })
                }
            });
            const response = await app.inject('/schema');
            expect(response.statusCode).toBe(status);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.json()).toStrictEqual(expected);
        });

        test.each([
            ['MIME exato antes de wildcard', { 'application/json': { schema: { type: 'integer' } }, '*/*': { schema: { type: 'string' } } }, 42],
            ['wildcard aplicável', { 'text/plain': { schema: { type: 'string' } }, '*/*': { schema: { type: 'integer' } } }, 42],
            ['sem MIME compatível', { 'text/plain': { schema: { type: 'integer' } } }, '42']
        ])('Serializa string com %s', async (_label, content, expected) => {
            cody.addRouter('/schema-string', {
                GET: {
                    schema: { response: { 200: { content }, '2xx': { type: 'integer' }, default: { type: 'integer' } } },
                    handler: () => '42'
                }
            });
            const response = await app.inject('/schema-string');
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.body).toBe(JSON.stringify(expected));
            expect(response.json()).toBe(expected);
        });

        test.each([
            ['classe', 202, { '2xx': { type: 'integer' }, default: { type: 'string' } }, 42],
            ['default', 409, { '2xx': { type: 'string' }, default: { type: 'integer' } }, 42],
            ['primitivo null', 200, { 200: { type: 'null' } }, null]
        ])('Aplica schema a %s', async (_label, status, response, expected) => {
            const value = expected === null ? null : '42';
            cody.addRouter('/schema-primitivo', {
                GET: { schema: { response }, handler: () => cody.json(value, { status }) }
            });
            const result = await app.inject('/schema-primitivo');
            expect(result.statusCode).toBe(status);
            expect(result.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(result.json()).toBe(expected);
        });
    });


    describe('Falhas controladas', () => {
        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test.each([
            ['undefined', () => undefined], ['BigInt', () => 1n], ['símbolo', () => Symbol('valor')],
            ['função', () => () => 1], ['NaN', () => NaN], ['Infinity', () => Infinity],
            ['-Infinity', () => -Infinity],
            ['ciclo aninhado', () => { const node = {}; node.self = node; return { node }; }],
            ['array esparso', () => Array(2)], ['instância de classe', () => new Date(0)],
            ['undefined aninhado', () => ({ values: [undefined] })],
            ['NaN aninhado', () => [0, { value: NaN }]],
            ['chave simbólica', () => ({ [Symbol('campo')]: 1 })],
            ['propriedade não enumerável', () => Object.defineProperty({}, 'oculto', { value: 1 })]
        ])('Rejeita retorno %s sem conversão silenciosa', async (_label, makeValue) => {
            const handler = jest.fn(makeValue);
            cody.addRouter('/invalido', { GET: { handler } });

            expectInternalError(await app.inject('/invalido'));
            expect(handler).toHaveReturnedTimes(1);
        });

        test.each([
            ['getter aninhado', spy => ({ node: Object.defineProperty({}, 'value', { get: spy, enumerable: true }) })],
            ['getter then em retorno síncrono', spy => Object.defineProperty({}, 'then', { get: spy, enumerable: true })],
            ['setter', spy => Object.defineProperty({}, 'value', { set: spy, enumerable: true })],
            ['proxy', spy => new Proxy({}, { get: spy, getPrototypeOf: spy, ownKeys: spy, getOwnPropertyDescriptor: spy })],
            ['método toJSON', spy => ({ toJSON: spy })],
            ['método pipe', spy => ({ pipe: spy })],
            ['método getReader', spy => ({ getReader: spy })]
        ])('Rejeita %s sem executar seu comportamento', async (_label, makeValue) => {
            const spy = jest.fn(() => { throw new Error('COMPORTAMENTO_INDEVIDO'); });
            const value = makeValue(spy);
            cody.addRouter('/especial', { GET: { handler: () => value } });

            expectInternalError(await app.inject('/especial'));
            expect(spy).not.toHaveBeenCalled();
        });

        test.each([
            ['Buffer', () => Buffer.from('CORPO_ESPECIAL')],
            ['view binária', () => new Uint8Array([1, 2])],
            ['Buffer aninhado', () => ({ value: [Buffer.from('CORPO_ESPECIAL')] })],
            ['Response', () => new Response('CORPO_ESPECIAL', {
                status: 418, headers: { 'x-especial': 'valor', 'content-type': 'text/html' }
            })],
            ['Error', () => Object.assign(new Error('CORPO_ESPECIAL'), {
                statusCode: 418, headers: { 'x-especial': 'valor' }
            })]
        ])('Rejeita %s sem aplicar metadados especiais', async (_label, makeValue) => {
            cody.addRouter('/especial', { GET: { handler: makeValue } });

            const response = await app.inject('/especial');
            expectInternalError(response);
            expect(response.headers['x-especial']).toBeUndefined();
            expect(response.body).not.toContain('CORPO_ESPECIAL');
        });

        test('Rejeita streams Node e Web sem consumir o conteúdo', async () => {
            const nodeRead = jest.fn(function () { this.push(null); });
            const webPull = jest.fn(controller => controller.close());
            const nodeStream = new Readable({ read: nodeRead });
            const webStream = new ReadableStream({ pull: webPull }, { highWaterMark: 0 });
            try {
                cody.addRouter('/stream-node', { GET: { handler: () => nodeStream } });
                cody.addRouter('/stream-web', { GET: { handler: () => webStream } });

                expectInternalError(await app.inject('/stream-node'));
                expectInternalError(await app.inject('/stream-web'));
                expect(nodeRead).not.toHaveBeenCalled();
                expect(webPull).not.toHaveBeenCalled();
            } finally {
                nodeStream.destroy();
                await webStream.cancel();
            }
        });

        test.each([
            ['valor inválido com status válido', cody => cody.json({ value: undefined }, { status: 201 })],
            ['status sem conteúdo', cody => cody.json({ ok: true }, { status: 204 })],
            ['opção desconhecida', cody => cody.json({ ok: true }, { status: 201, extra: true })]
        ])('Responde com erro genérico para cody.json() com %s', async (_label, makeResult) => {
            cody.addRouter('/json-invalido', { GET: { handler: () => makeResult(cody) } });
            expectInternalError(await app.inject('/json-invalido'));
        });

        test.each([['objeto', '({ value: 1 })'], ['array', '[1]']])(
            'Limitação atual: rejeita %s simples de outro contexto JavaScript',
            async (_label, expression) => {
                const value = runInNewContext(expression);
                cody.addRouter('/retorno-vm', { GET: { handler: () => value } });
                expectInternalError(await app.inject('/retorno-vm'));
            }
        );

        test.each([
            ['objeto com campo obrigatório ausente', { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }, {}],
            ['string incompatível com inteiro', { type: 'integer' }, 'incompatível']
        ])('Preserva o corpo genérico quando falha ao serializar %s', async (_label, schema, value) => {
            cody.addRouter('/falha-schema', {
                GET: {
                    schema: { response: { 200: schema, 500: { type: 'object', properties: { detalhe: { type: 'string' } } } } },
                    handler: () => value
                }
            });
            expectInternalError(await app.inject('/falha-schema'));
        });

        test('Ignora status, cabeçalhos, mensagem e stack de uma exceção síncrona', async () => {
            const error = Object.assign(new Error('MENSAGEM_INTERNA'), {
                stack: 'STACK_INTERNO', statusCode: 418, headers: { 'x-interno': 'CABECALHO_INTERNO' }
            });
            const handler = jest.fn(() => { throw error; });
            cody.addRouter('/falha', { GET: { handler } });
            const response = await app.inject('/falha');
            expectInternalError(response);
            expect(response.headers['x-interno']).toBeUndefined();
            expect(response.body).not.toMatch(/MENSAGEM_INTERNA|STACK_INTERNO|CABECALHO_INTERNO/);

            const head = await app.inject({ method: 'HEAD', url: '/falha' });
            expect(head.statusCode).toBe(500);
            expect(head.headers['content-type']).toBe(response.headers['content-type']);
            expect(head.headers['x-content-type-options']).toBe('nosniff');
            expect(head.headers['x-interno']).toBeUndefined();
            expect(head.body).toBe('');
            expect(handler.mock.calls.map(([input]) => input.method)).toEqual(['GET', 'HEAD']);
        });

        test('Preserva erro nativo de parsing sem chamar o handler', async () => {
            const handler = jest.fn(() => ({ ok: true }));
            cody.addRouter('/parsing', { POST: { handler } });
            const response = await app.inject({
                method: 'POST', url: '/parsing', headers: { 'content-type': 'application/json' }, payload: '{"nome":'
            });
            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toMatch(/^application\/json\b/);
            expect(response.json().code).toBe('FST_ERR_CTP_INVALID_JSON_BODY');
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Diagnóstico interno', () => {
        test('Preserva o 500 genérico em requisições consecutivas quando console.error sempre falha', async () => {
            const output = jest.spyOn(console, 'error').mockImplementation(() => {
                throw new Error('FALHA_DIAGNOSTICO');
            });
            try {
                cody.addRouter('/diagnostico', { GET: { handler: () => { throw new Error('FALHA_HANDLER'); } } });

                for (let attempt = 0; attempt < 2; attempt++) {
                    const response = await app.inject('/diagnostico');
                    expectInternalError(response);
                    expect(response.body).not.toMatch(/FALHA_DIAGNOSTICO|FALHA_HANDLER/);
                }
                expect(output).toHaveBeenCalledTimes(2);
            } finally {
                output.mockRestore();
            }
        });

        test.each([
            ['erro comum', () => new Error('MENSAGEM_INTERNA'), 'MENSAGEM_INTERNA'],
            ['string', () => 'MENSAGEM_INTERNA', 'MENSAGEM_INTERNA'],
            ['null', () => null, 'null'],
            ['erro com getter', spy => Object.defineProperty(new Error(), 'message', { get: spy }),
                'valor lançado sem mensagem disponível'],
            ['proxy', spy => new Proxy({}, { get: spy, getPrototypeOf: spy, ownKeys: spy, getOwnPropertyDescriptor: spy }),
                'valor lançado sem mensagem disponível']
        ])('Diagnostica %s sem expor detalhes na resposta', async (_label, makeError, detail) => {
            const spy = jest.fn(() => { throw new Error('ACESSO_INDEVIDO'); });
            const error = makeError(spy);
            const output = jest.spyOn(console, 'error').mockImplementation(() => {});
            try {
                cody.addRouter('/diagnostico', { GET: { handler: () => { throw error; } } });

                expectInternalError(await app.inject('/diagnostico'));
                expect(output).toHaveBeenCalledTimes(1);
                expect(output).toHaveBeenCalledWith(expect.any(String), 'GET', '/diagnostico', detail);
                expect(spy).not.toHaveBeenCalled();
            } finally {
                output.mockRestore();
            }
        });
    });

    describe('Argumentos inválidos sem registro parcial', () => {
        test.each([undefined, null, {}, { route() {} }])('Rejeita aplicação inválida: %p', (value) => {
            expect(() => createCody(value)).toThrow(/instância Fastify/);
        });

        test.each([
            undefined, null, 123, '', 'exemplo', 'https://example.com/exemplo',
            '/exemplo?nome=Ana', '/exemplo#parte', '/a/../b', '/a/./b',
            '//exemplo', '/a//b', '/exemplo/', '/com espaço', '/a\nb', '/a\n', '/:id\n', '/a\u0000',
            '/a/*', '/a/:id?', '/a/:id([0-9]+)', '/a/:', '/a/:id/:id', '/a/%2e%2e'
        ])('Rejeita caminho malformado ou não suportado: %p', (path) => {
            expect(() => cody.addRouter(path, { GET: { handler: async () => 'OK' } })).toThrow(/Cody:/);
        });

        test.each([undefined, null, [], {}, 'GET', new Date()])('Rejeita objeto de rotas inválido: %p', (routes) => {
            expect(() => cody.addRouter('/invalido', routes)).toThrow(/objetoDeRotas/);
        });

        test.each(['HEAD', 'PATCH', 'OPTIONS', 'get', 'DESCONHECIDO'])('Rejeita método %s antes de registrar GET', (method) => {
            expect(() => cody.addRouter('/invalido', {
                GET: { handler: async () => 'OK' },
                [method]: { handler: async () => 'não registrar' }
            })).toThrow(/método não suportado/);
            expect(app.hasRoute({ method: 'GET', url: '/invalido' })).toBe(false);
        });

        test.each([null, [], 'handler', () => 'OK'])('Rejeita definição de método inválida: %p', (definition) => {
            expect(() => cody.addRouter('/invalido', { GET: definition })).toThrow(/definição/);
        });

        test.each([undefined, null, 'handler', 123, {}])('Rejeita handler inválido: %p', (handler) => {
            expect(() => cody.addRouter('/invalido', {
                GET: { handler: async () => 'OK' }, POST: { handler }
            })).toThrow(/handler/);
            expect(app.hasRoute({ method: 'GET', url: '/invalido' })).toBe(false);
        });

        test.each(['url', 'method', 'bodyLimit', 'preHandler', 'exposeHeadRoute', 'validatorCompiler'])('Rejeita opção desconhecida %s', (option) => {
            expect(() => cody.addRouter('/invalido', {
                GET: { handler: async () => 'OK' },
                POST: { handler: async () => 'OK', [option]: true }
            })).toThrow(/opção desconhecida/);
            expect(app.hasRoute({ method: 'GET', url: '/invalido' })).toBe(false);
        });

        test.each([null, [], 'schema', false])('Rejeita schema com estrutura externa inválida: %p', (schema) => {
            expect(() => cody.addRouter('/invalido', {
                GET: { handler: async () => 'OK' },
                POST: { handler: async () => 'OK', schema }
            })).toThrow(/schema/);
            expect(app.hasRoute({ method: 'GET', url: '/invalido' })).toBe(false);
        });
    });

    describe('Conflitos e HEAD', () => {
        test.each(['GET', 'POST', 'PUT', 'DELETE'])('Rejeita conflito com %s / do núcleo', (method) => {
            expect(() => cody.addRouter('/', { [method]: { handler: async () => 'substituto' } })).toThrow(/conflito/);
        });

        test('Não sobrescreve rotas entre chamadas ou entre fachadas da mesma aplicação', async () => {
            cody.addRouter('/conflito', { GET: { handler: async () => 'original' } });
            expect(() => cody.addRouter('/conflito', { GET: { handler: async () => 'outro' } })).toThrow(/conflito/);
            expect(() => createCody(app).addRouter('/conflito', { GET: { handler: async () => 'outro' } })).toThrow(/conflito/);
            expect((await app.inject('/conflito')).body).toBe('original');
        });

        test('Verifica todos os conflitos conhecidos antes de registrar o primeiro método', () => {
            app.post('/conflito', async () => 'original');
            expect(() => cody.addRouter('/conflito', {
                GET: { handler: async () => 'OK' }, POST: { handler: async () => 'outro' }
            })).toThrow(/conflito/);
            expect(app.hasRoute({ method: 'GET', url: '/conflito' })).toBe(false);
        });

        test('Rejeita padrões parametrizados equivalentes', () => {
            cody.addRouter('/usuarios/:id', { GET: { handler: async () => 'original' } });
            expect(() => cody.addRouter('/usuarios/:nome', { GET: { handler: async () => 'outro' } })).toThrow(/conflito/);
        });

        test('Permite coexistência de caminho estático e parametrizado', async () => {
            cody.addRouter('/usuarios/:id', { GET: { handler: async () => 'parametrizado' } });
            cody.addRouter('/usuarios/novo', { GET: { handler: async () => 'estático' } });
            expect((await app.inject('/usuarios/novo')).body).toBe('estático');
            expect((await app.inject('/usuarios/42')).body).toBe('parametrizado');
        });

        test('Preserva HEAD automático com corpo vazio', async () => {
            const handler = jest.fn(async () => 'conteúdo');
            cody.addRouter('/head', { GET: { handler } });
            expect(app.hasRoute({ method: 'HEAD', url: '/head' })).toBe(true);
            const response = await app.inject({ method: 'HEAD', url: '/head' });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.body).toBe('');
            expect(handler.mock.calls.map(([input]) => input.method)).toEqual(['HEAD']);
        });

        test.each([200, 201])('Preserva HEAD JSON com status %i', async status => {
            const handler = jest.fn(() => status === 200 ? { ok: true } : cody.json({ ok: true }, { status }));
            cody.addRouter('/head-json', { GET: { handler } });

            const get = await app.inject('/head-json');
            const head = await app.inject({ method: 'HEAD', url: '/head-json' });
            expect(get.statusCode).toBe(status);
            expect(get.json()).toEqual({ ok: true });
            expect(head.statusCode).toBe(status);
            expect(head.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(head.headers['x-content-type-options']).toBe('nosniff');
            expect(head.body).toBe('');
            expect(handler.mock.calls.map(([input]) => input.method)).toEqual(['GET', 'HEAD']);
        });

        test('Rejeita GET diante de HEAD preexistente, inclusive com parâmetro equivalente', () => {
            app.head('/usuarios/:id', async () => '');
            expect(() => cody.addRouter('/usuarios/:nome', { GET: { handler: async () => 'OK' } })).toThrow(/HEAD preexistente/);
            expect(app.hasRoute({ method: 'GET', url: '/usuarios/:id' })).toBe(false);
        });
    });

    describe('Ciclo de vida, isolamento e falhas', () => {
        test.each(['ready', 'inject'])('Rejeita registro após %s', async (initialize) => {
            if (initialize === 'ready') await app.ready();
            else await app.inject('/');
            let failure;
            try { cody.addRouter('/tarde', { GET: { handler: async () => 'OK' } }); }
            catch (error) { failure = error; }
            expect(failure).toBeInstanceOf(Error);
            expect(failure.message).toContain('/tarde');
            expect(failure.message).toContain('fase de registro foi encerrada');
            expect(app.hasRoute({ method: 'GET', url: '/tarde' })).toBe(false);
        });

        test('Mantém aplicações independentes com o mesmo caminho', async () => {
            const other = buildApp();
            try {
                cody.addRouter('/isolado', { GET: { handler: async () => 'primeira' } });
                createCody(other).addRouter('/isolado', { GET: { handler: async () => 'segunda' } });
                expect((await app.inject('/isolado')).body).toBe('primeira');
                expect((await other.inject('/isolado')).body).toBe('segunda');
            } finally { await other.close(); }
        });

        test('Propaga erro de compilação de schema ao inicializar', async () => {
            cody.addRouter('/schema-invalido', {
                POST: { schema: { body: { type: 'tipo-inexistente' } }, handler: async () => 'não executar' }
            });
            await expect(app.ready()).rejects.toMatchObject({ code: 'FST_ERR_SCH_VALIDATION_BUILD' });
        });

        test('Interrompe registros ao receber erro do Fastify, preservando a causa', () => {
            const failure = new Error('falha de registro');
            const route = jest.spyOn(app, 'route').mockImplementationOnce(() => { throw failure; });
            try {
                expect(() => cody.addRouter('/falha', {
                    GET: { handler: async () => 'OK' }, POST: { handler: async () => 'OK' }
                })).toThrow(expect.objectContaining({ cause: failure, message: expect.stringContaining('GET /falha') }));
                expect(route).toHaveBeenCalledTimes(1);
                expect(() => cody.addRouter('/outra', { GET: { handler: async () => 'OK' } })).toThrow(/fase de registro foi encerrada/);
                expect(route).toHaveBeenCalledTimes(1);
            } finally { route.mockRestore(); }
        });
    });
});
