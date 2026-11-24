
function setup(config) {
    config.cody.addRouter('/experimental/pagina', {
        GET: {
            handler: async () => {
                const html = `
                    <h1>Bem-vindo ao LAB-AIEDU!</h1>

                    <p>Esta página foi criada pelo Plugin01.</p>

                    <h2>Animais cadastrados</h2>

                    <ul>
                        <li>Caprinos</li>
                        <li>Ovinos</li>
                        <li>Bovinos</li>
                    </ul>

                    <script>alert('Teste de XSS')</script>

                    <p onclick="alert('Ataque!')">
                        Testando a sanitização HTML.
                    </p>
                `;

                return config.cody.newPage().out(html);
            }
        }
    });

    config.cody.addRouter('/experimental/status', {
        GET: {
            handler: async () => ({
                plugin: 'experimental',
                status: 'ativo',
                version: '1.0.0'
            })
        }
    });
}

module.exports = { setup };
