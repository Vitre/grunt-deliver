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
        '.grunt/',
        '.backup/',
        '.deliver-ignore',
        '.deliver-secret.yml'
    ];

    var default_backup_stamp = 'yyyy-mm-dd-HH-MM-ss';

    //---

    function getOptions(task) {
        var options = task.options({
            driver: false,
            protocol: 'sftp',
            ssl_verify_certificate: false,
            passive_mode: true,
            trace: false,
            driver_cache: false,
            sync_mode: false,
            connection_limit: 4,
            parallel_count: 2,
            auth: 'main',
            src: false,
            cache: false,
            target: false,
            backup: false,
            messages: {
                success: 'Delivery to "{target}" finished.',
                fail: 'Delivery to "{target}" failed.'
            }
        });

        // Backup
        var backup_defaults = {
            enabled: false,
            stamp: default_backup_stamp,
            dir: path.join(process.cwd(), '/.backup/'),
            keep: 4
        };
        if (typeof options.backup === 'boolean') {
            options.backup = extend({}, backup_defaults, { enabled: options.backup });
        }

        return options;
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
        }

        return false;
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

    function getBackupRoot(options) {
        var dir;

        if (options.backup.dir) {
            dir = options.backup.dir;
        } else {
            dir = path.join(process.cwd(), '/.backup/');
        }

        return dir;
    }

    function getBackupTargetDir(target, options) {
        return getBackupRoot(options) + target;
    }

    function getBackupPath(target, options) {
        var dir = getBackupTargetDir(target, options);
        var stamp = grunt.template.today(options.backup.stamp);
        var folder = stamp;
        dir = path.join(dir, folder);

        return dir;
    }

    function cleanBackups(path, keep) {
        if (fs.existsSync(path)) {
            var dir = fs.readdirSync(path);
            grunt.verbose.writeln('Index:', JSON.stringify(dir, null, 0).grey);
            var exceedsSize = dir.length - keep;
            if (exceedsSize > 0) {
                var exceeds = dir.slice(-exceedsSize);
                grunt.verbose.writeln('Exceeding:'.red, JSON.stringify(exceeds, null, 0).grey);
                for (var k in exceeds) {
                    var dirPath = path + '/' + exceeds[k];
                    rm('-rf', dirPath);
                    grunt.verbose.ok('Backup job', dirPath.grey, 'unlinked'.green);
                }
            }
        }
    }

    function getProcessEnvVar(name) {
        return typeof process.env[name] !== 'undefined' ? process.env[name] : null;
    }

    function backupEnabled(run) {
        return run.targetOptions.backup === true
            || (
            typeof run.targetOptions.backup === 'object'
            && (typeof run.targetOptions.backup.enabled === 'undefined' || run.targetOptions.backup.enabled)
            );
    }

    function initRun(task) {

        var run = {
            time: process.hrtime(),
            task: task,
            done: task.async()
        };

        // Command options
        grunt.verbose.writeln('command options:'.yellow, JSON.stringify(grunt.option.flags(), null, 2));

        // Options
        var options = getOptions(task);
        grunt.verbose.writeln('options:'.yellow, JSON.stringify(options, null, 2));

        // Target options
        run.targetOptions = extend({}, options, run.task.data);
        grunt.verbose.writeln('target_options:'.yellow, JSON.stringify(run.targetOptions, null, 2));

        // Pattern
        run.pattern = getMultiPattern(run.targetOptions.patterns);
        grunt.verbose.writeln('pattern:'.yellow, JSON.stringify(run.pattern, null, 2));

        // Deploy ignore
        run.deployIgnore = getIgnore(run.pattern);
        grunt.verbose.writeln('deploy_ignore:'.yellow, JSON.stringify(run.deployIgnore, null, 2));

        // Secret
        var secret = getSecret();
        var targetu = run.task.target.toUpperCase();

        if (secret && typeof secret[options.auth] !== 'undefined') {

            var targetSecret = secret[options.auth];

            run.host = grunt.option('host') || getProcessEnvVar('DELIVER_' + targetu + '_HOST') || targetSecret.host;
            run.user = grunt.option('user') || getProcessEnvVar('DELIVER_' + targetu + '_USER') || targetSecret.user;
            run.password = grunt.option('password') || getProcessEnvVar('DELIVER_' + targetu + '_PASSWORD') || targetSecret.password;

            grunt.verbose.writeln('Auth'.blue, run.host, run.user, run.password.grey);

        } else {

            grunt.log.ok('Secret file not found.');

            run.host = grunt.option('host') || getProcessEnvVar('DELIVER_' + targetu + '_HOST');
            run.user = grunt.option('user') || getProcessEnvVar('DELIVER_' + targetu + '_USER');
            run.password = grunt.option('password') || getProcessEnvVar('DELIVER_' + targetu + '_PASSWORD');

        }

        // Driver init
        run.driver = initDriver(run.targetOptions.driver);

        return run;
    }

    function testTask(run, driverOptions, callback) {

        run.driver.test(function (error) {
            callback(error !== null ? new Error('Driver ' + run.targetOptions.driver.yellow + ' test failed.') : null);
        });

    }

    function cleanBackupsTask(run, driverOptions, callback) {
        var path = getBackupTargetDir(run.task.target, run.targetOptions);
        grunt.verbose.writeln('Cleaning backups...'.yellow, 'keep:', run.targetOptions.backup.keep.toString().blue, path.grey);
        cleanBackups(path, run.targetOptions.backup.keep - 1);
        callback(false);
    }

    function backupTask(run, driverOptions, callback) {
        var backupPath = getBackupPath(run.task.target, run.targetOptions);

        grunt.log.subhead('Backup started.'.blue + '(' + run.targetOptions.target.yellow + ' -> ' + backupPath.yellow + ')');
        if (grunt.option('interactive') && !grunt.option('verbose') && !grunt.option('debug')) {
            linger('Downloading...');
        }

        run.driver.backup(extend({}, driverOptions, {

            src: run.targetOptions.target,
            target: backupPath

        }), function (error) {

            var time = process.hrtime(run.time);
            var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;
            if (grunt.option('interactive') && !grunt.option('verbose') && !grunt.option('debug')) {
                linger();
            }
            if (typeof error === 'object' && typeof error !== 'undefined' && error !== null) {
                grunt.log.error(error.message);
                grunt.log.error('Backup failed.'.red + util.format(' (%ds)', timef).magenta);
            } else {
                grunt.log.ok('Backup finished.'.green + util.format(' (%ds)', timef).magenta);
            }

            callback(error);

        });
    }

    function deployTask(run, driverOptions, callback) {

        var sourcePath = getSourcePath(run.targetOptions.src);

        grunt.log.subhead('Deploy started.'.blue + '(' + sourcePath.yellow + ' -> ' + run.targetOptions.target.yellow + ')');
        if (!grunt.option('no-interactive')) {
            linger('Uploading...');
        }

        run.driver.deploy(extend({}, driverOptions, {

            src: sourcePath,
            target: run.targetOptions.target

        }), function (error) {

            var time = process.hrtime(run.time);
            var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;
            if (!grunt.option('no-interactive')) {
                linger();
            }
            if (typeof error === 'object' && typeof error !== 'undefined' && error !== null) {
                grunt.log.error(error.message);
                grunt.log.error('Deploy failed.'.red + util.format(' (%ds)', timef).magenta);
            } else {
                grunt.log.ok('Deploy finished.'.green + util.format(' (%ds)', timef).magenta);
            }

            callback(error);

        });

    }

    function cacheTask(run, driverOptions, callback) {

        grunt.log.subhead('Cache clear started.'.blue + '(' + run.targetOptions.target.yellow + ')');
        if (!grunt.option('no-interactive')) {
            linger('Clearing cache...');
        }

        run.driver.clearCache(extend({}, driverOptions, {

            target: run.targetOptions.target

        }), function (error) {

            var time = process.hrtime(run.time);
            var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;
            if (!grunt.option('no-interactive')) {
                linger();
            }
            if (typeof error === 'object' && typeof error !== 'undefined' && error !== null) {
                grunt.log.error(error.message);
                grunt.log.error('Clear cache task failed.'.red + util.format(' (%ds)', timef).magenta);
            } else {
                grunt.log.ok('Clear cache task finished.'.green + util.format(' (%ds)', timef).magenta);
            }

            callback(error);

        });

    }

    //---

    grunt.registerMultiTask('deliver_backup', 'Backup task', function () {

        // Run
        var run = initRun(this);

        // Driver options
        var driverOptions = {
            protocol: run.targetOptions.protocol,
            host: run.host,
            user: run.user,
            password: run.password,
            ssl_verify_certificate: run.targetOptions.ssl_verify_certificate,
            passive_mode: run.targetOptions.passive_mode,
            trace: run.targetOptions.trace,
            driver_cache: run.targetOptions.driver_cache,
            sync_mode: run.targetOptions.sync_mode,
            connection_limit: run.targetOptions.connection_limit,
            parallel_count: run.targetOptions.parallel_count,
            ignore: run.deployIgnore
        };

        // Async series
        var tasks = [function (callback) {
            return testTask(run, driverOptions, callback)
        }];

        // Backup
        if (backupEnabled(run)) {
            tasks.push(function (callback) {
                return cleanBackupsTask(run, driverOptions, callback);
            });
            tasks.push(function (callback) {
                return backupTask(run, driverOptions, callback);
            });
        }

        // Tasks execution
        async.series(tasks, function (error) {

            var time = process.hrtime(run.time);
            var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;

            if (typeof error === 'object' && typeof error !== 'undefined' && error !== null) {

                grunt.log.error(error.message);
                grunt.fail.fatal('Backup failed.' + util.format(' (%ds)', timef).magenta);

            } else {

                grunt.log.ok('Backup ' + run.task.target.yellow + ' finished.' + util.format(' (%ds)', timef).magenta);

                run.done();
            }

        });

    });

    grunt.registerMultiTask('deliver', 'Continuous delivery', function () {

        // Run
        var run = initRun(this);

        // Driver options
        var driverOptions = {
            protocol: run.targetOptions.protocol,
            host: run.host,
            user: run.user,
            password: run.password,
            ssl_verify_certificate: run.targetOptions.ssl_verify_certificate,
            passive_mode: run.targetOptions.passive_mode,
            trace: run.targetOptions.trace,
            driver_cache: run.targetOptions.driver_cache,
            cache: run.targetOptions.cache,
            sync_mode: run.targetOptions.sync_mode,
            connection_limit: run.targetOptions.connection_limit,
            parallel_count: run.targetOptions.parallel_count,
            ignore: run.deployIgnore
        };

        // Async series
        var tasks = [function (callback) {
            return testTask(run, driverOptions, callback);
        }];

        // Backup
        if (!grunt.option('no-backup') && backupEnabled(run)) {
            tasks.push(function (callback) {
                return cleanBackupsTask(run, driverOptions, callback);
            });
            tasks.push(function (callback) {
                return backupTask(run, driverOptions, callback);
            });
        }

        // Deploy
        if (!grunt.option('no-deploy')) {
            tasks.push(function (callback) {
                return deployTask(run, driverOptions, callback);
            });
        }

        // Cache
        if (!grunt.option('no-clearcache')) {
            if (typeof driverOptions.cache !== 'undefined' && driverOptions.cache !== false) {
                tasks.push(function (callback) {
                    return cacheTask(run, driverOptions, callback);
                });
            }
        }

        // Tasks execution
        async.series(tasks, function (error) {

            var time = process.hrtime(run.time);
            var timef = Math.round((time[0] + time[1] / 1000000000) * 10) / 10;

            if (typeof error === 'object' && typeof error !== 'undefined' && error !== null) {

                grunt.log.error(error.message);
                grunt.fail.fatal('Deliver failed.' + util.format(' (%ds)', timef).magenta);

            } else {

                grunt.log.ok('Deliver ' + run.task.target.yellow + ' finished.' + util.format(' (%ds)', timef).magenta);

                run.done();
            }

        });

    });

};
