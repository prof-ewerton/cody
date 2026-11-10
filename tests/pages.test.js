const path = require('node:path');
const fs = require('node:fs/promises');
const { buildApp } = require('../core/main');
const { createCody } = require('../core/cody');

describe('Páginas controladas pelo núcleo', () => {
    let app;
    beforeEach(() => { app = buildApp(); });
    afterEach(async () => { jest.restoreAllMocks(); await app.close(); });

    function page(handler, extra = {}) {
        createCody(app).addRouter('/pagina', { GET: { template: 'experimental', handler, ...extra } });
    }

    test('Plugin real preserva JSON e fornece HTML, CSS, Helmet e HEAD sem rede', async () => {
        const other = buildApp({ pluginsDir: path.resolve(__dirname, '..', 'Plugins') });
        try {
            const response = await other.inject('/experimental/pagina');
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
            expect(response.body).toContain('<h1>Plugin experimental</h1>');
            expect(response.body).toContain('<p>Plugin ativo no LAB-AIEDU.</p>');
            expect(response.body).toContain('href="/public/css/app.css"');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['content-security-policy']).toContain("script-src 'self'");
            const head = await other.inject({ method: 'HEAD', url: '/experimental/pagina' });
            expect(head.statusCode).toBe(200);
            expect(head.body).toBe('');
            expect((await other.inject('/experimental/status')).json()).toEqual({
                plugin: 'experimental', status: 'ativo', version: '1.0.0'
            });
            expect(other.server.listening).toBe(false);
        } finally { await other.close(); }
    });

    test.each([
        ['&<>"\'', '&amp;&lt;&gt;&quot;&#39;'],
        ['<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;'],
        ['<img src=x onerror="alert(1)">', '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'],
        ['{{mensagem}} ${process.exit()}', '{{mensagem}} ${process.exit()}'],
        ['', ''], ['João', 'João']
    ])('Escapa texto sem interpretar código ou placeholders: %s', async (titulo, escaped) => {
        page(async () => ({ titulo, mensagem: 'texto' }));
        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain(`<h1>${escaped}</h1>`);
        expect(response.body).toContain('<p>texto</p>');
    });

    test.each([undefined, null, [], 'texto', {}, { titulo: 'A' },
        { titulo: 1, mensagem: 'B' }, { titulo: 'A', mensagem: null },
        { titulo: 'A', mensagem: 'B', extra: true }, new Date(),
        Object.create({ titulo: 'A', mensagem: 'B' })
    ])('Dados inválidos produzem erro controlado: %p', async data => {
        page(async () => data);
        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe('Não foi possível produzir a página.');
        expect(response.body).not.toContain('não executar getter');
    });

    test('Rejeita getters sem executá-los', async () => {
        const getter = jest.fn(() => { throw new Error('não executar getter'); });
        const data = { mensagem: 'B' };
        Object.defineProperty(data, 'titulo', { get: getter, enumerable: true });
        page(async () => data);
        expect((await app.inject('/pagina')).statusCode).toBe(500);
        expect(getter).not.toHaveBeenCalled();
    });

    test('Aceita objeto simples sem protótipo', async () => {
        page(async () => Object.assign(Object.create(null), { titulo: 'A', mensagem: 'B' }));
        expect((await app.inject('/pagina')).statusCode).toBe(200);
    });

    test('Erro assíncrono não expõe informações internas', async () => {
        page(async () => { throw new Error('SEGREDO_INTERNO'); });
        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(500);
        expect(response.body).not.toContain('SEGREDO_INTERNO');
    });

    test('Não fornece reply ao handler de página', async () => {
        page(async (_request, reply) => reply.send('<script>perigo</script>'));
        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(500);
        expect(response.body).not.toContain('<script>');
    });

    test('Mantém páginas e dados independentes por aplicação', async () => {
        let counter = 0;
        page(async () => ({ titulo: String(++counter), mensagem: 'A' }));
        const other = buildApp();
        try {
            createCody(other).addRouter('/pagina', { GET: {
                template: 'experimental', handler: async () => ({ titulo: 'outra', mensagem: 'B' })
            } });
            expect((await app.inject('/pagina')).body).toContain('<h1>1</h1>');
            expect((await other.inject('/pagina')).body).toContain('<h1>outra</h1>');
            expect((await app.inject('/pagina')).body).toContain('<h1>2</h1>');
        } finally { await other.close(); }
    });

    test('Template obrigatório ausente impede ready', async () => {
        page(async () => ({ titulo: 'A', mensagem: 'B' }));
        const read = fs.readFile.bind(fs);
        jest.spyOn(fs, 'readFile').mockImplementation((file, ...args) => {
            if (file.endsWith('experimental.html')) return Promise.reject(new Error('template ausente'));
            return read(file, ...args);
        });
        await expect(app.ready()).rejects.toThrow('template ausente');
        expect(app.server.listening).toBe(false);
    });

    test.each(['fora', 'diretorio'])('Rejeita destino de template inválido: %s', async kind => {
        page(async () => ({ titulo: 'A', mensagem: 'B' }));
        const realpath = fs.realpath.bind(fs);
        const stat = fs.stat.bind(fs);
        if (kind === 'fora') {
            jest.spyOn(fs, 'realpath').mockImplementation(file => file.endsWith('experimental.html')
                ? Promise.resolve(path.resolve(__dirname, '..', 'package.json')) : realpath(file));
        } else {
            jest.spyOn(fs, 'stat').mockImplementation(file => file.endsWith('experimental.html')
                ? Promise.resolve({ isFile: () => false }) : stat(file));
        }
        await expect(app.ready()).rejects.toThrow('Template obrigatório');
        expect(app.server.listening).toBe(false);
    });
});
