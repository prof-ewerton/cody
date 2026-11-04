const { buildApp } = require('../core/main');
const { createCody } = require('../core/cody');

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

        test('Encaminha params, query, corpo, reply e schemas nativos', async () => {
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
                    handler: async (request, reply) => reply.code(201).send({
                        id: request.params.id, nome: request.body.nome,
                        origem: request.query.origem, interno: 'não serializar'
                    })
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

        test('Preserva handlers síncronos e o this nativo do Fastify', async () => {
            cody.addRouter('/sincrono', {
                GET: { handler: function (request, reply) { reply.send({ fastify: this === app }); } }
            });
            expect((await app.inject('/sincrono')).json()).toEqual({ fastify: true });
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
            cody.addRouter('/head', { GET: { handler: async () => 'conteúdo' } });
            expect(app.hasRoute({ method: 'HEAD', url: '/head' })).toBe(true);
            const response = await app.inject({ method: 'HEAD', url: '/head' });
            expect(response.statusCode).toBe(200);
            expect(response.body).toBe('');
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
