const gulp = require('gulp');

const argv = require('yargs').argv;

const NimiqBuild = require('../../meta/build-process/nimiq-base-gulpfile.js');

gulp.task('build', () => NimiqBuild.build(
    'src/network.js',
    'src/dummy.css',
    'src/index.html',
    [],
    `${__dirname}/../../`,
    'dist',
    argv.config,
    true
));

gulp.task('default', ['build']);
