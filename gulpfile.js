const gulp = require('gulp');

const NimiqBuild = require('../../meta/build-process/nimiq-base-gulpfile.js');

gulp.task('build', () => NimiqBuild.build(
    'network.js',
    'dummy.css',
    'network.html',
    [],
    `${__dirname}/../../`,
    'dist',
    true
));