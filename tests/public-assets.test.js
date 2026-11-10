const fs = require('node:fs/promises');
const path = require('node:path');
const { buildApp } = require('../core/main');

describe('Recursos públicos autorizados', () => {
    let app;
    beforeEach(() => { app = buildApp(); });
    afterEach(async () => { jest.restoreAllMocks(); await app.close(); });

    test('Entrega somente o CSS conhecido, com MIME, Helmet e HEAD', async () => {
        const response = await app.inject('/public/css/app.css');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/css; charset=utf-8');
        expect(response.body).toBe(await fs.readFile(path.resolve(__dirname, '..', 'public/css/app.css'), 'utf8'));
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['content-security-policy']).toBeDefined();
        const head = await app.inject({ method: 'HEAD', url: '/public/css/app.css' });
        expect(head.statusCode).toBe(200);
        expect(head.body).toBe('');
        expect(app.server.listening).toBe(false);
    });

    test.each(['/public/', '/public/css/outro.css', '/public/main.js', '/templates/experimental.html',
        '/public/../package.json', '/public/%2e%2e/package.json',
        '/public/css/../../../core/main.js', '/public/css/%2e%2e%2f%2e%2e%2fpackage.json',
        '/public/css/..%5c..%5cpackage.json'])('Não publica %s', async url => {
        expect((await app.inject(url)).statusCode).toBe(404);
    });

    test('Arquivo obrigatório ausente impede inicialização', async () => {
        const realpath = fs.realpath.bind(fs);
        jest.spyOn(fs, 'realpath').mockImplementation(file => file.endsWith('app.css')
            ? Promise.reject(new Error('CSS ausente')) : realpath(file));
        await expect(app.ready()).rejects.toThrow('CSS ausente');
        expect(app.server.listening).toBe(false);
    });

    test.each(['fora', 'diretorio'])('Rejeita destino de CSS inválido: %s', async kind => {
        const realpath = fs.realpath.bind(fs);
        if (kind === 'fora') {
            jest.spyOn(fs, 'realpath').mockImplementation(file => file.endsWith('app.css')
                ? Promise.resolve(path.resolve(__dirname, '..', 'package.json')) : realpath(file));
        } else {
            jest.spyOn(fs, 'stat').mockResolvedValue({ isFile: () => false });
        }
        await expect(app.ready()).rejects.toThrow('CSS obrigatório');
        expect(app.server.listening).toBe(false);
    });
});
