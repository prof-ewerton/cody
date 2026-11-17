const sanitize = require('sanitize-html');

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

    return sanitize(html, HTML_POLICY);
}

module.exports = { sanitizeHtml };