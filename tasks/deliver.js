/*
 * grunt-deliver task
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */
'use strict';

var array = require('array-extended');
var path = require('path');
var fs = require('fs');
var async = require('async');
var extend = require('extend');
var linger = require('linger');
var util = require('util');

//---

module.exports = function (grunt) {

    var default_deliver_ingore = [
        '.grunt',
        '.backup',
        '.deliver-ignore',
        '.deliver-secret.yml'
    ];

    //---

    function getOptions(task) {
        return task.options({

            driver: false,

            ssl_verify_certificate: false,

            passive_mode: true,

            trace: false,

            cache: true,

            sync_mode: false,

            connection_limit: 4,

            parallel_count: 2,

            auth: 'main',

            src: false,

            target: false,

            backup: false,

            messages: {
                success: 'Delivery to "{target}" finished.',
                fail: 'Delivery to "{target}" failed.'
            }

        });
    }

    function readIgnoreFile(file) {
        return fs.readFileSync(file).toString().replace(/\r/g, '').split('\n').filter(function (value) {
            return value !== '' && value !== ' ';
        });
    }

    function getPattern(name) {

        var pattern = {
            name: name
        };

        var dir = path.normalize(__dirname + '/../patterns/' + name + '/');
        var file = dir + '.deploy-ignore';

        if (grunt.file.exists(file)) {

            pattern.deploy_ignore = readIgnoreFile(file);

            grunt.verbose.ok('Pattern ' + name.yellow + ' loaded.', file.grey);

        }

        return pattern;
    }

    function getMultiPattern(patterns) {

        var patternData = [];

        for (var i = 0; i < patterns.length; i++) {
            var pattern = getPattern(patterns[i]);
            if (pattern) {
                patternData.push(pattern);
            }
        }

        var result = {
            deploy_ignore: []
        };

        for (var j = 0; j < patternData.length; j++) {
            result.deploy_ignore = result.deploy_ignore.concat(patternData[j].deploy_ignore);
        }

        result.deploy_ignore = array.compact(array.unique(result.deploy_ignore));

        return result;
    }

    function getIgnore(pattern) {
        var deployIgnore = array.union(default_deliver_ingore, pattern.deploy_ignore);

        var deployIgnoreFile = process.cwd() + '/.deliver-ignore';
        if (grunt.file.exists(deployIgnoreFile)) {
            deployIgnore = array.union(deployIgnore, readIgnoreFile(deployIgnoreFile));
        }

        return deployIgnore;
    }

    function getSecret() {
        var secretFile = process.cwd() + '/.deliver-secret.yml';
        if (grunt.file.exists(secretFile)) {
            return grunt.file.readYAML(secretFile);
        } else {
            grunt.fail.fatal('Secret file not found.');
        }
    }

    function initDriver(driver) {
        var driverPath = path.normalize(__dirname + '/../drivers/' + driver + '.js');
        if (grunt.file.exists(driverPath)) {

            grunt.verbose.oklns('Driver "' + driver + '" loaded.');

            return require(driverPath)(grunt);

        } else {
            grunt.fail.fatal('Driver "' + driver + '" not defined.');
        }
    }

    function getSourcePath(sourcePath) {
        if (!path.isAbsolute(sourcePath)) {
            return path.join(process.cwd(), sourcePath);
        }

        return sourcePath;
    }

    function getBackupPath(options) {
        var stamp = grunt.template.today('yyyy-mm-dd-HH-MM-ss');

        var dir;
        if (options.backup_dir) {
            dir = options.backup_dir;
        } else {
            dir = path.join(process.cwd(), '/.backup/' + stamp);
        }

        return dir;
    }

    function getProcessEnvVar(name) {
        return typeof process.env[name] !== 'undefined' ? process.env[name] : null;
    }

    //---

    grunt.registerMultiTask('deliver', 'Continuous delivery', function () {

        var time = process.hrtime();
        var task = this;
        var done = this.async();

        // Options
        var options = getOptions(this);
        grunt.verbose.writeln('options: '.yellow, JSON.stringify(options, null, 2));

        // Target options
        var targetOptions = extend({}, options, task.data);
        grunt.verbose.writeln('target_options: '.yellow, JSON.stringify(targetOptions, null, 2));

        // Pattern
        var pattern = getMultiPattern(targetOptions.patterns);
        grunt.verbose.writeln('pattern: '.yellow, JSON.stringify(pattern, null, 2));

        // Deploy ignore
        var deployIgnore = getIgnore(pattern);
        grunt.verbose.writeln('deploy_ignore: '.yellow, JSON.stringify(deployIgnore, null, 2));

        // Secret
        var secret = getSecret();
        if (typeof secret[this.target] !== 'undefined') {

            var host, user, password;
            var targetSecret = secret[task.target];
            var targetu = task.target.toUpperCase();

            host = grunt.option('host') || getProcessEnvVar('DELIVER_' + targetu + '_HOST') || targetSecret.host;
            user = grunt.option('user') || getProcessEnvVar('DELIVER_' + targetu + '_USER') || targetSecret.user;
            password = grunt.option('password') || getProcessEnvVar('DELIVER_' + targetu + '_PASSWORD') || targetSecret.password;

            grunt.verbose.ok('Auth', host, user, password);

        } else {
            grunt.fail.fatal('Secret target "' + this.target + '" not defined.');
        }

        // Driver init
        var driver = initDriver(targetOptions.driver);

        // Async series
        var tasks = [

            // Test
            function (callback) {

                driver.test(function(error) {
                    callback(typeof error !== 'undefined' ? new Error('Driver ' + targetOptions.driver.yellow + ' test failed.') : null);
                });

            }

        ];

        var driverOptions = {
            host: host,
            user: user,
            password: password,
            ssl_verify_certificate: targetOptions.ssl_verify_certificate,
            passive_mode: targetOptions.passive_mode,
            trace: targetOptions.trace,
            cache: targetOptions.cache,
            sync_mode: targetOptions.sync_mode,
            connection_limit: targetOptions.connection_limit,
            parallel_count: targetOptions.parallel_count,
            ignore: deployIgnore
        };

        // Backup
        if (targetOptions.backup || grunt.option('backup')) {
            tasks.push(function (callback) {

                var time = process.hrtime();
                grunt.log.subhead('Backup started.'.blue);
                if (!grunt.option('verbose') && !grunt.option('debug')) {
                    linger('Downloading...');
                }

                driver.backup(extend({}, driverOptions, {

                    src: targetOptions.target,
                    target: getBackupPath(targetOptions)

                }), function (error) {
console.log(error);

                    time = process.hrtime(time);
                    var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;
                    if (!grunt.option('verbose') && !grunt.option('debug')) {
                        linger();
                    }
                    if (typeof error === 'object') {
                        grunt.log.error(error.message);
                        grunt.log.error('Backup failed.'.red + util.format(' (%ds)', timef).magenta);
                    } else {
                        grunt.log.ok('Backup finished.'.green + util.format(' (%ds)', timef).magenta);
                    }

                    callback(error);

                });

            });
        }

        // Deploy
        tasks.push(function (callback) {

            var time = process.hrtime();
            grunt.log.subhead('Deploy started.'.blue);
            if (!grunt.option('verbose') && !grunt.option('debug')) {
                linger('Uploading...');
            }

            driver.deploy(extend({}, driverOptions, {

                src: getSourcePath(targetOptions.src),
                target: targetOptions.target

            }), function (error) {
                console.log(error);

                time = process.hrtime(time);
                var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;
                if (!grunt.option('verbose') && !grunt.option('debug')) {
                    linger();
                }
                if (typeof error === 'object') {
                    grunt.log.error(error.message);
                    grunt.log.error('Deploy failed.'.red + util.format(' (%ds)', timef).magenta);
                } else {
                    grunt.log.ok('Deploy finished.'.green + util.format(' (%ds)', timef).magenta);
                }

                callback(error);

            });

        });

        // Tasks execution
        async.series(tasks, function (error) {

            time = process.hrtime(time);
            var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;

            if (typeof error === 'object') {

                grunt.log.error(error.message);
                grunt.fail.fatal('Deliver failed.' + util.format(' (%ds)', timef).magenta);

            } else {

                grunt.log.ok('Deliver ' + task.target.yellow + ' finished.' + util.format(' (%ds)', timef).magenta);

                done();
            }

        });

    });

};
