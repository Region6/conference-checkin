var LinkedRegistrantView = Backbone.View.extend({
    tagName: 'tr',
    events: {
        "click .checkLinkedIn"            :   "checkIn",
        "click .checkLinkedOut"           :   "checkOut",
        "click .edit"               :   "edit"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'checkIn', 'checkOut', 'edit');
        this.options = opts;
        this.options.parent.on('close:all', this.unrender, this); // Event listener on parent
        this.model.on('change', this.render, this); // Event listener on collection
        this.model.id = this.model.get("registrantId");
        this.model.urlRoot = "/api/registrant/";
    },

    render: function() {
        var vars        = this.model.attributes,
            view        = this,
            html = Templates.linkedRegistrant(vars);
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
        this.model.id = this.model.get("registrantId");
        this.model.save({"fields": {"attend": true}}, {patch: true});
    },

    checkOut: function(e) {
        var view = this;
        this.model.id = this.model.get("registrantId");
        this.model.save({"fields": {"attend": false}}, {patch: true});
    },

    edit: function(e) {
        App.Router.navigate("/registrant/"+this.model.get("registrantId"), true);
    }

});
