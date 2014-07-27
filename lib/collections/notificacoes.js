Notificacao = new Meteor.Collection('notificacoes');

notificacaoComentario = function(comentario) {
  var anuncio = Anuncio.findOne(comentario.anuncioId);
  if (comentario.userId !== anuncio.userId) {
    Notificacao.insert({
      userId: anuncio.userId,
      anuncioId: anuncio._id,
      comentarioId: comentario._id,
      autorComentario: comentario.autor,
      read: false
    });
  }
};