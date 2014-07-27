Template.addAnuncio.events({
	"change .file-upload-input":function(event, template){
		var file = event.currentTarget.files[0];
		var reader = new FileReader();
		reader.readAsBinaryString(file);
		/*
		reader.onprogress = function(e){
			var percentage = Math.round((e.loaded * 100) / e.total);
			$(".progress-bar").width(percentage+"%");
			$(".progress-bar").html(percentage+"%");

		};
		var func = this;
		
		reader.onload = function(fileLoadEvent) {
			Meteor.call('file-upload', file, reader.result);
		};*/
	},
	"submit #addAnuncio":function(e,template){
		e.preventDefault();
		var tipo = template.find("input[name='tipo']").value;
		var placa = template.find("input[name='placa']").value;
		var valor = template.find("input[name='valor']").value;
		var marca = template.find("input[name='marca']").value;
		var modelo = template.find("input[name='modelo']").value;
		var versao = template.find("input[name='versao']").value;
		var anoFabricacao = template.find("input[name='anoFabricacao']").value;
		var anoModelo = template.find("input[name='anoModelo']").value;
		var portas = template.find("input[name='portas']").value;
		var combustivel = template.find("input[name='combustivel']").value;
		var quilometragem = template.find("input[name='quilometragem']").value;
		var observacoes = template.find("input[name='observacoes']").value;
		var foto = template.find("input[name='foto']").value;

		if(Anuncio.insert({tipo:tipo,placa:placa,valor:valor,marca:marca,modelo:modelo,versao:versao,anoFabricacao:anoFabricacao,anoModelo:anoModelo,portas:portas,combustivel:combustivel,quilometragem:quilometragem,observacoes:observacoes,foto:foto})){
			FlashMessages.sendSuccess("Anuncio cadastrado com sucesso!");
			Router.go("meusAnuncios");
		}
	}
});
Template.addAnuncio.helpers({
	/*marcas: function() {
 	  var marcas = Marca.find().fetch();
      var options = [{ label: 'Selecione uma Marca', value: '' }];
      for (var i = 0; i < marcas.length; i++) {
      options.push({ label: marcas[i].nome, value: marcas[i].nome });
      }
		return options;
	}*/
	marcas: function() {
		return Marca.find();
	},
	images : function(){
		return Images.find();
	}
});

