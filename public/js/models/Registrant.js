var Registrant = Backbone.Model.extend({
    //urlRoot: '/api/registrant',
    idAttribute: "id",
    defaults: {
        url: 'http://'
    },
    urlRoot: "/api/registrant/",
    initialize: function() {

    },
    set: function(attributes, options) {
        var ret = Backbone.Model.prototype.set.call(this, attributes, options);
        this.linked = nestCollection(this, 'linked', new LinkedRegistrants(this.get('linked')));
        this.payment = nestCollection(this, 'payment', new Payments(this.get('payment')));
        return ret;
    }
});
