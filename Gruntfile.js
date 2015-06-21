/*
 * grunt-deliver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

    require('time-grunt')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        jshint: {

            all: [
                'Gruntfile.js',
                'tasks/**/*.js',
                'drivers/**/*.js'
            ],

            options: {
                jshintrc: '.jshintrc'
            }

        },

        watch: {
            js: {
                files: ['Gruntfile.js', 'tasks/**/*.js', 'drivers/**/*.js'],
                tasks: ['jshint:all']
            }
        },

        availabletasks: {
            tasks: {}
        },

        deliver: {
            options: {
                driver: 'lftp',
                patterns: ['git', 'github', 'sass', 'dev-node', 'laravel'],
                auth: 'main',
                src: 'dist',
                target: '/beta',
                backup: false,
                connection_limit: 10,
                parallel_count: 4,
                maintenance: {
                    htaccess: true
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
                auth: 'stage',
                src: 'test',
                target: '/test/stage',
                backup: {
                    enabled: true,
                    stamp: 'yyyymmddHHMMss',
                    keep: 4
                },
                connection_limit: 7,
                parallel_count: 2
            },

            production: {
                name: 'Production',
                branch: 'master',
                src: 'dist',
                target: '/test/production',
                backup: true
            }
        }

    });

    //---

    grunt.loadTasks('tasks');

    //---

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-available-tasks');

    //---

    grunt.registerTask('default', ['availabletasks'])

    grunt.registerTask('watch_dev', ['watch']);
    grunt.registerTask('build', []);

    grunt.registerTask('stage_maintenance_set', ['build', 'deliver_maintenance_set:stage']);
    grunt.registerTask('stage_maintenance_unset', ['build', 'deliver_maintenance_unset:stage']);
    grunt.registerTask('stage_deliver', ['build', 'deliver:stage']);
    grunt.registerTask('stage_backup', ['deliver_backup:stage']);

    grunt.registerTask('production_deliver', ['build', 'deliver:production']);

};
