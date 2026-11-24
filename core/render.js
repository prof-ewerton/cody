const { sanitizeHtml } = require('./html-sanitizer');

function renderHtmlPage(html) {
    const safeHtml = sanitizeHtml(html);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LAB-AIEDU</title>
</head>
<body>
${safeHtml}
</body>
</html>`;
}

module.exports = { renderHtmlPage };