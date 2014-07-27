(function(){Anuncio = new Meteor.Collection("anuncios", {
    schema: {
        tipo: {
            type: String,
            label: "Tipo"
        },
        placa: {
            type: String,
            label: "Placa",
            max: 7
        },
        valor: {
            type: Number,
            label: "Valor"
        },
        marca: {
            type: String,
            label: "Marca"
        },
        modelo: {
            type: String,
            label: "Modelo"
        },
        versao: {
            type: String,
            label: "Versão: Ex.: ELX ,WAY ,FIRE ,FLEX"
        },
        anoFabricacao: {
            type: Number,
            label: "Ano de Fabricação",
        },
        anoModelo: {
            type: Number,
            label: "Ano Modelo",
        },
        portas:
        {
            type: Number,
            label: "Portas"
        },
        combustivel: {
            type: String,
            label: "Combustível"
        },
        quilometragem: {
            type: Number,
            label: "Quilometragem"
        },
        observacoes: {
            type: String,
            label: "Observações"
        },
        vendido : {
            type: Number,
            label: "Vendido",
            optional: true,
            autoValue: function(){
                return 0;
            }
        },
        userId : {
            type: String,
            label: "Usuário",
            autoValue: function () {
                return Meteor.userId();
            }
        },
        fotos : {
            type: String,
            label: "Foto",
        }
    }
});

})();
