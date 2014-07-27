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

