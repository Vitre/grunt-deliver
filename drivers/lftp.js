/*
 * grunt-deliver lftp driver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */
'use strict';

require('shelljs/global');

var async = require('async');
var cp = require('child_process');

//---

module.exports = function (grunt) {

    var command_response_timeout = 750;

    var mirror_default_options = [
        'no-symlinks',
        'no-perms',
        'no-umask',
        'allow-suid',
        'dereference'
    ];

    //---

    function escapeshell(cmd) {
        return '"' + cmd.replace(/(["\s'$`\\])/g, '\\$1') + '"';
    }

    function lftpBool(value) {
        return value ? 'on' : 'off';
    }

    function getLoginCommand(options) {
        return 'open -u {user},{password} {host}'.replace('{user}', options.user).replace('{password}', options.password).replace('{host}', options.host);
    }

    function getCommandString(command) {
        return command + ';' + grunt.util.linefeed;
    }

    function getInitCommands(options) {
        var commands = [];

        // SSL certificates
        if (typeof options.ssl_verify_certificate !== 'undefined') {
            commands.push('set ssl:verify-certificate ' + lftpBool(options.ssl_verify_certificate));
        }

        // Passive mode
        if (typeof options.passive_mode !== 'undefined') {
            commands.push('set ftp:passive-mode ' + lftpBool(options.passive_mode));
        }

        // Tracing
        var trace = grunt.option('verbose') || (typeof options.trace !== 'undefined' && options.trace);
        if (trace) {
            commands.push('set cmd:trace ' + lftpBool(trace));
        }

        // Cache
        if (typeof options.cache !== 'undefined') {
            commands.push('set cache:enable ' + lftpBool(options.cache));
        }

        // Sync mode
        if (typeof options.sync_mode !== 'undefined') {
            commands.push('set ftp:sync-mode ' + lftpBool(options.sync_mode));
        }

        // Connection limit
        if (typeof options.connection_limit !== 'undefined') {
            commands.push('set net:connection-limit ' + options.connection_limit);
        }

        // Parallel transfer count
        if (typeof options.parallel_count !== 'undefined') {
            commands.push('set mirror:parallel-transfer-count ' + options.parallel_count);
        }

        // Xfer clobber
        if (typeof options.xfer_clobber !== 'undefined') {
            commands.push('set xfer:clobber ' + lftpBool(options.xfer_clobber));
        }

        return commands;
    }

    function getCommandOptionString() {
        return mirror_default_options.map(function (value) {
            return '--' + value;
        }).join(' ');
    }

    function initExecProcess(commands, callback) {

        var command = commands.join(';' + grunt.util.linefeed);
        grunt.log.ok(command);

        var lftp = cp.spawn('lftp', ['-c', command]);

        if (grunt.option('debug')) {
            lftp.stdout.on('data', function (data) {
                grunt.verbose.ok('stdout:', data.toString());
            });
        }

        lftp.stderr.on('data', function (data) {
            grunt.log.error(data);
            if (callback) {
                callback(data);
                callback = null;
            }
        });

        lftp.on('error', function (error) {
            grunt.log.error(error);
            if (callback) {
                callback(error);
                callback = null;
            }
        });

        lftp.on('exit', function (code) {
            grunt.verbose.ok('exit', code);
            if (callback) {
                callback(null);
                callback = null;
            }
        });

        return lftp;
    }

    function initStreamedProcess() {
        var lftp = cp.spawn('lftp', []);
        grunt.verbose.ok('lftp');

        lftp.stdin.setEncoding('utf8');

        if (grunt.option('debug')) {
            lftp.stdout.on('data', function (data) {
                grunt.log.debug('stdout:', data.toString());
            });

            lftp.on('exit', function (code) {
                grunt.log.debug('exit:', code);
            });

            lftp.on('close', function (code) {
                grunt.log.debug('close:', code);
            });
        }

        return lftp;
    }

    //---

    return {

        /**
         * Tester
         */
        test: function (callback) {

            cp.exec('lftp --version', function (error, stdout, stderr) {

                if (error === null) {

                    var match = stdout.match(/LFTP \| Version (\d.\d.\d)/);
                    grunt.verbose.ok('LFTP bin version:', match[1]);

                    callback(null);

                } else {

                    grunt.verbose.error(error);
                    callback(new Error(error));

                }

            });

        },

        /**
         * Maintenance set
         */
        setMaintenance: function (target, options, callback) {

            // Login
            var commands = [
                getLoginCommand(options)
            ];

            commands = commands.concat(getInitCommands(extend({}, options, {
                xfer_clobber: true
            })));

            // Source
            if (options.src !== false) {
                commands.push('lcd ' + options.src);
            }
            
            // Put
            var put = '.htaccess.' + target;

            if (grunt.option('no-write')) {
                put += ' --dry-run';
            }

            commands.push(put);

            // Bye
            commands.push('bye');

            // Processing
            
            var lftp = initExecProcess(commands, function (error, stdout, stderr) {
                callback(error !== null ? new Error(error) : null);
            });

        },

        /**
         * Backup method
         */
        backup: function (options, callback) {

            // Login
            var commands = [
                getLoginCommand(options)
            ];

            commands = commands.concat(getInitCommands(options));

            // Source
            if (options.target !== false) {

                mkdir('-p', options.target);

                commands.push('lcd ' + options.target);
            }

            // Target
            if (options.src !== false) {
                commands.push('cd ' + options.src);
            }

            // Mirror task
            var mirror = 'mirror ' + getCommandOptionString();

            if (options.ignore.length) {
                mirror += ' -X ' + options.ignore.join(' -X ');
            }

            if (grunt.option('no-write')) {
                mirror += ' --dry-run';
            }

            commands.push(mirror);

            // Bye
            commands.push('bye');

            // Processing
            if (true) {

                var lftp = initExecProcess(commands, function (error, stdout, stderr) {
                    callback(error !== null ? new Error(error) : null);
                });

            } else {

                var lftp = initStreamedProcess();

                var commandError = false;

                lftp.stderr.on('data', function (data) {

                    commandError = data.toString();
                    grunt.verbose.errorlns(commandError);

                    lastSeriesCallback(new Error(commandError));
                });

                // Commands exec
                var lastSeriesCallback;

                async.eachSeries(commands, function (item, seriesCallback) {

                    lastSeriesCallback = seriesCallback;

                    var command = getCommandString(item);

                    grunt.verbose.ok(command);

                    if (commandError) {

                        seriesCallback(new Error(commandError));

                    } else {

                        lftp.stdin.write(command, function (error) {
                            setTimeout(function () {
                                seriesCallback(error !== null ? new Error(error) : null);
                            }, command_response_timeout);

                        });

                    }

                }, function (error) {

                    lftp.stdin.end();

                    callback(error);

                });
            }
        },

        /**
         * Deploy method
         */
        deploy: function (options, callback) {

            // Login
            var commands = [
                getLoginCommand(options)
            ];

            commands = commands.concat(getInitCommands(options));

            // Source
            if (options.src !== false) {
                commands.push('lcd ' + options.src);
            }

            // Target
            if (options.target !== false) {
                commands.push('cd ' + options.target);
            }

            // Mirror task
            var mirror = 'mirror -R ' + getCommandOptionString();

            if (options.ignore.length) {
                mirror += ' -X ' + options.ignore.join(' -X ');
            }

            if (grunt.option('no-write')) {
                mirror += ' --dry-run';
            }

            commands.push(mirror);

            // Bye
            commands.push('bye');

            // Processing
            if (true) {

                var lftp = initExecProcess(commands, function (error, stdout, stderr) {
                    callback(error !== null ? new Error(error) : null);
                });

            } else {

                var lftp = initStreamedProcess();

                var commandError = false;

                lftp.stderr.on('data', function (data) {

                    commandError = data.toString();
                    grunt.verbose.errorlns(commandError);

                    lastSeriesCallback(new Error(commandError));
                });

                // commands exec
                var lastSeriesCallback;

                async.eachSeries(commands, function (item, seriesCallback) {

                    lastSeriesCallback = seriesCallback;

                    var command = getCommandString(item);

                    grunt.verbose.ok(command);

                    if (commandError) {

                        seriesCallback(new Error(commandError));

                    } else {

                        lftp.stdin.write(command, function (error) {
                            setTimeout(function () {
                                seriesCallback(error ? new Error(error) : null);
                            }, command_response_timeout);
                        });

                    }

                }, function (error) {

                    lftp.stdin.end();

                    callback(error);

                });

            }
        }

    };

};
