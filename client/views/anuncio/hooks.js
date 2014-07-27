AutoForm.hooks({
	Anuncio: {
		after: {
			insert:  function(error, result) {
				if (result) {
					FlashMessages.sendSuccess("Anuncio cadastrado com sucesso!");
					Router.go("meusAnuncios");
				}
			},
			update : function(error){
				if(!error){
					FlashMessages.sendSuccess("Anuncio atualizado com sucesso!");
					Router.go("meusAnuncios");
				}

			}
		}
	}
}); 