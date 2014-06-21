module.exports = function(grunt) {

    // Load grunt tasks automatically
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        jsdoc: {
            src: ['js/*.js'],
            options: {
                destination: 'doc'
            }
        },

        jshint: {
            options: {
                curly: true,
                browser: true,
                globals: {
                    define: true
                }
            },
            all: ["Gruntfile.js", "js/*.js"]
        },

        jsbeautifier: {
            verify: {
                src: ['Gruntfile.js', 'js/*.js'],
                options: {
                    mode: 'VERIFY_ONLY'
                }
            },
            modify: {
                src: ['Gruntfile.js', 'js/*.js']
            }
        },

        uglify: {
            debug: {
                options: {
                    mangle: false,
                    compress: false,
                    beautify: true
                },
                files: {
                    'dist/boplish.js': ["dist/*.js"]
                }
            },
            production: {
                options: {
                    mangle: true,
                    compress: true,
                    beautify: false,
                    report: 'min'
                },
                files: {
                    'dist/boplish.min.js': ["dist/*.js"]
                }
            }
        },

        copy: {
            dist: {
                files: [{
                    expand: true,
                    dot: true,
                    cwd: 'js',
                    dest: 'dist',
                    src: [
                        '*.js',
                    ]
                }]
            }
        },

        // Empties folders to start fresh
        clean: {
            dist: {
                files: [{
                    dot: true,
                    src: [
                        'dist/*',
                    ]
                }]
            }
        },

        browserify: {
            debug: {
                files: {
                    'dist/boplish-browserified-debug.js': ['js/*.js']
                },
            },
            dist: {
                files: {
                    'dist/boplish-browserified-dist.js': ['js/*.js']
                },
                options: {
                    transform: ['uglifyify']
                }
            }
        },

        simplemocha: {
            options: {
                ignoreLeaks: false,
                ui: 'bdd',
                reporter: 'dot'
            },

            all: {
                src: ['test/*-test.js']
            }
        }
    });

    grunt.registerTask('beautify', 'jsbeautifier:modify');
    grunt.registerTask('verify', 'jsbeautifier:verify');
    grunt.registerTask('dist', ['clean', 'browserify:dist']);
    grunt.registerTask('debug', ['clean', 'browserify:debug']);
    grunt.registerTask('test', 'simplemocha:all');
    grunt.registerTask('test:chord', 'simplemocha:chord');
    grunt.registerTask('default', ['jsdoc', 'jshint', 'test', 'beautify', 'dist']);
};
