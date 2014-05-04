var LinkedRegistrant = Backbone.SuperModel.extend({
  //urlRoot: '/api/registrant',
  idAttribute: "registrantId",
  urlRoot: "/api/registrant/",
  relations: {
    'linked': LinkedRegistrant,
    'payments': Payment,
    'biller': Biller
  }
});
