var AcceptPaymentView = Backbone.View.extend({
    events: {
        "click .mcc"        :   "renderMCC",
        "click .cc"        :    "renderCC"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'okClicked', 'renderCC', 'renderMCC', 'shown');
        this.parent = opts.parent;
        this.bind("ok", this.makePayment);
        this.bind("shown", this.shown);
        this.genEvent = App.Models.events.where({reg_type: "general", member: 1})[0];
        this.months = [
            { val: 1, label: '01 Jan' },
            { val: 2, label: '02 Feb' },
            { val: 3, label: '03 Mar' },
            { val: 4, label: '04 Apr' },
            { val: 5, label: '05 May' },
            { val: 6, label: '06 Jun' },
            { val: 7, label: '07 Jul' },
            { val: 8, label: '08 Aug' },
            { val: 9, label: '09 Sep' },
            { val: 10, label: '10 Oct' },
            { val: 11, label: '11 Nov' },
            { val: 12, label: '12 Dec' }
        ];
        this.creditCards = {
            "visa": "v",
            "mastercard": "m",
            "discover": "d",
            "amex": "a"
        };
    },

    render: function() {
        var source      = Templates.acceptPayment,
            template    = Handlebars.compile(source),
            html        = template(),
            vars        = this.model.attributes,
            view        = this;

        this.$el.html(html);
        this.renderCC();
        $(".payment", this.$el).button();
        $(".cc", this.$el).button('toggle');
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
        /*
        this.model.set({
            "eventId": this.genEvent.get('eventId'),
            "slabId": this.genEvent.get('local_slabId')
        });
        this.model.save({}, {success: function(model, response, options) {
            App.Models.registrants.reset(model);
            App.Router.navigate("registrant/"+model.id, true);
        }});
        */
    },

    renderCC: function() {

        this.form = new Backbone.Form({
            schema: {
                swipe: {type: "Text"}
            }
        }).render();

        $(".paymentControls", this.$el).html(this.form.$el);

    },

    renderMCC: function() {
        var view = this;
        this.form = new Backbone.Form({
            schema: {
                amount: {type:"Number", title:"Amount to be charged"},
                fullName: {type: "Text", title:"Card Holder's Name"},
                cardNumber: {type: "Text", title:"Card Number"},
                expirationMonth: { type: "Select", options: this.months, title: "Expiration Month" },
                expirationYear: { type: "Select", options: ["2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020"], title: "Expiration Year" },
                cardCode: { type: "Text", title:"Card Security Number" },
            }
        }).render();

        $(".paymentControls", this.$el).html(this.form.$el);

        $("#cardNumber", this.$el).validateCreditCard(function(result){
                if (result.luhn_valid) {
                    console.log('CC type: ' + result.card_type.name
                      + '\nLength validation: ' + result.length_valid
                      + '\nLuhn validation:' + result.luhn_valid);

                    $("#mc", this.$el).toggleClass("mb").toggleClass("mc");
                    $("#vc", this.$el).toggleClass("vb").toggleClass("vc");
                    $("#dc", this.$el).toggleClass("db").toggleClass("dc");
                    $("#ac", this.$el).toggleClass("ab").toggleClass("ac");
                    var active = view.creditCards[result.card_type.name]+"c",
                        inactive = view.creditCards[result.card_type.name]+"b";
                    $("#"+active, this.$el).addClass(active).removeClass(inactive);
                } else {
                    $("#mc", this.$el).removeClass("mb").addClass("mc");
                    $("#vc", this.$el).removeClass("vb").addClass("vc");
                    $("#dc", this.$el).removeClass("db").addClass("dc");
                    $("#ac", this.$el).removeClass("ab").addClass("ac");
                }
            }
        );
    },

    shown: function(e) {
        $("#swipe", this.$el).focus();
    },

    makePayment: function(e) {
        var values = this.form.getValue(),
            transaction = {
                "transactionType": "authCaptureTransaction",
                "amount": values.amount,
                "payment": {
                    "creditCard" : {
                        "cardNumber": values.cardNumber,
                        "expirationDate": values.expirationMonth+"/"+values.expirationYear
                    }
                },
                "order": {
                    "invoiceNumber": this.parent.model.get("confirmation")
                },
                "customer": {
                    "email": "voss.matthew@gmail.com"//this.parent.model.get("email")
                },
                "billTo":{},
                "shipTo":{}
            },
            name = values.fullName.split(" ");
        transaction.shipTo.firstName = transaction.billTo.firstName = name[0];
        if (name.length > 2) {
            transaction.shipTo.lastName = transaction.billTo.lastName = name[2];
        } else {
            transaction.shipTo.lastName = transaction.billTo.lastName = name[1];
        }
        transaction.billTo = _.extend(
            transaction.billTo,
            {
                "address": this.parent.model.get("street1"),
                "city": this.parent.model.get("city"),
                "state": this.parent.model.get("state"),
                "zip": this.parent.model.get("zipcode"),
                "phoneNumber": this.parent.model.get("phone")
            }
        );
        transaction.shipTo = _.extend(
            transaction.shipTo,
            {
                "address": this.parent.model.get("street1"),
                "city": this.parent.model.get("city"),
                "state": this.parent.model.get("state"),
                "zip": this.parent.model.get("zipcode"),
                "phoneNumber": this.parent.model.get("phone")
            }
        );

        this.model.set(transaction);
        this.model.save({}, {success: function(model, response, options) {
            console.log(response);
        }});
    }

});
