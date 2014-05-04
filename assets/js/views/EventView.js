var EventView = Backbone.View.extend({
    events: {

    },

    initialize: function() {
        _.bindAll(this, 'render', 'close');
        $(this.el).addClass('row-fluid event-row');
        this.options.parent.on('close:all', this.close, this); // Event listener on parent
    },

    render: function() {
        var html = Templates.event(this.model.attributes);
        $(this.el).html(html);
    },

   close: function () {

        console.log('Kill: ', this.cid);

        //this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.model.unbind( 'change', this.render, this ); // Unbind reference to the model
        this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node

    }

});
