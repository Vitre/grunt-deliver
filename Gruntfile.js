/*
 * grunt-deliver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    grunt.initConfig({

        jshint: {

            all: [
                'Gruntfile.js',
                'tasks/**/*.js'
            ],

            options: {
                jshintrc: '.jshintrc'
            }

        },

        watch: {
            js: {
                files: ['**/*.js'],
                tasks: ['jshint:all']
            }
        },

        deliver: {
            options: {
                driver: 'lftp'
            },

            stage: {

            },

            production: {

            }
        }

    });


    grunt.loadTasks('tasks');

    //---

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    //---

    grunt.registerTask('watch_dev', ['watch']);

};