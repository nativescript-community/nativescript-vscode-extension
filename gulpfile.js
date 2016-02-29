/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

var gulp = require('gulp');
var path = require('path');
var ts = require('gulp-typescript');
var log = require('gulp-util').log;
var typescript = require('typescript');
var sourcemaps = require('gulp-sourcemaps');
var mocha = require('gulp-mocha');

var sources = [
    'adapter',
    'common',
    'typings',
    'custom-typings',
    'webkit',
    'nativescript',
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

var projectConfig = {
    target: "es5",
    module: "commonjs",
    moduleResolution: "node",
    sourceMap: true,
    noImplicitAny: false,
    removeComments: false,
    preserveConstEnums: true,
    declarationFiles: true,
    typescript: typescript
};

gulp.task('build', function () {
    return gulp.src(sources, { base: '.' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig))
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: 'file:///' + __dirname }))
        .pipe(gulp.dest('out'));
});

gulp.task('watch', ['build'], function(cb) {
    log('Watching build sources...');
    return gulp.watch(sources, ['build']);
});

gulp.task('default', ['build']);

// Don't lint code from tsd or common, and whitelist my files under adapter
var lintSources = [
    'test',
    'webkit',
    'nativescript'
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });
lintSources = lintSources.concat([
    'adapter/sourceMaps/sourceMapTransformer.ts',
    'adapter/adapterProxy.ts',
    'adapter/lineNumberTransformer.ts',
    'adapter/pathTransformer.ts',
]);

var tslint = require('gulp-tslint');
gulp.task('tslint', function(){
      return gulp.src(lintSources, { base: '.' })
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});