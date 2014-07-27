Template.header.events({
	"click #filtroAvancado" : function(e,template){
		$("#filtro").fadeToggle();
	},
	"click #logar" : function(e,template){
		var email = template.find("#email").value;
		var senha = template.find("#password").value;
		Meteor.loginWithPassword(email,senha,function(err){
			if(!err){
				$("#login").modal('hide');
			}else{
				console.log(err);
			}
		});
	},
	"click #logout" : function(e,template){
		Meteor.logout();
	}
});