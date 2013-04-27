var fs = require('fs'),
    path = require('path'),
    parser = require('uglify-js'),
    glob = require("glob");
/*  ==============================================================
    Bundle + minify scripts & templates before starting server
=============================================================== */

var models = [
    'js/models/Registrant',
    'js/models/RegistrantBiller',
    'js/models/LinkedRegistrants',
    'js/models/Payment',
    'js/models/Payments',
    'js/models/Registrants',
    'js/models/Event',
    'js/models/Events',
    'js/models/Timeline'
];
var views = [
    'js/views/AcceptPaymentView',
    'js/views/AddRegistrantView',
    'js/views/RegistrantsView',
    'js/views/RegistrantView',
    'js/views/DashboardView',
    'js/views/RegistrantDataView',
    'js/views/RegistrantBillerView',
    'js/views/LinkedRegistrantView',
    'js/views/RegistrantPaymentView',
    'js/views/SingleRegistrantView',
    'js/views/AppView'
];
var routers = [
    'js/router/Router'
];
var app = [
    'js/App'
];
var data = [
    'js/data/Countries'
];
var templates = [
    'registrant',
    'registrants',
    'dashboard',
    'header',
    'linkedRegistrant',
    'payment',
    'acceptPayment'
];

var vendors = [
    'jquery.min',
    'jquery-ui.min',
    'jquery.ui.widget',
    'json2',
    'underscore/underscore',
    'handlebars',
    'backbone/backbone',
    'backbone-schema',
    'backbone.nestCollection',
    'backbone-dotattr',
    'backbone-forms/distribution/backbone-forms',
    'backbone-forms/distribution/editors/list',
    'backbone-forms/distribution/templates/bootstrap',
    'backbone-form-typeahead',
    'backbone-form-custom-editors',
    'backbone-pageable/lib/backbone-pageable',
    'backbone.bootstrap-modal/src/backbone.bootstrap-modal',
    'machina/lib/machina',
    'jquery.tagsinput.min',
    'jquery.masonry.min',
    'jquery.iframe-transport',
    'select2/select2',
    'moment',
    'bootstrap-datepicker/js/bootstrap-datepicker',
    'bootstrap-typeahead',
    'bootstrap/bootstrap/js/bootstrap',
    'jquery.iframe-transport',
    'jquery.fileupload',
    'jquery.fileupload-fp',
    'jquery.fileupload-ui',
    'jquery.blockUI',
    'bootstrap-notify/js/bootstrap-notify',
    'bootstrap-switch/static/js/bootstrapSwitch',
    'toolbar/jquery.toolbar',
    'bootstrap-select/bootstrap-select',
    'backgrid/lib/backgrid',
    'backgrid/lib/extensions/paginator/backgrid-paginator',
    'swag/lib/swag',
    'jQuery-CreditCardValidator/jquery.creditCardValidator'
];

var bundle = '';
models.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("model file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
views.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("view file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
routers.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("router file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
app.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.js')) {
        console.log("app file: ", __dirname + '/public/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.js') + "\n\n";
    }
});
var ast = parser.parse(bundle);
//ast = uglifyer.ast_mangle(ast);
//ast = uglifyer.ast_squeeze(ast);
//bundle = uglifyer.gen_code(ast);
console.log('Writing bundle.js');
fs.writeFileSync(__dirname + '/public/js/bundle.js', bundle, 'utf8');

var bundle = '';
vendors.forEach(function(file) {
    if (fs.existsSync(__dirname + '/vendors/' + file + '.js')) {
        console.log("vendor file: ", __dirname + '/vendors/' + file + '.js');
        bundle += "\n/**\n* " + file + ".js\n*/\n\n" + fs.readFileSync(__dirname + '/vendors/' + file + '.js') + "\n\n";
    }
});
var ast = parser.parse(bundle);
//ast = uglifyer.ast_mangle(ast);
//ast = uglifyer.ast_squeeze(ast);
//bundle = uglifyer.gen_code(ast);
console.log('Writing vendor.js');
fs.writeFileSync(__dirname + '/public/js/vendor.js', bundle, 'utf8');

var bundle = '';
data.forEach(function(file) {
    if (fs.existsSync(__dirname + '/public/' + file + '.json')) {
        console.log("data file: ", __dirname + '/public/' + file + '.json');
        bundle += "\n/**\n* " + file + ".json\n*/\n\n" + fs.readFileSync(__dirname + '/public/' + file + '.json') + "\n\n";
    }
});
var ast = parser.parse(bundle);
//ast = uglifyer.ast_mangle(ast);
//ast = uglifyer.ast_squeeze(ast);
//bundle = uglifyer.gen_code(ast);
console.log('Writing data.js');
fs.writeFileSync(__dirname + '/public/js/data.js', bundle, 'utf8');

bundle = "Templates = {};\n";
templates.forEach(function(file) {

        if (fs.existsSync(__dirname + '/public/templates/' + file + '.html')) {
            console.log("template file: ",__dirname + '/public/templates/' + file + '.html');
            var html = fs.readFileSync(__dirname + '/public/templates/' + file + '.html', 'utf8');
            html = html.replace(/(\r\n|\n|\r)/gm, ' ').replace(/\s+/gm, ' ').replace(/'/gm, "\\'");
            bundle += "Templates." + file + " = '" + html + "';\n";
        }
});

console.log('Writing template.js');
fs.writeFileSync(__dirname + '/public/js/templates.js', bundle, 'utf8');


delete bundle;
delete ast;

