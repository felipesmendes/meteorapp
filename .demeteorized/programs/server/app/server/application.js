(function(){var fs = Npm.require("fs");
Meteor.methods({
	'file-upload': function (fileInfo, fileData) {
		fs.writeFile(process.env['PWD']+"/public/images/"+fileInfo.name, fileData);
	}
});

 Meteor.publish('search', function (keywords) {
    if ( searchQuery(keywords) ) {
      return Anuncio.find(searchQuery(keywords), {limit: 10});
    } else {
      // caso as palavras chaves estejam vazias não retorna artigo algum
      return [];
    }
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

})();
