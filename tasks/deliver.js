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

        // default options
        var options = this.options({
            driver: false,
            upload: {
                connections: 4,
                parallel: 2
            },
            download: {
                connections: 4,
                parallel: 2
            }
        });

        console.log('options', options);


    });

};