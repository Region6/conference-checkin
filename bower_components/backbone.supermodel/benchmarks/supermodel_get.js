var SuperModel = require('../build/backbone.supermodel.amd');

var model = new SuperModel();
model.set('attribute', 'value');

module.exports = function() {
  model.get('attribute');  
}