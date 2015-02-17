/*
 * grunt-deliver lftp driver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */
'use strict';

var async = require('async');
var cp = require('child_process');

//---

module.exports = function(grunt) {

    var cmd_response_timeout = 750;

    //---

    function lftpBool(value) {
        return value ? 'on' : 'off';
    }

    //---

    return {

        /**
         * Tester
         */
        test: function(callback) {

            cp.exec('lftp --version', function(error, stdout, stderr) {

                if (error === null) {

                    var match = stdout.match(/LFTP \| Version (\d.\d.\d)/);
                    grunt.verbose.ok('LFTP bin version:', match[1]);

                } else {

                    grunt.log.error('LFTP test failed');

                }

                callback(error);

            });

        },

        /**
         * Deploy method
         */
        deploy: function(options, callback) {

            // login
            var tasks = [
                'open -u {user},{password} {host}'.replace('{user}', options.user).replace('{password}', options.password).replace('{host}', options.host)
            ];

            // SSL certificates
            if (typeof options.ssl_verify_certificate !== 'undefined') {
                tasks.push('set ssl:verify-certificate ' + lftpBool(options.ssl_verify_certificate));
            }

            // Passive mode
            if (typeof options.passive_mode !== 'undefined') {
                tasks.push('set ftp:passive-mode ' + lftpBool(options.passive_mode));
            }

            // Tracing
            var trace = grunt.option('verbose') || (typeof options.trace !== 'undefined' && options.trace);
            if (trace) {
                tasks.push('set cmd:trace ' + lftpBool(trace));
            }

            // Cache
            if (typeof options.cache !== 'undefined') {
                tasks.push('set cache:enable ' + lftpBool(options.cache));
            }

            // Sync mode
            if (typeof options.sync_mode !== 'undefined') {
                tasks.push('set ftp:sync-mode ' + lftpBool(options.sync_mode));
            }

            // Connection limit
            if (typeof options.connection_limit !== 'undefined') {
                tasks.push('set net:connection-limit ' + options.connection_limit);
            }

            // Parallel transfer count
            if (typeof options.parallel_count !== 'undefined') {
                tasks.push('set mirror:parallel-transfer-count ' + options.parallel_count);
            }

            // Source
            if (options.src !== false) {
                tasks.push('lcd ' + options.src);
            }

            // Target
            if (options.target !== false) {
                tasks.push('cd ' + options.target);
            }

            // Mirror task
            var mirror = 'mirror -R --no-symlinks --no-perms --allow-suid --no-umask --dereference';

            if (options.ignore.length) {
                mirror += ' -X ' + options.ignore.join(' -X ');
            }

            if (grunt.option('no-write')) {
                mirror += ' --dry-run';
            }

            tasks.push(mirror);

            // Bye
            tasks.push('bye');

            // Processing
            var lftp = cp.spawn('lftp', []);
            grunt.verbose.ok('lftp');

            lftp.stdin.setEncoding('utf8');

            var cmdError = false;

            lftp.stderr.on('data', function(data) {

                cmdError = data.toString();
                grunt.verbose.errorlns(cmdError);

                lastSeriesCallback(cmdError);
            });

            lftp.stdout.on('data', function(data) {
                grunt.verbose.ok('stdout:', data.toString());
            });

            lftp.on('exit', function(code) {
                grunt.verbose.ok('exit:', code);
            });

            lftp.on('close', function(code) {
                grunt.verbose.ok('close:', code);
            });

            // Tasks exec
            var lastSeriesCallback;

            async.eachSeries(tasks, function(item, seriesCallback) {

                lastSeriesCallback = seriesCallback;

                var cmd = item + ';\n';

                grunt.verbose.ok(cmd);

                if (cmdError) {

                    seriesCallback(cmdError);

                } else {

                    lftp.stdin.write(cmd, function(error) {
                        setTimeout(function() {
                            seriesCallback(error);
                        }, cmd_response_timeout);
                    });

                }

            }, function(error) {

                lftp.stdin.end();

                callback(error);

            });

        }

    };

};
