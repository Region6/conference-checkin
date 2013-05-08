/*  ==============================================================
    Include required packages
=============================================================== */

var express = require('express.io'),
    fs = require('fs'),
    path = require('path'),
    routes = require('./routes'),
    ioEvents = require('./ioEvents')
    redis = require("redis"),
    redisClient = redis.createClient(),
    redisStore = require('connect-redis')(express),
    opts = {};

/*  ==============================================================
    Configuration
=============================================================== */

//used for session and password hashes
var salt = '20sdkfjk23';

fs.exists(__dirname + '/tmp', function (exists) {
    if (!exists) {
        fs.mkdir(__dirname + '/tmp', function (d) {
            console.log("temp directory created");
        });
    }
});

if (process.argv[2]) {
    if (fs.lstatSync(process.argv[2])) {
        config = require(process.argv[2]);
    } else {
        config = require(process.cwd()+'/settings.json');
    }
} else {
    config = require(__dirname + '/settings.json');
}

if ("log" in config) {
    var access_logfile = fs.createWriteStream(config.log, {flags: 'a'})
}

if ("redis" in config) {
    var redisConfig = config.redis;
    redisConfig.client = redisClient;
} else {
    var redisConfig = {
        "host": "localhost",
        "port": "6379",
        "ttl": 43200,
        "db": "conference-checkin"
    };
    redisConfig.client = redisClient;
}

var cookieParser = express.cookieParser(),
    redisSessionStore = new redisStore(redisConfig);

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

app.configure(function(){
    if ("log" in config) {
        app.use(express.logger({stream: access_logfile }));
    }
    app
        .use(cookieParser)
        .use(express.bodyParser())
        .use(express.methodOverride())
        .use(allowCrossDomain)
        .use(express.session({
            store: redisSessionStore,
            secret: salt
        }))
        .use('/bootstrap', express.static(__dirname + '/vendors/bootstrap'))
        .use('/css', express.static(__dirname + '/public/css'))
        .use('/vendors', express.static(__dirname + '/vendors'))
        .use('/js', express.static(__dirname + '/public/js'))
        .use('/images', express.static(__dirname + '/public/images'))
        .use('/font', express.static(__dirname + '/public/font'))
        .use(app.router)
        .use(express.errorHandler({ dumpExceptions: true, showStack: true }));
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

// API:Registrants
app.get('/api/registrants/:category/:search', routes.registrants);
app.get('/api/registrant/:id', routes.getRegistrant);
app.put('/api/registrant/:id', routes.updateRegistrantValues);
app.post('/api/registrant', routes.addRegistrant);
app.patch('/api/registrant/:id', routes.updateRegistrant);
//app.post('/json/document', routes.addDocument);
//app.get('/json/document/:id', routes.getDocument);
//app.put('/json/document/:id/version/:versionId', routes.updateDocument);
//app.del('/json/document/:id', routes.deleteDocument);

// Generate Badge
app.get('/registrant/:id/badge/:action', routes.genBadge);

// Generate Receipt
app.get('/registrant/:id/receipt/:action', routes.genReceipt);

//API:Events
app.get('/api/events', routes.getEvents);
app.get('/api/events/:id/fields', routes.getEventFields);

app.post('/api/payment', routes.makePayment);
app.get('/api/getNumberCheckedIn', routes.getNumberCheckedIn);
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
