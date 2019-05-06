let io;

module.exports.init = (socket) => {
  io = socket;
};

module.exports.emitCount = (count) => {
  io.emit('count', count);
};