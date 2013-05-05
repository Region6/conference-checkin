var LinkedRegistrantView = Backbone.View.extend({
    tagName: 'tr',
    events: {
        "click .checkLinkedIn"            :   "checkIn",
        "click .checkLinkedOut"           :   "checkOut",
        "click .edit"               :   "edit"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'checkIn', 'checkOut', 'edit');
        this.parent = opts.parent;
    },

    render: function() {
        var source      = Templates.linkedRegistrant,
            template    = Handlebars.compile(source),
            vars        = this.model.attributes,
            view        = this;
        var html = template(vars);
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
    },

    checkIn: function(e) {
        var view = this;
        this.model.save({"attend": 1}, {patch: true, success: function(model, response) {
            view.parent.fetch("linked");
        }});
    },

    checkOut: function(e) {
        var view = this;
        this.model.save({"attend": 0}, {patch: true, success: function(model, response) {
            view.parent.fetch("linked");
        }});
    },

    edit: function(e) {
        App.Router.navigate("/registrant/"+this.model.get("id"), true);
    }

});
