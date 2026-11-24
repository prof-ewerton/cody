const { sanitizeHtml } = require('../core/html-sanitizer');

describe('Sanitização de HTML', () => {

    test('deve preservar tags HTML permitidas', () => {
        const entrada = '<h1>Relatório</h1><p>25 caprinos</p>';

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(entrada);
    });

    test('deve remover scripts perigosos', () => {
        const entrada = '<h1>Relatório</h1><script>alert(1)</script>';

        const esperado = '<h1>Relatório</h1>';

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(esperado);
    })

    test('deve rejeitar entradas que não sejam strings', () => {
    expect(() => sanitizeHtml(123)).toThrow(TypeError);
    });

    test('deve remover atributos de eventos HTML', () => {
    const entrada = '<p onclick="alert(1)">Olá!</p>';

    const esperado = '<p>Olá!</p>';

    const resultado = sanitizeHtml(entrada);

    expect(resultado).toBe(esperado);
    });

    test('deve remover imagens não autorizadas com onerror', () => {
    const entrada = '<p>Imagem:</p><img src="erro.png" onerror="alert(1)">';

    const esperado = '<p>Imagem:</p>';

    const resultado = sanitizeHtml(entrada);

    expect(resultado).toBe(esperado);
    });

    test('remover o atributo onmouseover', () => {
        const entrada = '<h2 onmouseover="alert(1)">Caprinocultura</h2>';

        const esperado = '<h2>Caprinocultura</h2>'

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(esperado);
        expect(resultado).not.toContain('onmouseover');
    })

    test('deve tratar HTML com tags não fechadas', () => {
    const entrada = '<p>Animais cadastrados';

    const esperado = '<p>Animais cadastrados</p>';

    const resultado = sanitizeHtml(entrada);

    expect(resultado).toBe(esperado);
    });

    test('deve sanitizar um documento HTML completo', () => {
    const entrada = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>MARCADOR_TITULO</title>
                <p>MARCADOR_HEAD</p>
                <script>alert(1)</script>
            </head>
            <body>
                <h1>Caprinocultura</h1>
                <p>Bem-vindo ao plugin.</p>
            </body>
        </html>
    `;

    const resultado = sanitizeHtml(entrada);

    expect(resultado).toContain('<h1>Caprinocultura</h1>');
    expect(resultado).toContain('<p>Bem-vindo ao plugin.</p>');
    expect(resultado).not.toContain('<script');
    expect(resultado).not.toContain('<head');
    expect(resultado).not.toContain('<body');
        expect(resultado).not.toContain('MARCADOR_TITULO');
        expect(resultado).not.toContain('MARCADOR_HEAD');
    });

    test.each([
        ['title isolado', '<title>DESCARTAR</title><p>Corpo</p>', '<p>Corpo</p>'],
        ['head com transição implícita para body', '<head><title>DESCARTAR</title><body><p>Corpo</p>', '<p>Corpo</p>'],
        ['head sem fechamento reconhecível', '<p>Corpo</p><head><p>DESCARTAR', '<p>Corpo</p>'],
        ['title sem fechamento reconhecível', '<p>Corpo</p><title>DESCARTAR<p>Também descartado', '<p>Corpo</p>'],
        ['fragmento comum', '<p>Corpo <strong>permitido</strong></p>', '<p>Corpo <strong>permitido</strong></p>']
    ])('Sanitiza %s', (_scenario, html, expected) => {
        expect(sanitizeHtml(html)).toBe(expected);
    });

    test.each(['script', 'style', 'textarea', 'option', 'xmp'])(
        'Mantém o descarte do conteúdo de %s', tag => {
            const html = '<p>Corpo</p><' + tag + '>DESCARTAR</' + tag + '><p>Fim</p>';
            expect(sanitizeHtml(html)).toBe('<p>Corpo</p><p>Fim</p>');
        }
    );

    test('deve remover um iframe não autorizado', () => {
        const entrada = '<p>Meu plugin</p><iframe src="https://exemplo.com"></iframe>';

        const esperado = '<p>Meu plugin</p>';

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(esperado);
    })

    test('deve rejeitar HTML acima do limite permitido', () => {
    const entrada = 'a'.repeat(100_001);

    expect(() => sanitizeHtml(entrada)).toThrow(RangeError);
    });

    test('deve aceitar HTML no tamanho máximo permitido', () => {
        const entrada = 'a'.repeat(100_000);

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(entrada)
    })

});
