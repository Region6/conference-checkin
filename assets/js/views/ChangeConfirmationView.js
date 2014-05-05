var ChangeConfirmationView = Backbone.View.extend({
    events: {
        "keypress #confirmnum"      :   "changeConfirmationOnEnter"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'changeConfirmation', 'changeConfirmationOnEnter');
        this.parent = opts.parent;
        this.bind("ok", this.changeConfirmation);
        this.bind("shown", this.shown);
    },

    render: function() {
        var vars        = this.model.attributes,
            view        = this;

        this.form = new Backbone.Form({
            schema: {
                confirmnum: {type:"Text", title:"Confirmation #"}
            },
            data: {
                confirmnum: this.parent.model.get("confirmation")
            }
        }).render();

        this.$el.append(this.form.$el);
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

    shown: function(e) {
        $("#confirmnum", this.$el).focus();
    },

    changeConfirmationOnEnter: function(e) {
        if (e.keyCode != 13) return;
        //this.makePayment(e);
    },

    changeConfirmation: function(e) {
        var values = this.form.getValue(),
            view = this;
        this.model.save({"fields": {"confirmnum": values.confirmnum} }, {patch: true, success: function(model, response) {
            view.parent.savedRegistrant(model, view);
            modal.close();
        }});
    }

});
