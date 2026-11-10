const fs = require('node:fs/promises');
const path = require('node:path');

async function publicAssets(app) {
    const directory = await fs.realpath(path.join(__dirname, '..', 'public'));
    const file = await fs.realpath(path.join(directory, 'css', 'app.css'));
    const relative = path.relative(directory, file);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
        || !(await fs.stat(file)).isFile()) {
        throw new Error('CSS obrigatório fora do diretório autorizado ou inválido.');
    }
    const css = await fs.readFile(file, 'utf8');
    app.get('/public/css/app.css', async (_request, reply) => {
        return reply.type('text/css; charset=utf-8').send(css);
    });
}

module.exports = { publicAssets };
