const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { buildApp } = require('../core/main');
const { loadPlugins, selectLatestVersions } = require('../core/plugin-loader');

describe('Carregador de plugins', () => {
    let temporary;
    let root;
    let eventFile;
    let app;
    let apps;

    beforeEach(async () => {
        temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-aiedu-loader-'));
        root = path.join(temporary, 'Plugins');
        eventFile = path.join(temporary, 'events.txt');
        await fs.mkdir(root);
        app = buildApp();
        apps = [app];
    });

    afterEach(async () => {
        try { await Promise.all(apps.map(instance => instance.close())); }
        finally { await fs.rm(temporary, { recursive: true, force: true }); }
    });

    async function plugin(folder, overrides = {}, source = 'exports.setup = () => {};') {
        const directory = path.join(root, folder);
        await fs.mkdir(directory, { recursive: true });
        const manifest = { id: 'experimental', version: '1.0.0', entry: 'main.cjs', ...overrides };
        await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
        // O arquivo padrão permite testar entradas inválidas sem escrevê-las fora da pasta.
        await fs.writeFile(path.join(directory, 'main.cjs'), source);
        return directory;
    }

    function record(label) {
        return `require('node:fs').appendFileSync(${JSON.stringify(eventFile)}, ${JSON.stringify(label + '\n')});`;
    }

    async function events() {
        try { return (await fs.readFile(eventFile, 'utf8')).trim().split('\n'); }
        catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    }

    function register(directory = root, instance = app) {
        instance.register(loadPlugins, { pluginsDir: directory });
        return instance.ready();
    }

    describe('Manifestos e descoberta', () => {
        test('Carrega manifesto válido e registra rota pelo config.cody', async () => {
            await plugin('valid', {}, `exports.setup = ({cody}) => {
                cody.addRouter('/experimental', {GET: {handler: async () => ({ok: true})}});
            };`);
            await register();
            const response = await app.inject('/experimental');
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ ok: true });
        });

        test('Ignora arquivos comuns na raiz e diretórios vazios, sem busca recursiva', async () => {
            await fs.writeFile(path.join(root, 'notas.txt'), 'preparação');
            await fs.mkdir(path.join(root, 'vazio'));
            await expect(register()).resolves.toBeDefined();
            expect(await events()).toEqual([]);
        });

        test('Rejeita diretório não vazio sem manifesto, sem descobrir plugins aninhados', async () => {
            await fs.mkdir(path.join(root, 'externo', 'interno'), { recursive: true });
            await fs.writeFile(path.join(root, 'externo', 'interno', 'manifest.json'), '{}');
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[validação]'), cause: expect.objectContaining({ code: 'ENOENT' })
            });
        });

        test.each([undefined, 'Plugins', '/caminho-lab-aiedu-que-nao-existe'])('Rejeita raiz inválida: %p', async (directory) => {
            app.register(loadPlugins, { pluginsDir: directory });
            await expect(app.ready()).rejects.toThrow(/\[descoberta\]/);
        });

        test('Rejeita arquivo como raiz', async () => {
            const file = path.join(temporary, 'arquivo');
            await fs.writeFile(file, 'não é diretório');
            await expect(register(file)).rejects.toThrow(/\[descoberta\]/);
        });

        test.each([
            null, [], 'manifesto', {},
            { id: 'experimental', version: '1.0.0' },
            { id: 'experimental', version: '1.0.0', entry: 'main.cjs', extra: true }
        ])('Rejeita estrutura de manifesto inválida: %p', async (manifest) => {
            const directory = await plugin('invalid');
            await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
            await expect(register()).rejects.toThrow(/exatamente id, version e entry/);
        });

        test('Rejeita JSON malformado preservando SyntaxError como causa', async () => {
            const directory = await plugin('invalid');
            await fs.writeFile(path.join(directory, 'manifest.json'), '{');
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[validação]'), cause: expect.any(SyntaxError)
            });
        });

        test.each(['Experimental', '1plugin', 'a_b', 'á', '', 'a\n', 123])('Rejeita ID inválido: %p', async (id) => {
            await plugin('invalid', { id });
            await expect(register()).rejects.toThrow(/id deve iniciar/);
        });

        test.each(['1.0', 'v1.0.0', '01.0.0', '1.00.0', '1.0.01', '-1.0.0',
            '1.0.0-beta', '1.0.0+build', '1.0.0\n', '9007199254740992.0.0', 123])('Rejeita versão inválida: %p', async (version) => {
            await plugin('invalid', { version });
            await expect(register()).rejects.toThrow(/version/);
        });

        test('Valida todos os candidatos antes de carregar qualquer módulo', async () => {
            await plugin('a-valido', { id: 'a' }, record('carregou') + 'exports.setup = () => {};');
            await plugin('z-invalido', { id: 'z', entry: 'ausente.cjs' });
            await expect(register()).rejects.toThrow(/\[validação\]/);
            expect(await events()).toEqual([]);
        });

        test('Valida também a entrada de uma versão que seria descartada', async () => {
            await plugin('antigo', { version: '0.1.0', entry: 'ausente.cjs' });
            await plugin('novo', { version: '1.0.0' }, record('carregou') + 'exports.setup = () => {};');
            await expect(register()).rejects.toThrow(/experimental@0.1.0/);
            expect(await events()).toEqual([]);
        });
    });

    describe('Seleção numérica e determinística', () => {
        test('Seleciona por major, minor e patch independentemente da ordem', () => {
            const candidates = [
                { id: 'b', version: '1.9.0' }, { id: 'a', version: '1.0.9' },
                { id: 'b', version: '1.10.0' }, { id: 'a', version: '1.0.10' },
                { id: 'c', version: '1.99.99' }, { id: 'c', version: '2.0.0' }
            ];
            const expected = [candidates[3], candidates[2], candidates[5]];
            expect(selectLatestVersions(candidates)).toEqual(expected);
            expect(selectLatestVersions([...candidates].reverse())).toEqual(expected);
            expect(selectLatestVersions([])).toEqual([]);
        });

        test('Aceita versão zero e componentes no limite de inteiro seguro', () => {
            expect(selectLatestVersions([
                { id: 'a', version: '0.0.0' }, { id: 'a', version: '9007199254740991.0.0' }
            ])).toEqual([{ id: 'a', version: '9007199254740991.0.0' }]);
        });

        test('Rejeita duplicação exata mesmo de uma versão antiga', async () => {
            await plugin('a', { version: '0.1.0' }, record('carregou') + 'exports.setup = () => {};');
            await plugin('b', { version: '0.1.0' });
            await plugin('c', { version: '1.0.0' });
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[seleção]'), cause: expect.objectContaining({ message: expect.stringContaining('experimental@0.1.0') })
            });
            expect(await events()).toEqual([]);
        });

        test('Não carrega nem executa versão descartada', async () => {
            await plugin('z-antigo', { version: '1.9.0' }, "throw new Error('VERSAO_DESCARTADA_CARREGADA');");
            await plugin('a-novo', { version: '1.10.0' }, record('novo-carregado') + `exports.setup = () => {${record('novo-setup')}};`);
            await register();
            expect(await events()).toEqual(['novo-carregado', 'novo-setup']);
        });

        test('Não faz fallback quando a versão selecionada falha', async () => {
            await plugin('antigo', { version: '1.0.0' }, record('antigo') + 'exports.setup = () => {};');
            await plugin('novo', { version: '2.0.0' }, "throw new Error('falha selecionada');");
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('experimental@2.0.0'), cause: expect.objectContaining({ message: 'falha selecionada' })
            });
            expect(await events()).toEqual([]);
        });
    });

    describe('Entradas e links simbólicos', () => {
        test.each(['../fora.cjs', 'sub/../../fora.cjs', '/tmp/fora.cjs', 'C:\\fora.cjs',
            'C:fora.cjs', '\\\\servidor\\fora.cjs', 'sub\\main.cjs', 'file:///tmp/fora.cjs',
            'main.mjs', 'main.txt', 'main.cjs\n', './main.cjs', '', null, 42])('Rejeita entrada inválida: %p', async (entry) => {
            await plugin('invalid', { entry });
            await expect(register()).rejects.toThrow(/entry deve ser/);
        });

        test.each(['ausente.cjs', 'diretorio.cjs'])('Rejeita entrada inexistente ou diretório: %s', async (entry) => {
            const directory = await plugin('invalid', { entry });
            if (entry === 'diretorio.cjs') await fs.mkdir(path.join(directory, entry));
            await expect(register()).rejects.toThrow(/\[validação\]/);
        });

        test('Aceita entrada .js em subpasta e import relativo interno', async () => {
            const directory = await plugin('valid', { entry: 'src/main.js' });
            await fs.mkdir(path.join(directory, 'src'));
            await fs.writeFile(path.join(directory, 'src', 'helper.cjs'), "module.exports = 'interno';");
            await fs.writeFile(path.join(directory, 'src', 'main.js'), `const value = require('./helper.cjs');
                exports.setup = ({cody}) => cody.addRouter('/interno', {GET:{handler: async () => value}});`);
            await register();
            expect((await app.inject('/interno')).body).toBe('interno');
        });

        test('Rejeita pasta candidata que seja link simbólico', async () => {
            const outside = path.join(temporary, 'externo');
            await fs.mkdir(outside);
            await fs.symlink(outside, path.join(root, 'link'), 'dir');
            await expect(register()).rejects.toThrow(/Links simbólicos/);
        });

        test.each(['entry', 'manifest'])('Rejeita escape por link simbólico no %s', async (target) => {
            const directory = await plugin('invalid', { entry: 'link.cjs' });
            const outside = path.join(temporary, target === 'entry' ? 'externo.cjs' : 'externo.json');
            await fs.writeFile(outside, target === 'entry' ? record('não executar') : JSON.stringify({ id: 'a', version: '1.0.0', entry: 'main.cjs' }));
            const link = path.join(directory, target === 'entry' ? 'link.cjs' : 'manifest.json');
            if (target === 'manifest') await fs.unlink(link);
            await fs.symlink(outside, link);
            await expect(register()).rejects.toThrow(/deve permanecer dentro/);
            expect(await events()).toEqual([]);
        });

        test('Rejeita link para diretório vizinho com prefixo textual semelhante', async () => {
            const directory = await plugin('plugin', { entry: 'link.cjs' });
            const sibling = path.join(root, 'plugin-outro');
            await fs.mkdir(sibling);
            await fs.writeFile(path.join(sibling, 'fora.cjs'), 'exports.setup = () => {};');
            await fs.symlink(path.join(sibling, 'fora.cjs'), path.join(directory, 'link.cjs'));
            await expect(register()).rejects.toThrow(/deve permanecer dentro/);
        });

        test('Aceita link de entrada cujo destino continua dentro da pasta', async () => {
            const directory = await plugin('valid', { entry: 'link.cjs' });
            await fs.symlink(path.join(directory, 'main.cjs'), path.join(directory, 'link.cjs'));
            await expect(register()).resolves.toBeDefined();
        });
    });

    describe('Exportações, setups e falhas', () => {
        test.each(['module.exports = null;', 'module.exports = {};', 'exports.setup = 123;',
            'module.exports = Object.create({setup() {}});'])('Rejeita exportação inválida: %s', async (source) => {
            await plugin('invalid', {}, source);
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[carregamento]'), cause: expect.any(TypeError)
            });
        });

        test('Verifica todas as exportações antes do primeiro setup', async () => {
            await plugin('primeiro', { id: 'a' }, record('load-a') + `exports.setup = () => {${record('setup-a')}};`);
            await plugin('ultimo', { id: 'z' }, record('load-z') + 'module.exports = {};');
            await expect(register()).rejects.toThrow(/setup do tipo função/);
            expect(await events()).toEqual(['load-a', 'load-z']);
        });

        test('Aguarda setup assíncrono e executa sequencialmente por ID, não por pasta', async () => {
            await plugin('a-pasta', { id: 'z' }, record('load-z') + `exports.setup = () => {${record('setup-z')}};`);
            await plugin('z-pasta', { id: 'a' }, record('load-a') + `exports.setup = async ({cody}) => {
                ${record('setup-a-inicio')}
                await new Promise(resolve => setImmediate(resolve));
                cody.addRouter('/async', {GET: {handler: async () => 'pronto'}});
                ${record('setup-a-fim')}
            };`);
            await register();
            expect(await events()).toEqual(['load-a', 'load-z', 'setup-a-inicio', 'setup-a-fim', 'setup-z']);
            expect((await app.inject('/async')).body).toBe('pronto');
        });

        test.each(['() => { throw new Error("falha setup"); }', 'async () => { throw new Error("falha setup"); }'])('Interrompe setups e preserva erro: %s', async (setup) => {
            await plugin('primeiro', { id: 'a' }, `exports.setup = ${setup};`);
            await plugin('ultimo', { id: 'z' }, `exports.setup = () => {${record('não executar')}};`);
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[setup] a@1.0.0'), cause: expect.objectContaining({ message: 'falha setup' })
            });
            expect(await events()).toEqual([]);
        });

        test('Propaga conflito de rota do Cody com o núcleo', async () => {
            await plugin('conflito', {}, "exports.setup = ({cody}) => cody.addRouter('/', {GET:{handler: async () => 'outro'}});");
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[setup]'), cause: expect.objectContaining({ message: expect.stringContaining('conflito') })
            });
        });

        test('Preserva também valores lançados que não sejam Error', async () => {
            await plugin('invalid', {}, 'exports.setup = () => { throw null; };');
            await expect(register()).rejects.toMatchObject({
                message: expect.stringContaining('[setup] experimental@1.0.0'), cause: null
            });
        });
    });

    describe('Fastify: encapsulamento, segurança, ciclo de vida e isolamento', () => {
        test('Preserva configurações globais e guarda do Cody no escopo nativo', async () => {
            await plugin('valid', {}, `exports.setup = ({cody}) => {
                cody.addRouter('/seguro', {POST:{
                    schema: {body: {type:'object', required:['nome'], additionalProperties:false, properties:{nome:{type:'string'}}}},
                    handler: async () => ({ok:true})
                }});
                cody.addRouter('/tentar-tarde', {GET:{handler: async () => {
                    try { cody.addRouter('/tarde', {GET:{handler: async () => 'não registrar'}}); }
                    catch (error) { return {erro:error.message}; }
                }}});
            };`);
            let child;
            app.register(async function scope(instance) {
                child = instance;
                instance.decorate('apenasEscopo', true);
                instance.register(loadPlugins, { pluginsDir: root });
            });
            await app.ready();
            expect(app.hasDecorator('apenasEscopo')).toBe(false);
            expect(child.hasDecorator('apenasEscopo')).toBe(true);
            const valid = await app.inject({ method: 'POST', url: '/seguro', payload: { nome: 'Ana' } });
            expect(valid.statusCode).toBe(200);
            expect(valid.headers['x-content-type-options']).toBe('nosniff');
            expect(valid.headers['content-security-policy']).toContain("script-src 'self'");
            for (const payload of [{ nome: 123 }, { nome: 'Ana', extra: true }]) {
                expect((await app.inject({ method: 'POST', url: '/seguro', payload })).statusCode).toBe(400);
            }
            expect((await app.inject({ method: 'POST', url: '/seguro', payload: { nome: 'A'.repeat(2000) } })).statusCode).toBe(413);
            expect((await app.inject('/tentar-tarde')).json().erro).toContain('fase de registro foi encerrada');
            expect((await app.inject('/tarde')).statusCode).toBe(404);
        });

        test.each(['ready', 'inject'])('Rejeita registro e chamada direta tardios após %s antes de executar módulos', async (initialize) => {
            await plugin('valid', {}, record('não carregar') + 'exports.setup = () => {};');
            if (initialize === 'ready') await app.ready();
            else await app.inject('/');
            expect(() => app.register(loadPlugins, { pluginsDir: root })).toThrow();
            await expect(loadPlugins(app, { pluginsDir: root })).rejects.toThrow(/\[ciclo de vida\]/);
            expect(await events()).toEqual([]);
        });

        test('Executa setup por aplicação, preservando cache CommonJS e estado local independente', async () => {
            await plugin('valid', {}, record('módulo') + `exports.setup = ({cody}) => {
                ${record('setup')}
                let counter = 0;
                cody.addRouter('/contador', {GET:{handler: async () => ({counter: ++counter})}});
            };`);
            const other = buildApp();
            apps.push(other);
            await register();
            await register(root, other);
            expect(await events()).toEqual(['módulo', 'setup', 'setup']);
            expect((await app.inject('/contador')).json()).toEqual({ counter: 1 });
            expect((await app.inject('/contador')).json()).toEqual({ counter: 2 });
            expect((await other.inject('/contador')).json()).toEqual({ counter: 1 });
        });
    });
});
