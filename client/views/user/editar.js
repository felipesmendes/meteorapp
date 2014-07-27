Template.editarPerfil.helpers({
	user: function() {
		return Meteor.users.findOne({_id: Meteor.userId()});
	}
});
Template.editarPerfil.events({
	"submit form": function(event,template) {
		event.preventDefault();
		var nome = template.find("input[name='nome']").value;
		var telefone = template.find("input[name='telefone']").value;
		var celular = template.find("input[name='celular']").value;
		var endereco = template.find("input[name='endereco']").value;
		Meteor.users.update(
			{ _id: Meteor.userId() },
			{ $set:
				{ "profile.name": nome,
				"profile.telefone": telefone,
				"profile.celular": celular,
				"profile.address":endereco }
			});
	}

});
Template.editarPerfil.rendered = function () { 
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