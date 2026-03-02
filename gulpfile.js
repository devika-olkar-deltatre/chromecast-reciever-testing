var gulp = require('gulp'),
    del = require('del'),
    uglify = require('gulp-uglify'),
    concat = require('gulp-concat'),
    rename = require('gulp-rename'),
    notify = require("gulp-notify"),
    uglifycss = require('gulp-uglifycss'),
    util = require('gulp-util'),
    sass = require('gulp-sass'),
    file = require('gulp-file'),
    through = require('through2'),
    ftp = require('vinyl-ftp'),
    markdown = require('gulp-markdown'),
    livereload = require('gulp-livereload'),
    inject = require('gulp-inject-string'),
    injectVersion = require('gulp-inject-version');
    

var onError = function(err) {
    notify.onError({
        title: "Gulp",
        subtitle: "Failure!",
        message: "Error: <%= error.message %>",
        sound: "Beep"
    })(err);

    this.emit('end');
};


var remotePath = process.env.FOLDER;
var config = {
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASS,
    parallel: 10,
    log: util.log
};

var conn = ftp.create(config);

gulp.task('deploy', function(cb) {
    conn.rmdir([remotePath + "/**", "!" + remotePath + "/.", "!" + remotePath + "/.."  ], function(err) {
        if (err) {
            return cb( err );
        }

        setTimeout(function(){
            gulp.src('dist/**', { base: 'dist/', buffer: false })
                .pipe(conn.newerOrDifferentSize(remotePath))
                .pipe(conn.dest(remotePath))
        } , 1000);

    });

    return;
});

gulp.task('clean', function() {
    return del('./dist/**/*') && del('./dist/*');
});

gulp.task('doc', ['static'], function() {
    return gulp.src('readme.md')
        .pipe(markdown())
        .pipe(rename('readme.html'))
        .pipe(gulp.dest('dist'));
});

gulp.task('minifyJS', ['clean'], function() {
    return gulp.src([
            "src/diva.js",
        ])
        .pipe(injectVersion())
        //.pipe(uglify().on('error', onError))
        .pipe(rename('diva.min.js'))
        .pipe(gulp.dest('./tmp'));
});

gulp.task('js', ['minifyJS'], function() {

    return gulp.src([
            "src/diva_header.js",
            "src/lib/cast_receiver_framework.js",
            "src/lib/hls.min.js",
            "src/lib/shaka-player.compiled.js",
            "src/lib/conviva_integration.min.js",
            "tmp/diva.min.js"
        ])
        .pipe(concat('diva.min.js'))
        .pipe(injectVersion())
        .pipe(inject.replace('%%GULP_INJECT_DATE%%',Date()))
        .pipe(gulp.dest('./dist'))
        .pipe(through.obj(function(file, enc, cb) {
          del("tmp");
          this.push(file);
          cb();
        })); 

});

// --- Basic Tasks ---
gulp.task('css', ['js'], function() {
    gulp.src('src/**/*.scss')
        .pipe(
            sass({
                includePaths: ['sass'],
                errLogToConsole: true
            }).on('error', onError))
        .pipe(concat("diva.css"))
        .pipe(gulp.dest('./src'))
        .pipe(uglifycss({
            "uglyComments": true
        }))
        .pipe(rename('diva.min.css'))
        .pipe(gulp.dest('./dist'));
});

gulp.task('static', ['css'],function() {
    gulp.src("src/index-dist.html")
        .pipe(rename('index.html'))
        .pipe(gulp.dest("./dist"));

    gulp.src("src/img/**/*")
        .pipe(gulp.dest("./dist/img"));

    return;

});

gulp.task('watch', ['dist'], function() {

    livereload.listen();

    gulp.watch('src/**/*.js', ['dist', 'reload']);
    gulp.watch('src/**/*.scss', ['dist', 'reload']);
    gulp.watch('src/**/*.html', ['dist', 'reload']);

});

gulp.task('reload', function() {
    livereload.reload();
});

gulp.task('dist', ['clean', 'minifyJS', 'js', 'css', 'static', 'doc']);

gulp.task('default', ['watch']);
