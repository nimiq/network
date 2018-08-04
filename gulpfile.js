const gulp = require('gulp');

const NimiqBuild = require('../../meta/build-process/nimiq-base-gulpfile.js');

gulp.task('clean', () => NimiqBuild.cleanBuild('deployment-network/dist'));

gulp.task('build', gulp.series('clean', () => NimiqBuild.build({
    jsEntry: 'src/network.js',
    htmlEntry: 'src/index.html',
    rootPath: `${__dirname}/../../`,
    distPath: 'deployment-network/dist',
    minify: false
})));

gulp.task('default', gulp.series('build'));
