Template.meusAnuncios.events({
	"click .excluir":function(event, template){
		var del = confirm("Tem certeza que deseja ecluir o anuncio do "+this.marca+" "+ this.modelo+ "?");
		if(del){
			Anuncio.remove({_id:this._id});
		}
		
	},
	"click .vendido":function(event,template){
		Anuncio.update(this._id,{$set: {vendido: 1}});
	}
});
