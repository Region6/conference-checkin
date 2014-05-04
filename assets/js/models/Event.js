var Event = Backbone.Model.extend({
    idAttribute: "id",
    initialize: function() {

    },
    url: function(){
        return this.parent.url() + "/event/"+this.id;
    }
});
