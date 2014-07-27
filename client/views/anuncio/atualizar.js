Template.atualizarAnuncio.helpers({
	marcas: function() {
 	  var marcas = Marca.find().fetch();
      var options = [{ label: 'Selecione uma Marca', value: '' }];
      for (var i = 0; i < marcas.length; i++) {
      options.push({ label: marcas[i].nome, value: marcas[i].nome });
      }
		return options;
	}
});