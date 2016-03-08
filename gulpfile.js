var path  = require('path');
var gulp  = require('gulp');
var shell = require('gulp-shell');

var taskPath = path.resolve('./node_modules/.bin/tsc');
// build
gulp.task('build', shell.task([ taskPath ]));

// default
gulp.task('default', ['build']);