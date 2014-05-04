var Payments = Backbone.Collection.extend({
    model: Payment,
    idAttribute: "id",
    url: function(){
        return this.parent.url() + "/payments";
    }
});
