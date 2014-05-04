var AcceptPaymentView = Backbone.View.extend({
    events: {
        "click .cc"             :   "renderCC",
        "click .mcc"            :   "renderMCC",
        "click .ck"             :   "renderCheck",
        "keypress #swipe"       :   "makePaymentOnEnter"
    },

    initialize: function(opts) {
        _.bindAll(this, 'render', 'makePayment', 'makePaymentOnEnter', 'renderCC', 'renderMCC', 'renderCheck', 'shown');
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
        var template    = Templates.acceptPayment(),
            vars        = this.model.attributes,
            view        = this;

        this.$el.html(template);
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

    renderCC: function() {
        var view = this;
        this.form = new Backbone.Form({
            schema: {
                amount: {type:"Number", title:"Amount to be charged"},
                swipe: {type: "Text"}
            }
        }).render();

        $(".paymentControls", this.$el).html(this.form.$el);

        $('.paymentControls form', this.$el).bind("keypress", function(e) {
            var code = e.keyCode || e.which;
            if (code  == 13) {
                e.preventDefault();
                view.makePayment(e);
                return false;
            }
        });
        $("#swipe", this.$el).focus();

    },

    renderMCC: function() {
        var view = this;
        this.form = new Backbone.Form({
            schema: {
                amount: {type:"Number", title:"Amount to be charged"},
                fullName: {type: "Text", title:"Card Holder's Name"},
                cardNumber: {type: "Text", title:"Card Number"},
                address: {type: "Text", title:"Street Address"},
                city: {type: "Text", title:"City"},
                state: {type: "Text", title:"State"},
                zip: {type: "Text", title:"Zip"},
                expirationMonth: { type: "Select", options: this.months, title: "Expiration Month" },
                expirationYear: { type: "Select", options: ["2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020"], title: "Expiration Year" },
                cardCode: { type: "Text", title:"Card Security Number" },
            },
            data: {
                fullName: this.parent.model.get("firstname") + " " + this.parent.model.get("lastname"),
                address: this.parent.model.get("street1"),
                city: this.parent.model.get("city"),
                state: this.parent.model.get("state"),
                zip: this.parent.model.get("zipcode"),
            }
        }).render();

        $(".paymentControls", this.$el).html(this.form.$el);
        $("#creditCardTypes", this.$el).show();

        $("#cardNumber", this.$el).validateCreditCard(function(result){
                if (result.luhn_valid) {
                    console.log('CC type: ' + result.card_type.name +
                      '\nLength validation: ' + result.length_valid +
                      '\nLuhn validation:' + result.luhn_valid);

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

    renderCheck: function() {
        var view = this;
        this.form = new Backbone.Form({
            schema: {
                amount: {type:"Number", title:"Amount to be charged"},
                checkNumber: {type: "Text", title:"Check Number"}
            }
        }).render();

        $(".paymentControls", this.$el).html(this.form.$el);
        $("#creditCardTypes", this.$el).hide();
    },

    shown: function(e) {
        $("#swipe", this.$el).focus();
    },

    makePaymentOnEnter: function(e) {
        if (e.keyCode != 13) return;
        e.stopImmediatePropagation();
        //this.makePayment(e);
    },

    makePayment: function(e) {
        var view = this,
            values = this.form.getValue(),
            type = "credit",
            transaction = {
                "transactionType": "authCaptureTransaction",
                "amount": values.amount,
                "payment": {}
            },
            ccData, firstname, lastname, expiration, creditCard;
        if ("swipe" in values) {
            type = "swipe";
            ccData = new CreditCardTrackData(values.swipe);
            firstname = $.trim(ccData.first_name || this.parent.model.get("firstname"));
            lastname = $.trim(ccData.last_name || this.parent.model.get("lastname"));
            expiration = ccData.expiration.slice(2) + "/" + ccData.expiration.slice(0,-2);
            creditCard = {
              "creditCard" : {
                  "cardNumber": ccData.number,
                  "expirationDate": expiration
              }
            };
            transaction.payment = _.extend(
                transaction.payment,
                creditCard
            );
        } else if("checkNumber" in values) {
            type = "check";
            transaction.payment.checkNumber = values.checkNumber;
        } else {
            creditCard = {
              "creditCard" : {
                "cardNumber": values.cardNumber,
                "expirationDate": values.expirationMonth+"/"+values.expirationYear,
                "cardCode": values.cardCode
              }
            };
            var name = values.fullName.split(" ");
            transaction.payment = _.extend(
                transaction.payment,
                creditCard
            );
            firstname = name[0];
            lastname = "";
            if (name.length > 2) {
                lastname = name[2];
            } else {
                lastname = name[1];
            }
        }
        var orderInfo =  {
            "order": {
                "invoiceNumber": this.parent.model.get("confirmation")
            },
            "customer": {
                "email": this.parent.model.get("email")
            },
            "billTo":{},
            "shipTo":{}
        };
        transaction = _.extend(
            transaction,
            orderInfo
        );
        transaction.shipTo.firstName = transaction.billTo.firstName = firstname;
        transaction.shipTo.lastName = transaction.billTo.lastName = lastname;
        var address = {
            "address": values.address || this.parent.model.get("street1"),
            "city": values.city || this.parent.model.get("city"),
            "state": values.state || this.parent.model.get("state"),
            "zip": values.zip || this.parent.model.get("zipcode")
        };
        if (("swipe" in values) === false) {
            transaction.billTo = _.extend(
                transaction.billTo,
                address
            );
        }
        transaction.shipTo = _.extend(
            transaction.shipTo,
            address
        );

        this.model.set({registrant: this.parent.model, transaction:transaction, type: type});
        this.model.save({}, {success: function(model, response, options) {
            console.log(response);
            if ("code" in response) {
                if ("transactionResponse" in response) {
                    view.parent.errors = response.transactionResponse.errors;
                    view.parent.renderError();
                }
            } else if (response.creditResult.transaction.responseCode == 2) {
                view.parent.errors = response.creditResult.transaction.errors;
                view.parent.renderError();
            }
            view.unrender();
            view.parent.acceptPaymentModal.close();
            view.parent.fetch("payment");
        }});
    }

});
