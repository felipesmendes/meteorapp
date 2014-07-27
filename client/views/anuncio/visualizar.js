Template.visualizarAnuncio.helpers({
	user: function() {
 	  return Meteor.users.findOne({_id: this.userId});
	},
	comentarios :function() {
    	return Comentario.find({anuncioId: this._id});
  	}
});