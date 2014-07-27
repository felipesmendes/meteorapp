Template.search.events({
	// A cada 500 milisegundos depois que o usuário digitar algo, setar
    // as palavras chave como o valor definido no campo de busca.
    // Ignorar buscas com menos de 3 letras.
	"keyup input[name='busca']": function(e, template) {
		 lazySetKeywords(e.currentTarget.value);
	}
});
function setKeywords(keywords) {
    if ( keywords.length >= 3 ) {
      Session.set('keywords', keywords);
    } else {
      Session.set('keywords', '');
    }
  };
var lazySetKeywords = _.debounce(setKeywords, 500);
// Roda de novo sempre que as palavras chaves mudarem
Deps.autorun(function () {
    // busca de artigos que contenham as palavras chave
    Meteor.subscribe('search', Session.get('keywords'));
});