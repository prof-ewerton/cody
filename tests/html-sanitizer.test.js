const { sanitizeHtml } = require('../core/html-sanitizer');

describe('Sanitização de HTML', () => {

    test('deve preservar tags HTML permitidas', () => {
        const entrada = '<h1>Relatório</h1><p>25 caprinos</p>';

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(entrada);
    });

    test('deve removere scripts perigosos', () => {
        const entrada = '<h1>Relatório</h1><script>alert(1)</script>';

        const esperado = '<h1>Relatório</h1>';

        const resultado = sanitizeHtml(entrada);

        expect(resultado).toBe(esperado);
    })

});