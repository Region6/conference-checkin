var RegistrantView = Backbone.View.extend({
    events: {
        "click #goBack"             :   "goBack",
        "click #btn-submit"         :   "saveRegistrant",
        "click .acceptPayment"      :   "acceptPayment",
        "click .printBadge"         :   "printBadge",
        "click .downloadBadge"      :   "downloadBadge",
        "click .printReceipt"       :   "printReceipt",
        "click .viewReceipt"        :   "viewReceipt",
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
            'printReceipt',
            'checkIn',
            'checkOut',
            'savedRegistrant',
            'changeConfirmation',
            'renderLinked',
            'renderPayment',
            'renderError'
        );
        this.error = null;
        this.model.on('change', this.render, this); // Event listener on collection
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
        var biller      = this.model.get('biller'),
            vars        = this.model.attributes,
            view        = this;
        var html = Templates.registrant(vars);
        this.$el.html(html);
        $('#app').append(this.$el);

        this.model.get("fields").schema = this.model.get("schema").toJSON();
        biller.schema = biller.get("schema").toJSON();

        this.form = new Backbone.Form({
            model: this.model

        }).render();

        $("#info", this.$el).append(this.form.$el);

        this.billerForm = new Backbone.Form({
            model: biller
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
        this.model.get("linked").each(function(person) {
            if (view.model.get("id") !== person.get("id")) {
                person.id = person.get("registrantId");
                var personV = new LinkedRegistrantView({ parent: view, model: person });
                personV.on('modelUpdate', view.refresh, view);
                personV.render();
                $('#linkedRegistrants tbody', view.$el).append(personV.$el);
            }
        });
    },

    renderPayment: function() {
        var view = this;
        $('#registrantPayments tbody', view.$el).empty();
        this.model.get("payments").each(function(payment) {
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
            //view.savedRegistrant(model, view);
        }});
    },

    acceptPayment: function(e) {
        var newPay = new Payment();
            view = new AcceptPaymentView({parent: this, model:newPay});
        this.acceptPaymentModal = new Backbone.BootstrapModal({ title: 'Accept Payment', content: view });
        this.acceptPaymentModal.open();

    },

    printBadge: function(e) {
        $.getJSON("/registrant/"+this.model.id+"/badge/print", function(data) {
            console.log(data);
        });
    },

    downloadBadge: function(e) {
        window.open(this.model.id+"/badge/download", '_blank');
    },

    printReceipt: function(e) {
        $.getJSON("/registrant/"+this.model.id+"/receipt/print", function(data) {
            console.log(data);
        });
    },

    viewReceipt: function(e) {
        window.open(this.model.id+"/receipt/view", '_blank');
    },

    checkIn: function(e) {
        var view = this;
        this.model.save({"fields": {"attend": true} }, {patch: true});
    },

    checkOut: function(e) {
        var view = this;
        this.model.save({"fields": {"attend": false} }, {patch: true});
    },

    savedRegistrant: function(model, view) {
        view = this;
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
