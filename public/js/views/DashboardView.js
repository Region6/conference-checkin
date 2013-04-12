var MainView = Backbone.View.extend({
    events: {

    },

    initialize: function() {
        _.bindAll(this, 'fetch', 'render', 'unrender', "addDocument");

        this.registrantsView = new RegistrantsView({parent: this});
        //this.timelineView = new TimelineView({parent: this});

    },

    fetch: function(options) {

    },

    assign : function (view, selector) {
        view.setElement(this.$(selector)).render();
    },

    render: function() {
        var source = Templates.dashboard,
            template = Handlebars.compile(source),
            html = template(),
            view = this;

        this.$el.html(html);
        $('#app').append(this.el);
        //this.timelineView.fetch();
        //$("#timelineHolder", this.$el).append(this.timelineView.el);
        this.registrantsView.fetch({ data: { category: 'all', term: 'all', page: 1 }});
        $("#regTable", this.$el).append(this.registrantsView.el);

    },

    search: function(e) {
        e.preventDefault();
        var id = $(e.target).parent().attr("id");
        //delete this.searchOptions;
        delete this.page;
        App.router.navigate();
        if (id === "all") {
            App.router.navigate("documents/all/all/1", true);
        } else {
            App.router.navigate("documents/campus/"+id+"/1", true);
        }
    },

    unrender: function () {

        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.model.unbind( 'change', this.render, this ); // Unbind reference to the model
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node

    },

    addDocument: function(e) {
        var action = "project";
        if (e.srcElement.attributes["data-id"].value == "project") {
            action = "project";
        } else if (e.srcElement.attributes["data-id"].value == "item") {
            action = "item";
        } else {
            action = e.srcElement.attributes["data-id"].value;
        }
        App.router.navigate("add/document/"+action, true);
    }

});
