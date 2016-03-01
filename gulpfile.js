var gulp  = require('gulp')
var shell = require('gulp-shell')

// build
gulp.task('build', shell.task([ './node_modules/.bin/tsc' ]));

// default
gulp.task('default', ['build']);