var RegistrantView = Backbone.View.extend({
    events: {
        "click #goBack"             :   "goBack",
        "click #btn-submit"         :   "saveRegistrant",
        "click .acceptPayment"      :   "acceptPayment"
    },

    initialize: function() {
        _.bindAll(this, 'render', 'goBack', 'saveRegistrant', 'acceptPayment');
    },

    render: function() {
        var source      = Templates.registrant,
            template    = Handlebars.compile(source),
            biller      = new Registrant(this.model.attributes.biller),
            vars        = this.model.attributes,
            view        = this;
        var html = template(vars);
        this.$el.html(html);
        $('#app').append(this.$el);

        this.model.schema = this.model.get("schema");
        biller.schema = biller.get("schema");

        this.form = new Backbone.Form({
            model: this.model,
            fieldsets: [{
                "fields": this.model.get("fieldset")
            }]
        }).render();

        $("#info", this.$el).append(this.form.$el);

        this.billerForm = new Backbone.Form({
            model: biller,
            fieldsets: [{
                "fields": biller.get("fieldset")
            }]
        }).render();
        $("#biller", this.$el).append(this.billerForm.$el);

        _(this.model.linked.models).each(function(person) {
            if (view.model.id !== person.get("id")) {
                var personV = new LinkedRegistrantView({ model: person });
                personV.on('modelUpdate', view.refresh, view);
                personV.render();
                $('#linkedRegistrants tbody', view.$el).append(personV.$el);
            }
        });

        _(this.model.payment.models).each(function(payment) {
            if (view.model.id !== payment.get("id")) {
                var paymentV = new RegistrantPaymentView({ model: payment });
                paymentV.on('modelUpdate', view.refresh, view);
                paymentV.render();
                $('#registrantPayments tbody', view.$el).append(paymentV.$el);
            }
        });
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

    saveRegistrant: function(e) {
        var errors = this.form.commit(); // runs schema validation
        this.model.save({});
    },

    acceptPayment: function(e) {
        var newPay = new Payment();
            view = new AcceptPaymentView({parent: this, model:newPay});
        this.acceptPaymentModal = new Backbone.BootstrapModal({ title: 'Accept Payment', content: view });
        this.acceptPaymentModal.open();

    }

});
