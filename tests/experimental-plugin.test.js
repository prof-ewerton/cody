const fs = require('node:fs/promises');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const { buildApp } = require('../core/main');
const { createCody } = require('../core/cody');
const { loadPlugins } = require('../core/plugin-loader');
const experimental = require('../Plugins/Plugin01/main');

describe('Plugin experimental real', () => {
    const pluginsDir = path.join(__dirname, '..', 'Plugins');
    const pluginDir = path.join(pluginsDir, 'Plugin01');
    const expectedStatus = { plugin: 'experimental', status: 'ativo', version: '1.0.0' };
    let app;

    beforeEach(() => {
        app = buildApp();
    });

    afterEach(async () => {
        await app.close();
    });

    test('Manifesto é JSON válido com exatamente os metadados aprovados', async () => {
        const manifest = JSON.parse(await fs.readFile(path.join(pluginDir, 'manifest.json'), 'utf8'));
        expect(manifest).toEqual({ id: 'experimental', version: '1.0.0', entry: 'main.js' });
        expect((await fs.stat(path.join(pluginDir, manifest.entry))).isFile()).toBe(true);
    });

    test('Exporta setup como função própria', () => {
        expect(Object.hasOwn(experimental, 'setup')).toBe(true);
        expect(typeof experimental.setup).toBe('function');
    });

    test('Importação e criação do Cody não registram a rota; setup realiza o registro', async () => {
        const cody = createCody(app);
        expect(app.hasRoute({ method: 'GET', url: '/experimental/status' })).toBe(false);
        experimental.setup({ cody });
        expect(app.hasRoute({ method: 'GET', url: '/experimental/status' })).toBe(true);
        const response = await app.inject('/experimental/status');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.json()).toEqual(expectedStatus);
    });

    test('Carregador descobre o manifesto e inicializa a rota com Helmet', async () => {
        app.register(loadPlugins, { pluginsDir });
        await app.ready();
        const response = await app.inject('/experimental/status');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.json()).toEqual(expectedStatus);
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    });

    test.each([
        ['GET', '<h1>LAB-AIEDU - Backend funcionando!</h1>'],
        ['POST', '<h1>POST - Dados recebidos pelo LAB-AIEDU</h1>'],
        ['PUT', '<h1>PUT - Solicitacao de atualizacao recebida</h1>'],
        ['DELETE', '<h1>DELETE - Solicitacao de exclusao recebida</h1>']
    ])('Preserva %s / após o carregamento do plugin', async (method, html) => {
        app.register(loadPlugins, { pluginsDir });
        const response = await app.inject({
            method, url: '/', ...(method === 'POST' ? { payload: { nome: 'Ana' } } : {})
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toBe(html);
    });

    test('Setup funciona em duas aplicações independentes', async () => {
        const other = buildApp();
        try {
            experimental.setup({ cody: createCody(app) });
            expect(other.hasRoute({ method: 'GET', url: '/experimental/status' })).toBe(false);
            experimental.setup({ cody: createCody(other) });
            expect((await app.inject('/experimental/status')).json()).toEqual(expectedStatus);
            expect((await other.inject('/experimental/status')).json()).toEqual(expectedStatus);
        } finally {
            await other.close();
        }
    });

    test('buildApp sem carregador mantém a rota do plugin ausente', async () => {
        expect((await app.inject('/experimental/status')).statusCode).toBe(404);
    });

    test('Módulo, setup e handler funcionam sem disponibilizar require ou imports', async () => {
        const source = await fs.readFile(path.join(pluginDir, 'main.js'), 'utf8');
        const isolatedModule = { exports: {} };
        // Verificação isolada de dependências, sem sandbox no carregador de produção.
        runInNewContext(source, { module: isolatedModule, exports: isolatedModule.exports });
        const addRouter = jest.fn();
        expect(addRouter).not.toHaveBeenCalled();
        isolatedModule.exports.setup({ cody: { addRouter } });
        expect(addRouter).toHaveBeenCalledTimes(2);
        const [url, routes] = addRouter.mock.calls.find(([url]) => url === '/experimental/status');
        expect(url).toBe('/experimental/status');
        expect(Object.keys(routes)).toEqual(['GET']);
        await expect(routes.GET.handler()).resolves.toEqual(expectedStatus);
    });
});
