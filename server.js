/*  ==============================================================
    Include required packages
=============================================================== */

var express = require('express.io'),
    fs = require('fs'),
    path = require('path'),
    routes = require('./routes'),
    ioEvents = require('./ioEvents')
    sessionSockets = require('session.socket.io'),
    opts = {};

/*  ==============================================================
    Configuration
=============================================================== */

//used for session and password hashes
var salt = '20sdkfjk23';



if (process.argv[2]) {
    if (fs.lstatSync(process.argv[2])) {
        config = require(process.argv[2]);
    } else {
        config = require(process.cwd()+'/settings.json');
    }
} else {
    config = require(process.cwd()+'/settings.json');
}

if ("log" in config) {
    var access_logfile = fs.createWriteStream(config.log, {flags: 'a'})
}

if ("ssl" in config) {

    if (config.ssl.key) {
        opts["key"] = fs.readFileSync(config.ssl.key);
    }

    if (config.ssl.cert) {
        opts["cert"] = fs.readFileSync(config.ssl.cert);
    }

    if (config.ssl.ca) {
        opts["ca"] = [];
        config.ssl.ca.forEach(function (ca, index, array) {
            opts.ca.push(fs.readFileSync(ca));
        });
    }

    console.log("Express will listen: https");

}

routes.setKey("configs", config);
routes.initialize();

var app = module.exports = express(opts);

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Range, Content-Disposition, Content-Description');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

// Configuration

var cookieParser = express.cookieParser();
app.configure(function(){
    if ("log" in config) {
        app.use(express.logger({stream: access_logfile }));
    }
    app.use(cookieParser);
    app.use(express.session({
        secret: salt,
        maxAge: new Date(Date.now()+3600000)
    }));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(allowCrossDomain);
    app.use('/bootstrap', express.static(__dirname + '/vendors/bootstrap'));
    app.use('/css', express.static(__dirname + '/public/css'));
    app.use('/vendors', express.static(__dirname + '/vendors'));
    app.use('/js', express.static(__dirname + '/public/js'));
    app.use('/images', express.static(__dirname + '/public/images'));
    app.use('/font', express.static(__dirname + '/public/font'));
    app.use(app.router);
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

//delete express.bodyParser.parse['multipart/form-data'];
//app.use(express.favicon(__dirname + '/public/favicon.ico'));


/*  ==============================================================
    Serve the site skeleton HTML to start the app
=============================================================== */

var port = ("port" in config) ? config.port : 3001;
if ("ssl" in config) {
    var server = app.https(opts).io();
} else {
    var server = app.http().io();
}
ioEvents.initialize({'app': app});
routes.setKey("io", app.io);

/*  ==============================================================
    Routes
=============================================================== */

// API:Documents
app.get('/api/registrants/:category/:search/:page', routes.registrants);
//app.put('/json/document/:id', routes.addDocument);
//app.post('/json/document', routes.addDocument);
//app.get('/json/document/:id', routes.getDocument);
//app.put('/json/document/:id/version/:versionId', routes.updateDocument);
//app.del('/json/document/:id', routes.deleteDocument);

// API:Timeline
//app.get('/json/timeline', routes.getTimeline);

app.get('*', routes.index);

/*  ==============================================================
    Socket.IO Routes
=============================================================== */

app.io.route('ready', ioEvents.connection);

/*  ==============================================================
    Launch the server
=============================================================== */

server.listen(port);
console.log("Express server listening on port %d", port);
