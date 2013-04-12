var RegistrantsView = Backbone.View.extend({
    events: {
        "click .search"         :   "search"

    },

    initialize: function() {
        _.bindAll(this, 'fetch', 'render', 'unrender');

        this.collection = App.Models.registrants = new Registrants();
        this.collection.on('reset', this.render, this); // Event listener on collection
        this.options.parent.on('close:all', this.unrender, this); // Event listener on parent

    },

    fetch: function(options) {
        this.search = false;
        if (typeof options != 'undefined') {
            this.search = true;
        }
        this.collection.fetch(options);
    },

    render: function() {
        var source = Templates.registrants,
            template = Handlebars.compile(source),
            self = this;
        this.offset = 50;
        $(this.el).html(template);
        $('#registrants tbody', this.el).empty();
        this.collection.each(function(document) {
            var regV = new DocumentView({ model: regument });
            regV.on('modelUpdate', self.refresh, self);
            regV.render();
            $('#registrants tbody', self.el).append(regV.el);
        });
        //this.delegateEvents();
    },

    unrender: function() {
        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        this.collection.unbind( 'change', this.render, this ); // Unbind reference to the model
        this.collection.unbind( 'reset', this.render, this ); // Unbind reference to the model
        this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node
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
    }

});
