Template.registrar.events({
	"submit #registrar": function(event,template) {
		event.preventDefault();
		var nome = template.find("input[name='nome']").value;
		var usuario = template.find("input[name='user']").value;
		var password = template.find("input[name='password']").value;
		var email = template.find("input[name='email']").value;
		var telefone = template.find("input[name='telefone']").value;
		var celular = template.find("input[name='celular']").value;
		var endereco = template.find("input[name='endereco']").value;
		
		options = {username:usuario,email:email,password:password,profile:{
			"name": nome,
			"telefone": telefone,
			"celular": celular,
			"address":endereco }};
			console.log(options);
			Accounts.createUser(options,function(err){
				if(!err){
					FlashMessages.sendSuccess("Usuário cadastrado com sucesso!");
					Router.go("home");
				}
			});
		}

	});
Template.registrar.rendered = function () { 
	getLocation();
}

function getLocation()
{
	if (navigator.geolocation)
	{
		navigator.geolocation.watchPosition(showPosition);
	}
	else{

	}
}
function showPosition(position) {
	$.get("http://maps.googleapis.com/maps/api/geocode/json?latlng="+position.coords.latitude+","+position.coords.longitude, function (data) {
		$("input[name='endereco']").val(data.results[0].formatted_address);
	});
	
}