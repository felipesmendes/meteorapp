Comentario = new Meteor.Collection('comments');
Meteor.methods({
  comentario: function(commentAttributes) {
    var user = Meteor.user();
    var anuncio = Anuncio.findOne(commentAttributes.anuncioId);
    // ensure the user is logged in
    if (!user)
      throw new Meteor.Error(401, "You need to login to make comments");
    if (!commentAttributes.conteudo)
      throw new Meteor.Error(422, 'Please write some content');
    if (!anuncio)
      throw new Meteor.Error(422, 'You must comment on a post');
    comentario = _.extend(_.pick(commentAttributes, 'anuncioId', 'conteudo'), {
      userId: user._id,
      autor: user.username,
      criado: new Date().getTime()
    });
    comentario._id = Comentario.insert(commentAttributes);
    // now create a notification, informing the user that there's been a comment
    notificacaoComentario(comentario);
    return comentario._id;
  }
});