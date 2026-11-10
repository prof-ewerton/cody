function setup(config) {
    config.cody.addRouter('/experimental/pagina', {
        GET: {
            template: 'experimental',
            handler: async () => ({
                titulo: 'Plugin experimental',
                mensagem: 'Plugin ativo no LAB-AIEDU.'
            })
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
