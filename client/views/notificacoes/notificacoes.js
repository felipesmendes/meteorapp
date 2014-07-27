Template.notificacoes.helpers({
  notificacoes: function() {
    return Notificacao.find({userId: Meteor.userId(), read: false});
  },
  notificacoesCount: function(){
    return Notificacao.find({userId: Meteor.userId(), read: false}).count();
  }
});

Template.notificacao.helpers({
  notificationAuncioPath: function() {
    return Router.routes.visualizarAnuncio.path({_id: this.anuncioId});
  }
})

Template.notificacao.events({
  'click a': function() {
    Notificacao.update(this._id, {$set: {read: true}});
  }
})