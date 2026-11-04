const { buildApp } = require('../core/main');

describe('Testes dos métodos HTTP', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
    });

    afterEach(async () => {
        await app.close();
    });

    test('GET / deve retornar HTTP 200 e HTML', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/'
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('LAB-AIEDU');
    });


    test('POST / deve retornar HTTP 200 e HTML', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/',
            payload: {
                nome: 'Atividade de Learning Analytics'
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('POST');
    });

    test('PUT / deve retornar HTTP 200 e HTML', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/'
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('PUT');
    });

    test('DELETE / deve retornar HTTP 200 e HTML', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/'
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.body).toContain('DELETE');
    });

});
