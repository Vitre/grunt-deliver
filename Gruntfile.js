/*
 * grunt-deliver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

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

                driver: 'lftp',

                patterns: ['git', 'github', 'sass', 'dev-node', 'laravel'],

                auth: 'main',

                upload: {
                    connections: 10,
                    parallel: 2
                },

                download: {
                    connections: 20,
                    parallel: 5
                },

                notify: ['slack', 'hipchat'],

                messages: {
                    success: 'Delivery to "{target}" finished.',
                    fail: 'Delivery to "{target}" failed.'
                },

                cache: {
                    dirs: ['tmp', 'app/storage/cache', 'app/storage/views', 'app/storage/twig']
                }

            },

            stage: {
                name: 'Stage',
                branch: 'develop',
                target: '/beta'
            },

            production: {
                name: 'Production',
                branch: 'master',
                target: '/www',
                backup: true
            }
        }

    });

    //---

    grunt.loadTasks('tasks');

    //---

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    //---

    grunt.registerTask('watch_dev', ['watch']);
    grunt.registerTask('build', []);

    grunt.registerTask('stage_deliver', ['build', 'deliver:stage']);

    grunt.registerTask('production_deliver', ['build', 'deliver:production']);

};