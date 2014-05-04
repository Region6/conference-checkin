var AppView = Backbone.View.extend({

    events: {
        "click  #btn-home":            "home"
    },

    initialize: function() {
        _.bindAll(this, 'render', 'home', 'login');
        this.currentRegistrant = {};
    },

    render: function() {
        var html = Templates.header();
        $('#header').html(html);
    },

    home: function(e) {
        e.preventDefault();
        App.Router.navigate("dash", true);
    },

    login: function(e) {
        e.preventDefault();

        var username = $('#frm-login input[name=username]').val();
        var password = $('#frm-login input[name=password]').val();

        $.ajax({
            type: 'POST',
            url: '/json/login',
            dataType: 'json',
            data: { username: username, password: password },
            success: function(data) {
                $('#header .public').hide();
                $('#header .logged-in').show();
                App.user = data;
                App.router.navigate("documents", true);
            },
            error: function() {
                $('#login-error').html("<button type='button' class='close' data-dismiss='alert'>&times;</button>Invalid UIN and/or SSO password.").addClass('alert fade in');
                $(".alert").alert();
            }
        });

    }

});
