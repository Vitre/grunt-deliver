/*
 * grunt-deliver lftp driver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */
'use strict';

var async = require('async');
var cp = require('child_process');

module.exports = function(grunt) {

    function lftpBool(value) {
        return value ? 'on' : 'off';
    }

    return {

        testBin: function(callback) {

            cp.exec('lftp --version', function(error, stdout, stderr) {

                if (error !== null) {
                    grunt.fail.fatal('LFTP bin error.');
                } else {
                    var match = stdout.match(/LFTP \| Version (\d.\d.\d)/);
                    grunt.verbose.ok('LFTP bin version:', match[1]);
                }

                callback();

            });

        },

        deploy: function(options, callback) {

            var lftp = cp.spawn('lftp');

            lftp.stderr.on('data', function(data) {
                console.log('stderr:', data.toString());
            });

            lftp.stdout.on('data', function(data) {
                console.log('stdout:', data.toString());
            });

            // login
            var tasks = [
                'open -u {user},{password} {host};'.replace('{user}', options.user).replace('{password}', options.password).replace('{host}', options.host)
            ];

            // SSL certificates
            if (typeof options.ssl_verify_certificate !== 'undefined') {
                tasks.push('set ssl:verify-certificate ' + lftpBool(options.ssl_verify_certificate) + ';');
            }

            // Passive mode
            if (typeof options.passive_mode !== 'undefined') {
                tasks.push('set ftp:passive-mode ' + lftpBool(options.passive_mode) + ';');
            }

            // Tracing
            if (typeof options.trace !== 'undefined') {
                tasks.push('set cmd:trace ' + lftpBool(options.trace) + ';');
            }

            // Cache
            if (typeof options.cache !== 'undefined') {
                tasks.push('set cache:enable ' + lftpBool(options.cache) + ';');
            }

            // Sync mode
            if (typeof options.sync_mode !== 'undefined') {
                tasks.push('set ftp:sync-mode ' + lftpBool(options.sync_mode) + ';');
            }

            // Connection limit
            if (typeof options.connection_limit !== 'undefined') {
                tasks.push('set net:connection-limit ' + options.connection_limit + ';');
            }

            // Parallel transfer count
            if (typeof options.parallel_count !== 'undefined') {
                tasks.push('set mirror:parallel-transfer-count ' + options.parallel_count + ';');
            }

            // Source
            if (options.src !== false) {
                tasks.push('lcd ' + options.src + ';');
            }

            // Target
            if (options.target !== false) {
                tasks.push('cd ' + options.target + ';');
            }

            // Mirror task
            var mirror = 'mirror -R --no-symlinks --no-perms --allow-suid --no-umask --dereference';
            if (options.ignore.length) {
                mirror += ' -X ' + options.ignore.join(' -X ');
            }
            mirror += ';';
            tasks.push(mirror);

            // Bye
            tasks.push('bye;');

            // Tasks exec
            async.eachSeries(tasks, function(item, callback) {

                grunt.verbose.ok(item);

                lftp.stdin.write(item + '\n', callback);

            }, function(err) {

                lftp.stdin.end();

                callback(err);

            });

        }

    };

};