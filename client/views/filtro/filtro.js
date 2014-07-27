	Template.filtro.events({
		"click #filtrar": function(e, template) {
			var tipo = template.find("#veiculo").value;
			var marca = template.find("#marca").value;
			var modelo = template.find("#modelo").value;
			var cidade = template.find("#cidade").value;
			var valorMin = parseInt(template.find("#valorMin").value);
			var valorMax = parseInt(template.find("#valorMax").value);
			var kmMin = parseInt(template.find("#kmMin").value);
			var kmMax = parseInt(template.find("#kmMax").value);
			var conditions = {};
			if(valorMin >= 0 && valorMax > 0){
				conditions.valor = { $gte:valorMin,$lte:valorMax};
			}
			if(marca){
				conditions.marca = marca;
			}
			if(modelo){
				conditions.modelo = modelo;
			}
			if(kmMin>=0 && kmMax > 0){
				conditions.quilometragem = { $gte:kmMin,$lte:kmMax};
			}
			if(veiculo){
				conditions.tipo = tipo;
			}
			console.log(conditions);
			Session.set("filtro",conditions);

		}
	});