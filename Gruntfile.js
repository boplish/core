module.exports = function(grunt) {
    grunt.initConfig({
        jsdoc: {
            src: ['js/'],
            options: {
                destination: 'doc',
                recurse: true
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
            all: ["Gruntfile.js", "js/**/*.js"]
        },

        jsbeautifier: {
            verify: {
                src: ['Gruntfile.js', "js/**/*.js"],
                options: {
                    mode: 'VERIFY_ONLY'
                }
            },
            modify: {
                src: ['Gruntfile.js', "js/**/*.js"]
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
                    'dist/boplish.min.js': ["js/**/*.js"]
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
                    'dist/boplish.min.js': ["js/**/*.js"]
                }
            }
        },

        simplemocha: {
            options: {
                ignoreLeaks: false,
                ui: 'bdd',
                reporter: 'spec'
            },

            all: {
                src: ['test/*-test.js']
            },

            chord: {
                src: ['test/chord-test.js']
            },
        }

    });
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-jsbeautifier');
    grunt.registerTask('beautify', 'jsbeautifier:modify');
    grunt.registerTask('verify', 'jsbeautifier:verify');
    grunt.registerTask('dist', 'uglify:production');
    grunt.registerTask('test', 'simplemocha:all');
    grunt.registerTask('test:chord', 'simplemocha:chord');
    grunt.registerTask('default', ['jsdoc', 'jshint', 'test', 'beautify', 'uglify:production']);
};
