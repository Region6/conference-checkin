var AddRegistrantView = Backbone.View.extend({
    events: {

    },

    initialize: function() {
        _.bindAll(this, 'render', 'okClicked');
        this.bind("ok", this.okClicked);
        this.genEvent = App.Models.events.where({reg_type: "general", member: 1})[0];
    },

    render: function() {
        var vars        = this.model.attributes,
            view        = this;

        this.form = new Backbone.Form({
            schema: this.genEvent.get('fields'),
            fieldsets: [{
                "fields": this.genEvent.get("fieldset")
            }]
        }).render();

        $(this.$el).append(this.form.$el);

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

    okClicked: function (modal) {
        this.model.set(this.form.getValue()); // runs schema validation
        this.model.set({
            "eventId": this.genEvent.get('eventId'),
            "slabId": this.genEvent.get('local_slabId')
        });
        this.model.save({}, {success: function(model, response, options) {
            App.Models.registrants.reset(model);
            App.Router.navigate("registrant/"+model.id, true);
        }});
    }

});
