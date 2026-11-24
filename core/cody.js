const { types } = require('node:util');
const { renderHtmlPage } = require('./render');

const JSON_TYPE = 'application/json';
const INTERNAL_ERROR_BODY = '{"statusCode":500,"message":"Erro interno do servidor."}';

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

function invalidJson() {
    return new TypeError('Cody: a resposta deve conter somente dados JSON válidos.');
}

function validateJson(value, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) {
        return;
    }

    if (typeof value !== 'object' || types.isProxy(value) || ancestors.has(value)) {
        throw invalidJson();
    }

    const array = Array.isArray(value);
    const keys = Reflect.ownKeys(value);
    if (array ? Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1
        : !isPlainObject(value) || ArrayBuffer.isView(value) || types.isArrayBuffer(value)) {
        throw invalidJson();
    }

    // Inspeciona descritores antes que o Fastify ou o serializador leiam os valores.
    ancestors.add(value);
    for (const key of keys) {
        if (array && key === 'length') continue;
        const property = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !property.enumerable || !Object.hasOwn(property, 'value')
            || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) {
            throw invalidJson();
        }
        validateJson(property.value, ancestors);
    }
    ancestors.delete(value);
}

function serializeJsonString(reply, value, status) {
    // A seleção de status precede a seleção de MIME, inclusive quando o MIME não tem schema.
    const serializers = [status, `${Math.floor(status / 100)}xx`, 'default']
        .map(key => reply.getSerializationFunction(key))
        .find(Boolean);
    const serialize = typeof serializers === 'function'
        ? serializers
        : serializers?.[JSON_TYPE] ?? serializers?.['*/*'];
    return serialize ? serialize(value) : JSON.stringify(value);
}

function logInternalError(error, request) {
    try {
        let detail = 'valor lançado sem mensagem disponível';
        const kind = typeof error;
        if (error === null || (kind !== 'object' && kind !== 'function')) {
            detail = String(error);
        } else if (!types.isProxy(error)) {
            const message = Object.getOwnPropertyDescriptor(error, 'message');
            if (message && Object.hasOwn(message, 'value') && typeof message.value === 'string') {
                detail = message.value;
            }
        }

        console.error(
            'Cody: falha ao produzir resposta para %s %s',
            request.method,
            request.routeOptions.url,
            detail
        );
    } catch {
        // O diagnóstico é opcional e não pode interromper a resposta HTTP.
    }
}

function prepareInternalError(error, request, reply) {
    reply.removeHeader('content-length');
    reply.code(500).type(JSON_TYPE);
    logInternalError(error, request);
    // Um corpo pré-serializado mantém o formato de erro independente do schema da rota.
    return INTERNAL_ERROR_BODY;
}

function createCody(app) {
    if (!app || typeof app.route !== 'function' || typeof app.hasRoute !== 'function' || typeof app.addHook !== 'function') {
        throw new TypeError('Cody: informe uma instância Fastify com route(), hasRoute() e addHook().');
    }

    let registrationClosed = false;
    const pageResults = new WeakMap();
    const jsonResults = new WeakMap();
    const authorizedPages = new WeakSet();
    const handledRequests = new WeakSet();

    app.addHook('onReady', async () => {
        registrationClosed = true;
    });

    function newPage() {
        return {
            out(html) {
                if (typeof html !== 'string') {
                    throw new TypeError('Cody: o conteúdo da página deve ser uma string.');
                }

                const result = Object.freeze({});
                pageResults.set(result, html);

                return result;
            }
        };
    }

    function json(value, options = {}) {
        if (types.isProxy(options) || !isPlainObject(options)) {
            throw new TypeError('Cody: as opções de json() devem ser um objeto simples.');
        }
        if (Reflect.ownKeys(options).some(key => key !== 'status')) {
            throw new TypeError('Cody: json() aceita apenas a opção status.');
        }

        const property = Object.getOwnPropertyDescriptor(options, 'status');
        if (property && (!property.enumerable || !Object.hasOwn(property, 'value'))) {
            throw new TypeError('Cody: status deve ser uma propriedade enumerável de dados.');
        }

        const status = property?.value === undefined ? 200 : property.value;
        if (!Number.isInteger(status) || status < 200 || status > 599 || [204, 205, 304].includes(status)) {
            throw new RangeError('Cody: status inválido para uma resposta JSON com conteúdo.');
        }

        const result = Object.freeze({});
        jsonResults.set(result, { value, status });
        return result;
    }

    function checkHtml(request, reply, _payload, done) {
        const mime = reply.getHeader('content-type');
        if (typeof mime === 'string' && mime.split(';', 1)[0].trim().toLowerCase() === 'text/html'
            && !authorizedPages.has(request)) {
            const error = new Error('Cody: envio de HTML fora do fluxo de páginas.');
            // Substitui o payload no mesmo fluxo, antes da supressão do corpo de HEAD.
            done(null, prepareInternalError(error, request, reply));
            return;
        }
        done();
    }

    function handleRouteError(error, request, reply) {
        if (!handledRequests.has(request)) throw error;
        reply.send(prepareInternalError(error, request, reply));
    }

    function addRouter(path, routes) {
        if (registrationClosed) {
            throw new Error(`Cody: registro de ${path} recusado; a fase de registro foi encerrada.`);
        }

        validatePath(path);

        if (!isPlainObject(routes) || Reflect.ownKeys(routes).length === 0) {
            throw new TypeError('Cody: objetoDeRotas deve ser um objeto simples não vazio.');
        }

        // Valida todo a interface antes de registrar as rotas.
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
                if (option !== 'handler' && option !== 'schema') {
                    throw new TypeError(`Cody: opção desconhecida ${String(option)} em ${method} ${path}.`);
                }
            }

            if (typeof definition.handler !== 'function') {
                throw new TypeError(`Cody: handler de ${method} ${path} deve ser uma função.`);
            }

            if (definition.schema !== undefined && !isPlainObject(definition.schema)) {
                throw new TypeError(`Cody: schema de ${method} ${path} deve ser um objeto simples.`);
            }

            const originalHandler = definition.handler;
            const schema = definition.schema === undefined ? undefined : { ...definition.schema };
            const hasResponseSchema = schema?.response !== undefined;
            const allowsPage = method === 'GET' && !hasResponseSchema;

            const handler = async (request, reply) => {
                handledRequests.add(request);
                try {
                    const input = structuredClone({
                        params: request.params,
                        query: request.query,
                        body: request.body,
                        headers: request.headers,
                        method: request.method
                    });
                    const returned = originalHandler(input);
                    // Um retorno síncrono com getter "then" deve ser validado sem chamar o getter.
                    const result = types.isPromise(returned) ? await returned : returned;

                    if (pageResults.has(result)) {
                        if (!allowsPage) {
                            throw new TypeError('Cody: páginas HTML exigem GET sem schema de resposta.');
                        }
                        const document = renderHtmlPage(pageResults.get(result));
                        authorizedPages.add(request);
                        reply.type('text/html; charset=utf-8').send(document);
                        return;
                    }

                    const declared = jsonResults.get(result);
                    const { value, status } = declared ?? { value: result, status: 200 };
                    validateJson(value);
                    reply.code(status);
                    if (typeof value === 'string' && !declared && !hasResponseSchema) {
                        reply.type('text/plain; charset=utf-8').send(value);
                        return;
                    }

                    const payload = typeof value === 'string' ? serializeJsonString(reply, value, status) : value;
                    reply.type(JSON_TYPE).send(payload);
                } catch (error) {
                    reply.send(prepareInternalError(error, request, reply));
                }
            };

            definitions.push({
                method,
                url: path,
                handler,
                schema,
                onSend: checkHtml,
                errorHandler: handleRouteError
            });
        }

        // Verifica conflitos com as rotas já registradas.
        for (const definition of definitions) {
            if (app.hasRoute({ method: definition.method, url: path })) {
                throw new Error(`Cody: conflito de rota ${definition.method} ${path}.`);
            }

            if (definition.method === 'GET' && app.hasRoute({ method: 'HEAD', url: path })) {
                throw new Error(`Cody: conflito de GET ${path} com HEAD preexistente.`);
            }
        }

        // Registra as rotas no Fastify.
        for (const definition of definitions) {
            try {
                app.route(definition);
            } catch (error) {
                registrationClosed = true;

                throw new Error(`Cody: falha ao registrar ${definition.method} ${path}: ${error.message}`, {
                    cause: error
                });
            }
        }
    }

    return { addRouter, newPage, json };
}

module.exports = { createCody };
