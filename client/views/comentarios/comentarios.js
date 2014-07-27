Template.comentario.events({
  'submit form': function(e, template) {
    e.preventDefault();

    var $body = $(e.target).find('[name=body]');
    var comment = {
      conteudo: $body.val(),
      anuncioId: template.data._id,
    };
    Meteor.call('comentario', comment, function(error, commentId) {
      if (error){
        throwError(error.reason);
      } else {
        $body.val('');
        FlashMessages.sendSuccess("Comentario inserido com sucesso!");
      }
    });
    
  }
});