const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const fastify = require('fastify');
const { buildApp } = require('../core/main');
const { createCody } = require('../core/cody');

describe('Bootstrap com plugins', () => {
    const pluginsDir = path.resolve(__dirname, '..', 'Plugins');
    const status = { plugin: 'experimental', status: 'ativo', version: '1.0.0' };
    const coreRoutes = [
        ['GET', '<h1>LAB-AIEDU - Backend funcionando!</h1>'],
        ['POST', '<h1>POST - Dados recebidos pelo LAB-AIEDU</h1>'],
        ['PUT', '<h1>PUT - Solicitacao de atualizacao recebida</h1>'],
        ['DELETE', '<h1>DELETE - Solicitacao de exclusao recebida</h1>']
    ];
    let temporary;
    let apps;

    beforeEach(async () => {
        temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-aiedu-bootstrap-'));
        apps = [];
    });

    afterEach(async () => {
        try { await Promise.all(apps.map(app => app.close())); }
        finally { await fs.rm(temporary, { recursive: true, force: true }); }
    });

    function application(options) {
        const app = buildApp(options);
        apps.push(app);
        return app;
    }

    async function fixture(source) {
        const root = path.join(temporary, 'Plugins');
        const directory = path.join(root, 'fixture');
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({
            id: 'fixture', version: '1.0.0', entry: 'main.cjs'
        }));
        await fs.writeFile(path.join(directory, 'main.cjs'), source);
        return { root, directory };
    }

    test('buildApp é síncrona e não ativa plugins quando chamada sem argumentos', async () => {
        const app = application();
        expect(app).not.toBeInstanceOf(Promise);
        expect(typeof app.inject).toBe('function');
        expect((await app.inject('/experimental/status')).statusCode).toBe(404);
        expect(app.server.listening).toBe(false);
    });

    test('Objeto de opções vazio também preserva plugins desativados', async () => {
        const app = application({});
        expect((await app.inject('/experimental/status')).statusCode).toBe(404);
    });

    test.each(coreRoutes)('Preserva %s / sem ativar plugins', async (method, html) => {
        const response = await application().inject({
            method, url: '/', ...(method === 'POST' ? { payload: { nome: 'Ana' } } : {})
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toBe(html);
    });

    test('Descobre Plugin01 e mantém JSON e Helmet na rota experimental', async () => {
        const app = application({ pluginsDir });
        const response = await app.inject('/experimental/status');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.json()).toEqual(status);
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['content-security-policy']).toContain("script-src 'self'");
        expect(app.server.listening).toBe(false);
    });

    test.each(coreRoutes)('Preserva %s / com plugins ativados', async (method, html) => {
        const response = await application({ pluginsDir }).inject({
            method, url: '/', ...(method === 'POST' ? { payload: { nome: 'Ana' } } : {})
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toBe(html);
    });

    test('Conclui setup assíncrono antes de onReady e preserva encapsulamento', async () => {
        const { root } = await fixture(`exports.setup = async ({cody}) => {
            await new Promise(resolve => setImmediate(resolve));
            cody.addRouter('/async', {GET:{handler: async () => 'concluído'}});
        };`);
        const app = application({ pluginsDir: root });
        let checked = false;
        app.addHook('onReady', async () => {
            expect(app.hasRoute({ method: 'GET', url: '/async' })).toBe(true);
            checked = true;
        });
        await app.ready();
        expect(checked).toBe(true);
        expect((await app.inject('/async')).body).toBe('concluído');
    });

    test('Guarda do Cody do carregador rejeita novas rotas após ready', async () => {
        const { root } = await fixture(`exports.setup = ({cody}) => {
            cody.addRouter('/tentar', {GET:{handler: async () => {
                try { cody.addRouter('/tarde', {GET:{handler: async () => 'não registrar'}}); }
                catch (error) { return {erro:error.message}; }
            }}});
        };`);
        const app = application({ pluginsDir: root });
        const rootCody = createCody(app);
        await app.ready();
        expect(() => rootCody.addRouter('/tambem-tarde', { GET: { handler: async () => 'não registrar' } }))
            .toThrow(/fase de registro foi encerrada/);
        expect((await app.inject('/tentar')).json().erro).toContain('fase de registro foi encerrada');
        expect((await app.inject('/tarde')).statusCode).toBe(404);
        expect((await app.inject('/tambem-tarde')).statusCode).toBe(404);
    });

    test('Diretório inexistente impede inicialização e preserva a causa', async () => {
        const app = application({ pluginsDir: path.join(temporary, 'ausente') });
        await expect(app.ready()).rejects.toMatchObject({
            message: expect.stringContaining('[descoberta]'), cause: expect.objectContaining({ code: 'ENOENT' })
        });
        expect(app.server.listening).toBe(false);
        await app.close();
    });

    test('Manifesto inválido impede inicialização sem executar módulo', async () => {
        const { root, directory } = await fixture("throw new Error('não deve carregar');");
        await fs.writeFile(path.join(directory, 'manifest.json'), '{');
        const app = application({ pluginsDir: root });
        await expect(app.ready()).rejects.toMatchObject({
            message: expect.stringContaining('[validação]'), cause: expect.any(SyntaxError)
        });
        expect(app.server.listening).toBe(false);
        await app.close();
    });

    test('Falha de setup impede inicialização e preserva a causa', async () => {
        const { root } = await fixture("exports.setup = async () => { throw new Error('setup interrompido'); };");
        const app = application({ pluginsDir: root });
        await expect(app.ready()).rejects.toMatchObject({
            message: expect.stringContaining('[setup] fixture@1.0.0'),
            cause: expect.objectContaining({ message: 'setup interrompido' })
        });
        expect(app.server.listening).toBe(false);
        await app.close();
    });

    test('Módulo e setup executam uma vez, sem recarregamento por requisição', async () => {
        const eventFile = path.join(temporary, 'events.txt');
        const { root } = await fixture(`const fs = require('node:fs');
            const file = ${JSON.stringify(eventFile)};
            fs.appendFileSync(file, ${JSON.stringify('módulo\n')});
            exports.setup = ({cody}) => {
                fs.appendFileSync(file, ${JSON.stringify('setup\n')});
                cody.addRouter('/contagem', {GET:{handler: async () => 'OK'}});
            };`);
        const app = application({ pluginsDir: root });
        await app.ready();
        for (let i = 0; i < 3; i++) {
            expect((await app.inject('/contagem')).body).toBe('OK');
        }
        expect(await fs.readFile(eventFile, 'utf8')).toBe('módulo\nsetup\n');
    });

    test('Aplicações separadas mantêm registros e estado independentes', async () => {
        const { root } = await fixture(`exports.setup = ({cody}) => {
            let count = 0;
            cody.addRouter('/contador', {GET:{handler: async () => ({count: ++count})}});
        };`);
        const first = application({ pluginsDir: root });
        const second = application({ pluginsDir: root });
        const plain = application();
        expect((await first.inject('/contador')).json()).toEqual({ count: 1 });
        expect((await first.inject('/contador')).json()).toEqual({ count: 2 });
        expect((await second.inject('/contador')).json()).toEqual({ count: 1 });
        expect((await plain.inject('/contador')).statusCode).toBe(404);
    });
});

describe('start sem abrir servidor de rede', () => {
    // Só listen é substituído: ready e o restante do Fastify continuam reais.
    async function withStart(loader, verify) {
        let app;
        let start;
        const output = jest.spyOn(console, 'log').mockImplementation(() => {});
        const diagnostic = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.isolateModules(() => {
            jest.doMock('fastify', () => (options) => {
                app = fastify(options);
                jest.spyOn(app, 'listen').mockResolvedValue('http://127.0.0.1:3000');
                jest.spyOn(app, 'close');
                return app;
            });
            if (loader) jest.doMock('../core/plugin-loader', () => ({ loadPlugins: loader }));
            ({ start } = require('../core/main'));
        });
        try {
            await verify({ start, getApp: () => app, output, diagnostic });
        } finally {
            jest.dontMock('fastify');
            jest.dontMock('../core/plugin-loader');
            if (app) {
                app.close.mockRestore();
                await app.close();
            }
            output.mockRestore();
            diagnostic.mockRestore();
        }
    }

    test('start aguarda plugin real e preserva host e porta antes do listen simulado', async () => {
        await withStart(null, async ({ start, getApp, diagnostic }) => {
            const running = start();
            const app = getApp();
            app.listen.mockImplementation(async (options) => {
                expect(options).toEqual({ host: '127.0.0.1', port: 3000 });
                expect(app.hasRoute({ method: 'GET', url: '/experimental/status' })).toBe(true);
                expect(app.server.listening).toBe(false);
                return 'http://127.0.0.1:3000';
            });
            await running;
            expect(app.listen).toHaveBeenCalledTimes(1);
            expect((await app.inject('/experimental/status')).json()).toEqual({
                plugin: 'experimental', status: 'ativo', version: '1.0.0'
            });
            expect(diagnostic).not.toHaveBeenCalled();
        });
    });

    test('Falha de plugin não chama listen, fecha a aplicação e propaga erro original', async () => {
        const original = new Error('falha original do plugin');
        await withStart(async () => { throw original; }, async ({ start, getApp, diagnostic }) => {
            await expect(start()).rejects.toBe(original);
            expect(getApp().listen).not.toHaveBeenCalled();
            expect(getApp().close).toHaveBeenCalledTimes(1);
            expect(diagnostic).toHaveBeenCalledWith('Falha ao iniciar o backend LAB-AIEDU:', original);
        });
    });

    test('Erro ao fechar não substitui a falha original de inicialização', async () => {
        const original = new Error('falha do plugin');
        const cleanup = new Error('falha de encerramento');
        await withStart(async () => { throw original; }, async ({ start, getApp, diagnostic }) => {
            const running = start();
            getApp().close.mockRejectedValueOnce(cleanup);
            await expect(running).rejects.toBe(original);
            expect(getApp().listen).not.toHaveBeenCalled();
            expect(diagnostic).toHaveBeenCalledWith('Falha ao encerrar a aplicação após erro de inicialização:', cleanup);
        });
    });
});
