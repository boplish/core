module.exports = function(grunt) {
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

        uglify: {
            build: {
                files: {
                    'dist/boplish.min.js': ['js/*.js']
                }
            }
        },

        simplemocha: {
            options: {
              ignoreLeaks: false,
              ui: 'bdd',
              reporter: 'dot'
            },

            all: { src: ['test/*-test.js'] }
        }

    });
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.registerTask('test', 'simplemocha');
    grunt.registerTask('default', ['jsdoc', 'jshint', 'simplemocha', 'uglify']);
};
