/*
 * grunt-deliver lftp driver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';

var exec = require('child_process').exec;

module.exports = function(grunt) {

    this.testBin = function() {
        exec('lftp --version', function(error, stdout, stderr) {
            console.log(arguments);
        });
    };

};