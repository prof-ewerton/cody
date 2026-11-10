const { validateTemplate, createPageRenderer } = require('./page-renderer');

function isPlainObject(value) {
    if (value === null || typeof value !== 'object') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function validatePath(path) {
    if (typeof path !== 'string' || !path.startsWith('/') || /[\s\u0000-\u001f\u007f]/u.test(path)) {
        throw new TypeError('Cody: o caminho deve iniciar por / e não conter espaços ou caracteres de controle.');
    }
    if (path === '/') return;

    const parameters = new Set();
    for (const segment of path.slice(1).split('/')) {
        if (segment.startsWith(':')) {
            if (!/^:[A-Za-z_][A-Za-z0-9_]*$/.test(segment) || parameters.has(segment)) {
                throw new TypeError(`Cody: parâmetro inválido ou repetido no caminho ${path}.`);
            }
            parameters.add(segment);
        } else if (segment === '.' || segment === '..' || !/^[\p{L}\p{N}._~-]+$/u.test(segment)) {
            throw new TypeError(`Cody: caminho inválido ${path}; use segmentos estáticos ou parâmetros simples.`);
        }
    }
}

function createCody(app) {
    if (!app || typeof app.route !== 'function' || typeof app.hasRoute !== 'function' || typeof app.addHook !== 'function') {
        throw new TypeError('Cody: informe uma instância Fastify com route(), hasRoute() e addHook().');
    }

    let registrationClosed = false;
    let renderPage;
    app.addHook('onReady', async () => {
        registrationClosed = true;
    });

    function addRouter(path, routes) {
        if (registrationClosed) {
            throw new Error(`Cody: registro de ${path} recusado; a fase de registro foi encerrada.`);
        }
        validatePath(path);
        if (!isPlainObject(routes) || Reflect.ownKeys(routes).length === 0) {
            throw new TypeError('Cody: objetoDeRotas deve ser um objeto simples não vazio.');
        }

        // Valida todo o contrato antes de modificar o registro do Fastify.
        const definitions = [];
        for (const method of Reflect.ownKeys(routes)) {
            if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
                throw new TypeError(`Cody: método não suportado ${String(method)}.`);
            }
            const definition = routes[method];
            if (!isPlainObject(definition)) {
                throw new TypeError(`Cody: a definição de ${method} ${path} deve ser um objeto simples.`);
            }
            for (const option of Reflect.ownKeys(definition)) {
                if (option !== 'handler' && option !== 'schema' && option !== 'template') {
                    throw new TypeError(`Cody: opção desconhecida ${String(option)} em ${method} ${path}.`);
                }
            }
            if (typeof definition.handler !== 'function') {
                throw new TypeError(`Cody: handler de ${method} ${path} deve ser uma função.`);
            }
            if (definition.schema !== undefined && !isPlainObject(definition.schema)) {
                throw new TypeError(`Cody: schema de ${method} ${path} deve ser um objeto simples.`);
            }
            let handler = definition.handler;
            if (Object.hasOwn(definition, 'template')) {
                validateTemplate(definition.template);
                if (method !== 'GET' || definition.schema?.response !== undefined) {
                    throw new TypeError('Cody: template exige GET sem schema de resposta.');
                }
                // O handler de página recebe apenas request, sem reply ou this do Fastify.
                const dataHandler = definition.handler;
                handler = async (request, reply) => {
                    try {
                        const data = await dataHandler(request);
                        return reply.type('text/html; charset=utf-8').send(renderPage(data));
                    } catch (error) {
                        request.log.error({ err: error }, 'Falha ao produzir página');
                        return reply.code(500).type('application/json').send({
                            error: 'Internal Server Error', message: 'Não foi possível produzir a página.', statusCode: 500
                        });
                    }
                };
            }
            definitions.push({ method, url: path, handler, schema: definition.schema });
        }

        // Consulta o registro real, incluindo as rotas do núcleo e HEAD automático.
        for (const definition of definitions) {
            if (app.hasRoute({ method: definition.method, url: path })) {
                throw new Error(`Cody: conflito de rota ${definition.method} ${path}.`);
            }
            if (definition.method === 'GET' && app.hasRoute({ method: 'HEAD', url: path })) {
                throw new Error(`Cody: conflito de GET ${path} com HEAD preexistente.`);
            }
        }

        if (!renderPage && Reflect.ownKeys(routes).some(method => Object.hasOwn(routes[method], 'template'))) {
            renderPage = createPageRenderer(app);
        }

        for (const definition of definitions) {
            try {
                // Fastify mantém schemas, hooks, HEAD e bloqueio após inicialização.
                app.route(definition);
            } catch (error) {
                registrationClosed = true;
                throw new Error(`Cody: falha ao registrar ${definition.method} ${path}: ${error.message}`, {
                    cause: error
                });
            }
        }
    }

    return { addRouter };
}

module.exports = { createCody };
