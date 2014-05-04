var Events = Backbone.Collection.extend({
    model: Event,
    idAttribute: "id",
    url: "/api/events"
});
