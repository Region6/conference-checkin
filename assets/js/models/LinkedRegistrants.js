var LinkedRegistrants = Backbone.Collection.extend({
    model: LinkedRegistrant,
    idAttribute: "id",
    url: function(){
        return this.parent.url() + "/linkedRegistrants";
    }
});
