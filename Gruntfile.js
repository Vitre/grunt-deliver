/*
 * grunt-deliver
 *
 * Copyright (c) 2015 "Vitre" Vít Mádr, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    grunt.initConfig({

        jshint: {

          all: [
            'Gruntfile.js',
            'tasks/**/*.js',
            '<%= nodeunit.tests %>'
          ],

          options: {
            jshintrc: '.jshintrc'
          }

        },

      }

    }
  });

}