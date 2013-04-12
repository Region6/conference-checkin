var app = null;

exports.connection = function (req) {
    req.io.emit('talk', {
        message: 'io event from an io route on the server',
        user: req.session
    });
    console.log("socet.id:", req.data.user, "-", req.socket.id);
};


exports.initialize = function(opts) {
    app = opts.app;
};
