Template._loginButtonsLoggedInDropdown.events({
    'click #login-buttons-edit-profile': function(event) {
        Template._loginButtons.toggleDropdown();
        Router.go('editar-perfil');
    }
});