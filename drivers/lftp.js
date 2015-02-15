/*
 * grunt-deliver lftp driver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';

var cp = require('child_process');

module.exports = function(grunt) {

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

        deploy: function(callback) {

            /*
            'lftp -c "open -u ' + options.user + ',' + options.password + ' ' + options.host + ';' +
                'set ssl:verify-certificate no;' +
                'set ftp:passive-mode on;' +
                'set cmd:trace on;' +
                'set cache:enable off;' +
                'set ftp:sync-mode off;' +
                'set net:connection-limit ' + options.connection_limit + ';' +
                'set mirror:parallel-transfer-count ' + options.parallel_count + ';' +
                'lcd ' + options.workspace + ';' +
                'cd ' + options.target + ';' +
                'mirror -R --no-symlinks --no-perms --allow-suid --no-umask --dereference -X ' + ci.ignore.join(' -X ') + ';' +
                'bye"'
                */

            var lftp = cp.spawn('lftp', []);

            lftp.stderr.on('data', function(data) {
                console.log('stderr:', data.toString());
            });

            lftp.stdout.on('data', function(data) {
                console.log('stdout:', data.toString());
            });

            lftp.stdin.write('open -u test,test test\n');


            lftp.stdin.write('bye\n');
console.log('tesrt');
            proc.stdin.end();

        }

    };

};