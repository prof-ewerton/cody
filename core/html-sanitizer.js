const sanitize = require('sanitize-html');
const MAX_HTML_LENGTH = 100_000; // limite inicial, pode-se ser ajustado futuramente

const HTML_POLICY = {
    allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'b', 'em', 'i',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'table', 'caption', 'thead', 'tbody',
        'tfoot', 'tr', 'th', 'td'
    ],
    allowedAttributes: {}
};

function sanitizeHtml(html) {
    if (typeof html !== 'string') {
        throw new TypeError('O HTML deve ser uma string.');
    }

    if (html.length > MAX_HTML_LENGTH) {
    throw new RangeError('O HTML excede o tamanho máximo permitido.');
    }

    return sanitize(html, HTML_POLICY);
}

module.exports = { sanitizeHtml };