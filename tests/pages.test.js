const path = require('node:path');
const { buildApp } = require('../core/main');
const { createCody } = require('../core/cody');

function expectInternalError(response) {
    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toMatch(/^application\/json\b/);
    expect(response.json()).toEqual({ statusCode: 500, message: 'Erro interno do servidor.' });
}

describe('Páginas controladas pelo núcleo', () => {
    let app;
    let cody;

    beforeEach(() => {
        app = buildApp();
        cody = createCody(app);
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
        try {
            await app.close();
        } finally {
            jest.restoreAllMocks();
        }
    });

    test('Plugin real preserva JSON e fornece HTML sanitizado, Helmet e HEAD sem rede', async () => {
        const other = buildApp({ pluginsDir: path.resolve(__dirname, '..', 'Plugins') });
        try {
            const status = await other.inject('/experimental/status');
            expect(status.statusCode).toBe(200);
            expect(status.headers['content-type']).toMatch(/^application\/json\b/);
            expect(status.json()).toEqual({ plugin: 'experimental', status: 'ativo', version: '1.0.0' });

            const response = await other.inject('/experimental/pagina');
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
            expect(response.body).toMatch(/^<!DOCTYPE html>\s*<html lang="pt-BR">/);
            expect(response.body).toContain('<title>LAB-AIEDU</title>');
            expect(response.body).toMatch(/<\/head>\s*<body>[\s\S]*<\/body>\s*<\/html>$/);
            expect(response.body).toContain('<h1>Bem-vindo ao LAB-AIEDU!</h1>');
            expect(response.body).toContain('<p>Esta página foi criada pelo Plugin01.</p>');
            expect(response.body).toContain('<li>Caprinos</li>');
            expect(response.body).toContain('Testando a sanitização HTML.');
            expect(response.body).not.toMatch(/<script\b|Teste de XSS|\bonclick\s*=/i);
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['content-security-policy']).toContain("script-src 'self'");

            const head = await other.inject({ method: 'HEAD', url: '/experimental/pagina' });
            expect(head.statusCode).toBe(200);
            expect(head.headers['content-type']).toBe(response.headers['content-type']);
            expect(head.headers['x-content-type-options']).toBe('nosniff');
            expect(head.body).toBe('');
            expect(other.server.listening).toBe(false);
        } finally {
            await other.close();
        }
    });

    test.each([
        ['marcação permitida e texto Unicode', '<h1>Relatório</h1><p>João &amp; Ana</p>', '<h1>Relatório</h1><p>João &amp; Ana</p>'],
        ['fragmento vazio', '', ''],
        ['elemento e atributo proibidos', '<p onclick="void 0">Texto</p><script>MARCADOR_SCRIPT</script>', '<p>Texto</p>']
    ])('Renderiza GET sem schema de resposta com %s', async (_description, html, expected) => {
        cody.addRouter('/pagina', { GET: { handler: () => cody.newPage().out(html) } });

        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(response.body).toContain(`<body>\n${expected}\n</body>`);
    });

    test.each([
        ['documento completo', '<!doctype html><html><head><title>MARCADOR_TITULO</title><p>MARCADOR_HEAD</p></head><body><p>MARCADOR_BODY</p></body></html>'],
        ['title isolado', '<title>MARCADOR_TITULO</title><p>MARCADOR_BODY</p>'],
        ['head fechado implicitamente pelo body', '<head><title>MARCADOR_TITULO</title><body><p>MARCADOR_BODY</p>'],
        ['head sem fechamento reconhecível', '<p>MARCADOR_BODY</p><head><p>MARCADOR_HEAD'],
        ['title sem fechamento reconhecível', '<p>MARCADOR_BODY</p><title>MARCADOR_TITULO']
    ])('Preserva apenas o head e o title do núcleo para %s', async (_scenario, html) => {
        cody.addRouter('/pagina', { GET: { handler: () => cody.newPage().out(html) } });

        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(response.body.match(/<head>/gi)).toEqual(['<head>']);
        expect(response.body.match(/<title>[^<]*<\/title>/gi)).toEqual(['<title>LAB-AIEDU</title>']);
        expect(response.body).toContain('<body>\n<p>MARCADOR_BODY</p>\n</body>');
        expect(response.body).not.toMatch(/MARCADOR_HEAD|MARCADOR_TITULO/);
    });

    test.each([undefined, null, [], {}, 42, false])('Rejeita argumento não textual em out(): %p', async value => {
        cody.addRouter('/pagina', { GET: { handler: () => cody.newPage().out(value) } });

        expectInternalError(await app.inject('/pagina'));
    });

    test.each(['POST', 'PUT', 'DELETE'])('Recusa retorno de página em %s durante a requisição', async method => {
        const handler = jest.fn(() => cody.newPage().out('<p>Página</p>'));
        cody.addRouter('/pagina', { [method]: { handler } });

        expect(app.hasRoute({ method, url: '/pagina' })).toBe(true);
        expectInternalError(await app.inject({ method, url: '/pagina' }));
        expect(handler).toHaveReturned();
    });

    test('Recusa retorno de página em GET com schema de resposta durante a requisição', async () => {
        const handler = jest.fn(() => cody.newPage().out('<p>Página</p>'));
        cody.addRouter('/pagina', {
            GET: { handler, schema: { response: { 200: { type: 'object' } } } }
        });

        expect(app.hasRoute({ method: 'GET', url: '/pagina' })).toBe(true);
        expectInternalError(await app.inject('/pagina'));
        expect(handler).toHaveReturned();
    });

    test('Erro assíncrono produz JSON genérico sem expor detalhes internos', async () => {
        cody.addRouter('/pagina', { GET: { handler: async () => { throw new Error('SEGREDO_INTERNO'); } } });

        const response = await app.inject('/pagina');
        expectInternalError(response);
        expect(response.body).not.toContain('SEGREDO_INTERNO');
    });

    test('Fornece somente o argumento de dados ao handler de página', async () => {
        const handler = jest.fn(() => cody.newPage().out('<h1>Página legítima</h1>'));
        cody.addRouter('/pagina', { GET: { handler } });

        const response = await app.inject('/pagina');
        expect(response.statusCode).toBe(200);
        expect(response.body).toContain('<h1>Página legítima</h1>');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0]).toHaveLength(1);
        expect(handler.mock.calls[0][0]).toMatchObject({ method: 'GET' });

        const head = await app.inject({ method: 'HEAD', url: '/pagina' });
        expect(head.statusCode).toBe(200);
        expect(head.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(head.body).toBe('');
        expect(handler.mock.calls.map(([input]) => input.method)).toEqual(['GET', 'HEAD']);
    });


    test.each([100_000, 100_001])('Aplica limite de %i unidades ao fragmento via HTTP', async length => {
        const fragment = 'a'.repeat(length);
        const handler = jest.fn(() => cody.newPage().out(fragment));
        cody.addRouter('/limite-html', { GET: { handler } });

        const response = await app.inject('/limite-html');
        expect(handler).toHaveReturnedTimes(1);
        if (length === 100_000) {
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
            expect(response.body).toContain('<body>\n' + fragment + '\n</body>');
        } else {
            expectInternalError(response);
        }
    });

    test('Captura a elegibilidade quando registra cada rota', async () => {
        const handler = () => cody.newPage().out('<p>Conteúdo permitido</p>');
        const responseSchema = { 200: { type: 'object' } };
        const allowed = { handler, schema: {} };
        const denied = { handler, schema: { response: responseSchema } };

        cody.addRouter('/permitida', { GET: allowed });
        cody.addRouter('/restrita', { GET: denied });
        allowed.schema.response = responseSchema;
        delete denied.schema.response;

        const permitted = await app.inject('/permitida');
        expect(permitted.statusCode).toBe(200);
        expect(permitted.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(permitted.body).toContain('<p>Conteúdo permitido</p>');
        expectInternalError(await app.inject('/restrita'));
    });

    test('Aplica MIME HTML somente ao resultado reconhecido pela fachada', async () => {
        const other = buildApp();
        try {
            const fragment = '<p>Página declarativa</p>';
            const original = cody.newPage().out(fragment);
            const results = [
                ['original', original],
                ['mesma-app', createCody(app).newPage().out(fragment)],
                ['outra-app', createCody(other).newPage().out(fragment)],
                ['copia', { ...original }],
                ['objeto', {}]
            ];
            for (const [name, result] of results) {
                cody.addRouter('/pagina-' + name, { GET: { handler: () => result } });
            }

            const recognized = await app.inject('/pagina-original');
            expect(recognized.statusCode).toBe(200);
            expect(recognized.headers['content-type']).toBe('text/html; charset=utf-8');
            expect(recognized.body).toContain(fragment);

            for (const [name] of results.slice(1)) {
                const response = await app.inject('/pagina-' + name);
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.json()).toStrictEqual({});
            }
        } finally {
            await other.close();
        }
    });

    test.each([
        ['GET', 'text/html'],
        ['GET', 'TeXt/HtMl'],
        ['GET', 'text/html; charset=utf-8'],
        ['HEAD', 'TeXt/HtMl; charset=utf-8']
    ])('Bloqueia MIME %s %s fora do fluxo autorizado sem reenviar', async (method, mime) => {
        const hook = jest.fn((request, reply, _payload, done) => {
            if (request.url === '/mime') reply.type(mime);
            done();
        });
        app.addHook('onSend', hook);
        const handler = jest.fn(() => '<p>Marcação em texto simples</p>');
        cody.addRouter('/mime', { GET: { handler } });
        cody.addRouter('/autorizada', { GET: { handler: () => cody.newPage().out('<p>Autorizada</p>') } });

        const blocked = await app.inject({ method, url: '/mime' });
        expect(blocked.statusCode).toBe(500);
        expect(blocked.headers['content-type']).toMatch(/^application\/json(?:;|$)/);
        expect(blocked.headers['x-content-type-options']).toBe('nosniff');
        expect(handler.mock.calls.map(([input]) => input.method)).toEqual([method]);
        expect(hook).toHaveBeenCalledTimes(1);
        if (method === 'HEAD') expect(blocked.body).toBe('');
        else expectInternalError(blocked);

        const allowed = await app.inject('/autorizada');
        expect(allowed.statusCode).toBe(200);
        expect(allowed.headers['content-type']).toBe('text/html; charset=utf-8');
        expect(allowed.body).toContain('<p>Autorizada</p>');

        const native = await app.inject('/');
        expect(native.statusCode).toBe(200);
        expect(native.headers['content-type']).toMatch(/^text\/html\b/);
        expect(native.body).toContain('LAB-AIEDU - Backend funcionando!');
    });

    test('Mantém páginas e contadores independentes por aplicação', async () => {
        const other = buildApp();
        try {
            const otherCody = createCody(other);
            let counter = 0;
            let otherCounter = 0;
            cody.addRouter('/pagina', {
                GET: { handler: () => cody.newPage().out(`<h1>Primeira ${++counter}</h1>`) }
            });
            otherCody.addRouter('/pagina', {
                GET: { handler: () => otherCody.newPage().out(`<h1>Segunda ${++otherCounter}</h1>`) }
            });

            expect((await app.inject('/pagina')).body).toContain('<h1>Primeira 1</h1>');
            expect((await other.inject('/pagina')).body).toContain('<h1>Segunda 1</h1>');
            expect((await app.inject('/pagina')).body).toContain('<h1>Primeira 2</h1>');
            expect((await other.inject('/pagina')).body).toContain('<h1>Segunda 2</h1>');
        } finally {
            await other.close();
        }
    });
});
