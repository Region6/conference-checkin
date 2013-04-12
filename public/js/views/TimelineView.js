var TimelineView = Backbone.View.extend({
    events: {

    },

    initialize: function() {
        _.bindAll(this, 'fetch', 'render', 'unrender');

        this.collection = new Timeline();
        this.collection.on('add', this.render, this); // Event listener on collection
        this.collection.on('change', this.render, this); // Event listener on collection
        this.collection.on('reset', this.render, this); // Event listener on collection
        this.options.parent.on('close:all', this.unrender, this); // Event listener on parent

    },

    fetch: function() {
        this.collection.fetch();
    },

    render: function() {
        var source = Templates.timeline,
            template = Handlebars.compile(source),
            self = this;
        this.offset = 50;
        $(this.el).html(template);
        $('#timeline', this.el).empty();
        _(this.collection.first(9)).each(function(event) {
            var eventV = new EventView({ model: event, parent: self });
            eventV.on('modelUpdate', self.refresh, self);
            eventV.render();
            $('#timeline', self.el).append(eventV.el);
        });
        //this.delegateEvents();
    },

    unrender: function () {

        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        this.collection.unbind( 'add', this.render, this ); // Unbind reference to the model
        this.collection.unbind( 'change', this.render, this ); // Unbind reference to the model
        this.collection.unbind( 'reset', this.render, this ); // Unbind reference to the model
        this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node

    }

});
