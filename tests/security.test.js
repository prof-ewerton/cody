
const { buildApp } = require('../core/main');

describe('Testes de segurança do LAB-AIEDU', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
    });

    afterEach(async () => {
        await app.close();
    });

    test('Helmet deve adicionar cabeçalhos de segurança', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/'
        });

        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['content-security-policy']).toBeDefined();
    });

    test('Deve rejeitar requisições acima de 1 KiB', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload: {
                nome: 'A'.repeat(2000)
            }
        });

        expect(response.statusCode).toBe(413);
    });

    test('Deve rejeitar nome com tipo incorreto', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload: {
                nome: 12345
            }
        });

        expect(response.statusCode).toBe(400);
    });

    test('Deve rejeitar POST sem campo obrigatório', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload: {}
        });

        expect(response.statusCode).toBe(400);
    });
    describe('Validação do contrato de entrada', () => {
        test.each([1, 99, 100])('Deve aceitar nome com %i caracteres', async (length) => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                payload: { nome: 'A'.repeat(length) }
            });

            expect(response.statusCode).toBe(200);
        });

        test.each([0, 101])('Deve rejeitar nome com %i caracteres', async (length) => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                payload: { nome: 'A'.repeat(length) }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().code).toBe('FST_ERR_VALIDATION');
        });

        test.each([
            ['booleano', true],
            ['null', null],
            ['array', ['Ana']],
            ['objeto', { valor: 'Ana' }]
        ])('Deve rejeitar nome do tipo %s', async (_type, nome) => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                payload: { nome }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().code).toBe('FST_ERR_VALIDATION');
        });

        test.each([
            ['string', 'extra'],
            ['número', 123],
            ['booleano', false],
            ['null', null],
            ['array', []],
            ['objeto', {}]
        ])('Deve rejeitar propriedade adicional com valor %s', async (_type, extra) => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                payload: { nome: 'Ana', extra }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().code).toBe('FST_ERR_VALIDATION');
        });

        test.each([
            ['um espaço', ' '],
            ['texto Unicode', 'João']
        ])('Deve aceitar nome contendo %s', async (_description, nome) => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                payload: { nome }
            });

            expect(response.statusCode).toBe(200);
        });

        test('Deve rejeitar JSON malformado', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                headers: { 'content-type': 'application/json' },
                payload: '{"nome":'
            });

            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toContain('application/json');
            expect(response.json().code).toBe('FST_ERR_CTP_INVALID_JSON_BODY');
        });

        test('Deve rejeitar POST sem corpo com HTTP 400', async () => {
            const response = await app.inject({ method: 'POST', url: '/' });

            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toContain('application/json');
            expect(response.json().code).toBe('FST_ERR_VALIDATION');
        });

        test.each([
            [1024, 200],
            [1025, 413]
        ])('Corpo de %i bytes deve retornar HTTP %i', async (bytes, statusCode) => {
            const json = JSON.stringify({ nome: 'João' });
            // Espaços após o JSON ajustam os bytes sem invalidar o nome.
            const payload = json + ' '.repeat(bytes - Buffer.byteLength(json, 'utf8'));
            expect(Buffer.byteLength(payload, 'utf8')).toBe(bytes);

            const response = await app.inject({
                method: 'POST',
                url: '/',
                headers: { 'content-type': 'application/json' },
                payload
            });

            expect(response.statusCode).toBe(statusCode);
            if (statusCode === 413) {
                expect(response.json().code).toBe('FST_ERR_CTP_BODY_TOO_LARGE');
            }
        });
    });

    describe('Ausência de reflexão de entradas nas respostas', () => {
        test.each([
            ['HTML', '<b>LAB_XSS_HTML</b>', 'LAB_XSS_HTML'],
            ['atributo', '\"><span onmouseover="void 0">LAB_XSS_ATTR</span>', 'LAB_XSS_ATTR'],
            ['script', '<script>/* LAB_XSS_SCRIPT */</script>', 'LAB_XSS_SCRIPT']
        ])('Não deve refletir marcador de %s enviado em nome', async (_context, nome, marker) => {
            const response = await app.inject({
                method: 'POST',
                url: '/',
                payload: { nome }
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/html');
            expect(response.body).toBe('<h1>POST - Dados recebidos pelo LAB-AIEDU</h1>');
            expect(response.body).not.toContain(marker);
        });

        test('Não deve refletir marcador enviado na query string do GET', async () => {
            const marker = 'LAB_XSS_QUERY';
            const value = `<b>${marker}</b>`;
            const response = await app.inject({
                method: 'GET',
                url: `/?nome=${encodeURIComponent(value)}`
            });

            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/html');
            expect(response.body).toBe('<h1>LAB-AIEDU - Backend funcionando!</h1>');
            expect(response.body).not.toContain(marker);
        });

        test.each([
            ['nome acima do limite', { nome: '<b>LAB_XSS_ERROR</b>' + 'A'.repeat(101) }],
            ['propriedade adicional', { nome: '<b>LAB_XSS_ERROR</b>', extra: true }]
        ])('Não deve refletir valor de nome na resposta de validação: %s', async (_description, payload) => {
            const response = await app.inject({ method: 'POST', url: '/', payload });

            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toContain('application/json');
            expect(response.json().code).toBe('FST_ERR_VALIDATION');
            expect(response.body).not.toContain('LAB_XSS_ERROR');
        });
    });

    test.each(['GET', 'POST'])('Helmet deve preservar a política de segurança em %s', async (method) => {
        const response = await app.inject({
            method,
            url: '/',
            ...(method === 'POST' ? { payload: { nome: 'Ana' } } : {})
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['referrer-policy']).toBe('no-referrer');

        const csp = response.headers['content-security-policy'];
        expect(typeof csp).toBe('string');
        // Compara diretivas e tokens, sem depender da ordem na string da CSP.
        const directives = new Map(csp.split(';').filter(part => part.trim()).map(part => {
            const [name, ...values] = part.trim().split(/\s+/);
            return [name, values];
        }));

        expect(directives.get('default-src')).toEqual(["'self'"]);
        expect(directives.get('script-src')).toEqual(["'self'"]);
        expect(directives.get('script-src-attr')).toEqual(["'none'"]);
        expect(directives.get('object-src')).toEqual(["'none'"]);
        expect(directives.get('frame-ancestors')).toEqual(["'self'"]);
    });
});
