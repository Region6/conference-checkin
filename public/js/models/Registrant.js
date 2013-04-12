var Registrant = Backbone.Model.extend({
    //urlRoot: '/api/registrant',
    idAttribute: "id",
    defaults: {
        url: 'http://'
    },
    initialize: function() {

    },
    set: function(attributes, options) {
        var ret = Backbone.Model.prototype.set.call(this, attributes, options);
        //this.biller = nestCollection(this, 'biller', new Biller(this.get('biller')));
        return ret;
    },
    url: function(){
        return this.parent.url() + "/registrant/"+this.id;
    }
});
