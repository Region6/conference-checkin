var RegistrantBiller = Backbone.Collection.extend({
    model: Registrant,
    idAttribute: "id",
    url: function(){
        return this.parent.url() + "/biller";
    }
});