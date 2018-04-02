const gulp = require('gulp');

const NimiqBuild = require('../../meta/build-process/nimiq-base-gulpfile.js');

gulp.task('build', () => NimiqBuild.build({
    jsEntry: 'src/network.js',
    htmlEntry: 'src/index.html',
    rootPath: `${__dirname}/../../`,
    distPath: 'deployment-network/dist',
    minify: false
}));

gulp.task('default', ['build']);
