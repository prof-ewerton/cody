const fs = require('node:fs/promises');
const path = require('node:path');
const { createCody } = require('./cody');

function contextualError(phase, context, cause) {
    return new Error(`Plugin loader [${phase}] ${context}: ${cause?.message || String(cause)}`, { cause });
}

function parseVersion(version) {
    const match = typeof version === 'string'
        ? version.match(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)
        : null;
    if (!match || match[0] !== version) {
        throw new TypeError('version deve ter o formato major.minor.patch, sem prefixos, sufixos ou zeros à esquerda.');
    }
    const parts = match.slice(1).map(Number);
    if (!parts.every(Number.isSafeInteger)) {
        throw new TypeError('Os componentes de version devem ser inteiros seguros.');
    }
    return parts;
}

function validateManifest(manifest) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
        || Object.keys(manifest).sort().join(',') !== 'entry,id,version') {
        throw new TypeError('manifest.json deve conter exatamente id, version e entry.');
    }
    if (typeof manifest.id !== 'string' || manifest.id !== manifest.id.trim()
        || !/^[a-z][a-z0-9-]*$/.test(manifest.id)) {
        throw new TypeError('id deve iniciar por letra minúscula e conter somente letras ASCII minúsculas, números ou hífens.');
    }
    parseVersion(manifest.version);
    const entry = manifest.entry;
    if (typeof entry !== 'string' || !entry || path.posix.isAbsolute(entry) || path.win32.isAbsolute(entry)
        || /[\\:\u0000-\u001f\u007f]/u.test(entry)
        || entry.split('/').some(segment => !segment || segment === '.' || segment === '..')
        || !['.js', '.cjs'].includes(path.extname(entry))) {
        throw new TypeError('entry deve ser um caminho relativo .js ou .cjs, sem segmentos relativos ou separadores ambíguos.');
    }
}

function assertInside(directory, target) {
    const relative = path.relative(directory, target);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`O caminho ${target} deve permanecer dentro de ${directory}.`);
    }
}

async function resolveFile(directory, relative) {
    const lexical = path.resolve(directory, relative);
    assertInside(directory, lexical);
    const real = await fs.realpath(lexical);
    assertInside(directory, real);
    if (!(await fs.stat(real)).isFile()) {
        throw new TypeError(`O caminho ${relative} deve apontar para um arquivo regular.`);
    }
    return real;
}

async function discoverCandidates(pluginsDir) {
    let root;
    let entries;
    try {
        if (typeof pluginsDir !== 'string' || !path.isAbsolute(pluginsDir)) {
            throw new TypeError('pluginsDir deve ser um caminho absoluto explícito.');
        }
        root = await fs.realpath(pluginsDir);
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
        throw contextualError('descoberta', String(pluginsDir), error);
    }

    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    const candidates = [];
    for (const entry of entries) {
        let context = path.join(root, entry.name);
        try {
            if (entry.isSymbolicLink()) {
                throw new Error('Links simbólicos não são aceitos como candidatos na raiz.');
            }
            if (!entry.isDirectory()) continue;
            const directory = await fs.realpath(context);
            assertInside(root, directory);
            if ((await fs.readdir(directory)).length === 0) continue;
            const manifestPath = await resolveFile(directory, 'manifest.json');
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            validateManifest(manifest);
            context = `${manifest.id}@${manifest.version} (${directory})`;
            const entryPath = await resolveFile(directory, manifest.entry);
            candidates.push({ ...manifest, directory, entryPath });
        } catch (error) {
            throw contextualError('validação', context, error);
        }
    }
    return candidates;
}

// Função pura: seleciona metadados sem importar código dos candidatos.
function selectLatestVersions(candidates) {
    const selected = new Map();
    const seen = new Set();
    for (const candidate of candidates) {
        const parts = parseVersion(candidate.version);
        const key = `${candidate.id}@${candidate.version}`;
        if (seen.has(key)) throw new Error(`ID e versão duplicados: ${key}.`);
        seen.add(key);
        const current = selected.get(candidate.id);
        const comparison = current ? parts.map((part, index) => part - current.parts[index]).find(value => value !== 0) : 1;
        if (!current || comparison > 0) selected.set(candidate.id, { candidate, parts });
    }
    return [...selected.values()].map(value => value.candidate)
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Uso suportado: app.register(loadPlugins, { pluginsDir }), durante o bootstrap.
async function loadPlugins(app, options = {}) {
    let cody;
    try {
        // after() rejeita bootstrap já concluído, mesmo quando addHook(onReady) não rejeita.
        // Apenas agenda a barreira: aguardá-la aqui bloquearia o próprio plugin atual.
        app.after((error, done) => done(error));
        // O hook do Cody precisa ser instalado antes de qualquer leitura ou require.
        cody = createCody(app);
    } catch (error) {
        throw contextualError('ciclo de vida', 'inicialização do Cody', error);
    }
    const candidates = await discoverCandidates(options.pluginsDir);
    let selected;
    try {
        selected = selectLatestVersions(candidates);
    } catch (error) {
        throw contextualError('seleção', options.pluginsDir, error);
    }

    const loaded = [];
    for (const candidate of selected) {
        const context = `${candidate.id}@${candidate.version} (${candidate.directory})`;
        try {
            const plugin = require(candidate.entryPath);
            if (!plugin || !Object.hasOwn(plugin, 'setup') || typeof plugin.setup !== 'function') {
                throw new TypeError('O módulo deve exportar uma propriedade própria setup do tipo função.');
            }
            loaded.push({ candidate, plugin, setup: plugin.setup });
        } catch (error) {
            throw contextualError('carregamento', context, error);
        }
    }

    // Todas as exportações são verificadas antes de iniciar o primeiro setup.
    for (const { candidate, plugin, setup } of loaded) {
        try {
            await setup.call(plugin, { cody });
        } catch (error) {
            throw contextualError('setup', `${candidate.id}@${candidate.version} (${candidate.directory})`, error);
        }
    }
}

module.exports = { loadPlugins, selectLatestVersions };
