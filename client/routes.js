Router.configure({
  layoutTemplate: 'layoutMain',

});

Router.map(function() {
  this.route('home', {
    path: '/',
    template: 'default',
    data: function(){
      keywords = Session.get('keywords');
      filtro = Session.get('filtro');
      if ( searchQuery(keywords) ) {
        anuncio = Anuncio.find(searchQuery(keywords));
      } else {
        if(filtro){
          // caso as palavras chaves estejam vazias não retorna artigo algum
          anuncio = Anuncio.find(filtro);

        }else {
          // caso as palavras chaves estejam vazias não retorna artigo algum
          anuncio = Anuncio.find();

        }
      }
      return {
        anuncios: anuncio,
        marcas: Marca.find()
      }
    }
  });
  this.route('editar-perfil', {
    path: '/editar-perfil',
    template: 'editarPerfil',
  });
  this.route('novo-anuncio', {
    path: '/novo-anuncio',
    template: 'addAnuncio',
  });
  this.route('editar-anuncio', {
    path: '/editar-anuncio/:_id',
    template: 'atualizarAnuncio',
    data: function() {
      var _id = this.params._id;
      return {
        anuncio: Anuncio.findOne({_id: _id})
      }
    }
  });
  this.route('visualizarAnuncio', {
    path: '/visualizar-anuncio/:_id',
    template: 'visualizarAnuncio',
    data: function() {
      var _id = this.params._id;
      return {
        anuncio: Anuncio.findOne({_id: _id})
      }
    }
  });
  this.route('cadastro', {
    path: '/cadastrar/',
    template: 'registrar',
  });
  this.route('meusAnuncios', {
    path: '/meus-anuncios',
    template: 'meusAnuncios',
    data : function(){
      return {
        anuncios : Anuncio.find({userId: Meteor.userId()})
      }
    }
  });
});
// Dado um conjunto de palavras chaves, gerar uma query que contenham pelo menos uma das palavras
// chaves passadas em 'keywords' em qualquer atributo definido em 'searchFields', não diferenciando maiúsculas/minúsculas
function searchQuery(keywords) {
  if ( keywords && keywords !== '' ) {
    var searchFields = ['modelo','marca','valor',];
    var searchQuery = [];
    _.each(searchFields, function (field) {
      searchKeywords = {};
      searchKeywords[field] = { $regex: keywords.split(' ').join('|'), $options: 'i' };
      searchQuery.push(searchKeywords);
    });
    // busca em qualquer um dos atributos. Sem isso ele buscaria em todos
    return {$or: searchQuery};
  }
}