const fs = require('node:fs/promises');
const path = require('node:path');

function validateTemplate(template) {
    if (template !== 'experimental') {
        throw new TypeError('Cody: template desconhecido; somente experimental é autorizado.');
    }
}

function escapeHtml(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return value.replace(/[&<>"']/g, character => entities[character]);
}

function createPageRenderer(app) {
    let template;
    app.addHook('onReady', async () => {
        const directory = await fs.realpath(path.join(__dirname, '..', 'templates'));
        const file = await fs.realpath(path.join(directory, 'experimental.html'));
        if (path.dirname(file) !== directory || !(await fs.stat(file)).isFile()) {
            throw new Error('Template obrigatório fora do diretório autorizado ou inválido.');
        }
        template = await fs.readFile(file, 'utf8');
    });

    return function renderPage(data) {
        if (data === null || typeof data !== 'object'
            || ![Object.prototype, null].includes(Object.getPrototypeOf(data))
            || Reflect.ownKeys(data).length !== 2) {
            throw new TypeError('Página exige objeto simples com titulo e mensagem.');
        }
        const values = Object.create(null);
        for (const field of ['titulo', 'mensagem']) {
            const descriptor = Object.getOwnPropertyDescriptor(data, field);
            if (!descriptor || typeof descriptor.value !== 'string') {
                throw new TypeError(`Campo de texto obrigatório: ${field}.`);
            }
            values[field] = escapeHtml(descriptor.value);
        }
        // Somente dois marcadores fixos, em texto HTML; valores não são reprocessados.
        return template.replace(/{{(titulo|mensagem)}}/g, (_match, field) => values[field]);
    };
}

module.exports = { validateTemplate, createPageRenderer };
