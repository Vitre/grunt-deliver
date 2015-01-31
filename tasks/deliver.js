/*
 * grunt-deliver task
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';


module.exports = function(grunt) {

    grunt.registerMultiTask('deliver', 'Continuous delivery', function() {
        var done = this.async();

        var options = this.options({
            driver: 'def'
        });

        console.log('options', options);

    
    });

};