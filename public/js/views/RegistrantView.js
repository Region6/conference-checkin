var RegistrantView = Backbone.View.extend({
    events: {
        "click #goBack"             :   "goBack",
        "click #btn-submit"         :   "saveRegistrant",
        "click .acceptPayment"      :   "acceptPayment",
        "click .printBadge"         :   "printBadge",
        "click .downloadBadge"      :   "downloadBadge",
        "click .printInvoice"       :   "printInvoice",
        "click .checkIn"            :   "checkIn",
        "click .checkOut"           :   "checkOut",
        "click .changeConfirmation" :   "changeConfirmation"
    },

    initialize: function() {
        _.bindAll(this,
            'render',
            'goBack',
            'saveRegistrant',
            'acceptPayment',
            'printBadge',
            'downloadBadge',
            'printInvoice',
            'checkIn',
            'checkOut',
            'savedRegistrant',
            'changeConfirmation',
            'renderLinked',
            'renderPayment',
            'renderError'
        );
        this.error = null;
    },

    fetch: function(nextAction) {
        var view = this;
        this.model.fetch({success: function(model, response, options) {
            if (typeof nextAction != "undefined") {
                if (nextAction == "linked") {
                    view.renderLinked();
                } else if (nextAction == "payment") {
                    view.renderPayment();
                }
            }
        }});
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

        this.renderLinked();
        this.renderPayment();

        if (this.error ) {
            this.renderError();
        }

        return this;
    },

    renderLinked: function() {
        var view = this;
        $('#linkedRegistrants tbody', view.$el).empty();
        _(this.model.linked.models).each(function(person) {
            if (view.model.get("id") !== person.get("id")) {
                var personV = new LinkedRegistrantView({ parent: view, model: person });
                personV.on('modelUpdate', view.refresh, view);
                personV.render();
                $('#linkedRegistrants tbody', view.$el).append(personV.$el);
            }
        });
    },

    renderPayment: function() {
        var view = this;
        $('#linkedPayments tbody', view.$el).empty();
        _(this.model.payment.models).each(function(payment) {
            var paymentV = new RegistrantPaymentView({ parent: view, model: payment });
            paymentV.on('modelUpdate', view.refresh, view);
            paymentV.render();
            $('#registrantPayments tbody', view.$el).append(paymentV.$el);
        });
    },

    renderError: function() {
        var html = '<div class="row-fluid"><div class="span10"><div class="alert alert-error"><button type="button" class="close" data-dismiss="alert">&times;</button>',
            view = this;
        _(this.errors).each(function(error) {
            html += '<p>'+error.errorText+'</p>';
        });
        html += '</div></span></div>';
        $('.registrantBody', view.$el).prepend(html);
        this.errors = null;
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
        var view = this,
            errors = this.form.commit(); // runs schema validation
        this.model.save({},{success: function(model, response) {
            view.savedRegistrant(model, view);
        }});
    },

    acceptPayment: function(e) {
        var newPay = new Payment();
            view = new AcceptPaymentView({parent: this, model:newPay});
        this.acceptPaymentModal = new Backbone.BootstrapModal({ title: 'Accept Payment', content: view });
        this.acceptPaymentModal.open();

    },

    printBadge: function(e) {
        $.getJSON("registrant/"+this.model.id+"/badge/print", function(data) {
            console.log(data);
        });
    },

    downloadBadge: function(e) {
        window.open(this.model.id+"/badge/download", '_blank');
    },

    printInvoice: function(e) {

    },

    checkIn: function(e) {
        var view = this;
        this.model.save({"attend": 1}, {patch: true, success: function(model, response) {
            view.savedRegistrant(model, view);
        }});
    },

    checkOut: function(e) {
        var view = this;
        this.model.save({"attend": 0}, {patch: true, success: function(model, response) {
            view.savedRegistrant(model, view);
        }});
    },

    savedRegistrant: function(model, view) {
        var view = this;
        this.model.fetch({success: function(model, response, options) {
            view.render();
        }});
    },

    changeConfirmation: function(e) {
        var view = new ChangeConfirmationView({parent: this, model:this.model});
        this.changeConfirmationModal = new Backbone.BootstrapModal({ title: 'Change Confirmation', content: view });
        this.changeConfirmationModal.open();

    }
});
