var conditionalBreakpoint = require('./conditionalBreakpoint');
var outputEvent = require('./consoleLog');
var fileWithSpaces = require('./file with space in name');

function onNavigatingTo(args) {
    var page = args.object;
}
exports.onNavigatingTo = onNavigatingTo;