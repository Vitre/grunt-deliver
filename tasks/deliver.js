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
var sync = require('sync');

module.exports = function(grunt) {

    var getOptions = function(task) {
        return task.options({

            driver: false,

            upload: {
                connections: 4,
                parallel: 2
            },

            download: {
                connections: 4,
                parallel: 2
            },

            messages: {
                success: 'Delivery to "{target}" finished.',
                fail: 'Delivery to "{target}" failed.'
            }

        });
    };

    var getPattern = function(name) {

        var pattern = {
            name: name
        };

        var dir = path.normalize(__dirname + '/../patterns/' + name + '/');
        var file = dir + '.deploy-ignore.yml';

        if (grunt.file.exists(file)) {

            pattern.deploy_ignore = fs.readFileSync(file).toString().replace(/\r/g, '').split('\n').filter(function(value) {
                return value !== '' && value !== ' ';
            });

            grunt.verbose.ok('Pattern ' + name.yellow + ' loaded.', file.grey);

        }

        return pattern;
    };

    var getMultiPattern = function(patterns) {

        var patternData = [];

        for (var i = 0; i < patterns.length; i++) {
            var pattern = getPattern(patterns[i]);
            if (pattern) {
                patternData.push(pattern);
            }
        }

        var multiPattern = {
            deploy_ignore: []
        };

        for (var j = 0; j < patternData.length; j++) {
            multiPattern.deploy_ignore = multiPattern.deploy_ignore.concat(patternData[j].deploy_ignore);
        }


        multiPattern.deploy_ignore = array.compact(array.unique(multiPattern.deploy_ignore));
        return multiPattern;
    };

    var getIgnore = function() {

    };

    var getSecret = function() {

    };

    var deploy = function() {

    };

    grunt.registerMultiTask('deliver', 'Continuous delivery', function() {
        var done = this.async();

        var options = getOptions(this);

        var pattern = getMultiPattern(options.patterns);

        grunt.verbose.writeln('options: '.yellow, JSON.stringify(options, null, 2));
        grunt.verbose.writeln('pattern: '.yellow, JSON.stringify(pattern, null, 2));

        // Driver init
        var driver;
        var driverPath = path.normalize(__dirname + '/../drivers/' + options.driver + '.js');
        if (grunt.file.exists(driverPath)) {

            driver = require(driverPath)(grunt);

            grunt.verbose.oklns('Driver "' + options.driver + '" loaded.');
        } else {
            grunt.fail.fatal('Driver "' + options.driver + '" not defined.');
        }

        sync(function() {
            driver.testBin.sync();
        });

        sync(function() {
            driver.deploy.sync();
        });

        // done();
    });

};