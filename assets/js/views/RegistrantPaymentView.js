var RegistrantPaymentView = Backbone.View.extend({
    tagName: 'tr',
    events: {

    },

    initialize: function(opts) {
        _.bindAll(this, 'render');
        this.options = opts;
        this.options.parent.on('close:all', this.unrender, this); // Event listener on parent
    },

    render: function() {
        var vars        = this.model.attributes,
            html        = Templates.payment(vars),
            view        = this;
        this.$el.html(html);
        return this;
    },

    unrender: function() {
        console.log('Kill: ', this.cid);

        this.trigger('close:all');
        this.unbind(); // Unbind all local event bindings
        //this.collection.unbind( 'change', this.render, this ); // Unbind reference to the model
        //this.collection.unbind( 'reset', this.render, this ); // Unbind reference to the model
        //this.options.parent.unbind( 'close:all', this.close, this ); // Unbind reference to the parent view

        this.remove(); // Remove view from DOM

        delete this.$el; // Delete the jQuery wrapped object variable
        delete this.el; // Delete the variable reference to this node
    },

    goBack: function(e) {
        App.Router.navigate("dash", true);
    }

});
