var Router = Backbone.Router.extend({

    routes: {
        "":                                     "index",
        "registrant/:registrantId":             "registrant",
        "dash":                                 "dash"
    },

    views: {},

    initialize: function() {
        _.bindAll(this, 'index',  'registrant', 'dash', 'setBody');

        //Create all the views, but don't render them on screen until needed
        this.views.app = new AppView({ el: $('body') });
        //this.views.tags = new TagsView();
        //this.views.account = new AccountView();

        //The "app view" is the layout, containing the header and footer, for the app
        //The body area is rendered by other views
        this.view = this.views.app;
        this.view.render();
        this.currentView = null;
    },

    index: function() {
        //if the user is logged in, show their documents, otherwise show the signup form
        this.navigate("dash", true);
    },

    registrant: function(docId) {
        if (typeof App.currentDoc == 'undefined') {
            App.currentDoc = this.views.main.documentsView.collection.get(docId);
        }
        var type = ("type" in App.currentDoc.attributes.versions[0]) ? App.currentDoc.attributes.versions[0].type : "project";
        if (type == "person") {
            type = ("subType" in App.currentDoc.attributes.versions[0]) ? App.currentDoc.attributes.versions[0].subType : "restrictedParty";
        }
        this.setBody(new EditView({ model: App.currentDoc, type: type, review: false }), true);
        //this.view.body.fetch();
        //new EditView({ model: App.currentDoc }).render();
        this.view.body.render();
    },

    dash: function() {
        this.views.main = new DashboardView();
        App.io.emit('ready', {'user': App.uid});
        this.setBody(this.views.main, true);
        this.view.body.render();
    },

    setBody: function(view, auth) {
        if (auth == true && typeof App.user == 'undefined') {
            this.navigate("", true);
            return;
        }

        if (typeof this.view.body != 'undefined')
            this.view.body.unrender();

        this.view.body = view;
    }

});
