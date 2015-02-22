# grunt-deliver v0.0.1-alpha

> Deliver codebase to remote server.

## Getting Started
This plugin requires Grunt `>=0.4.0`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-deliver --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-deliver');
```

## Deliver task
_Run this task with the `grunt deliver` command._

Task targets, files and options may be specified according to the grunt [Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

### Options

#### driver
Type: `String`  
Default: `lftp`  
Values: `lftp`, `rsync` (yet not supported)  

Declare protocol used for data transfer.

#### patterns
Type: `Array`  
Values: `bower`, `composer`, `dev-node`, `git`, `github`, `ide`, `laravel`, `npm`, `phpunit`, `sass`  

Identify project nature. Each pattern include some deploy ignore definitions.

#### auth
Type: `String`

#### src
Type: `String`

#### target
Type: `String`

#### backup
Type: `Object`

#### cache
Type: `Object`

#### upload
Type: `Object`

#### download
Type: `Object`

#### notify
Type: `Array`

#### messages
Type: `Object`

### Usage examples

#### Basic stage/production configuration

```js
grunt.initConfig({

    deliver: {
        options: {

            // Protocol driver: lftp
            driver: 'lftp',

            // Project patterns: bower, composer, dev-node, git, github, ide, laravel, npm, phpunit, sass
            patterns: ['git', 'github', 'sass', 'dev-node', 'laravel'],

            // Authorisation key
            auth: 'main',

            // Default source path
            src: 'dist',

            // Default target path
            target: '/beta',

            // Default backup first option
            backup: false,

            // Project cache
            cache: {
                dirs: ['tmp', 'app/storage/cache', 'app/storage/views', 'app/storage/twig']
            }

            // Connection settings
            upload: {
                connections: 10,
                parallel: 2
            },
            download: {
                connections: 20,
                parallel: 5
            },

            // Notification tasks
            notify: ['slack', 'hipchat'],

            // Message templates
            messages: {
                success: 'Delivery to "{target}" finished.',
                fail: 'Delivery to "{target}" failed.'
            }
        },

        // Example of stage target
        stage: {
            name: 'Stage',
            branch: 'develop',
            auth: 'stage',
            src: 'dev',
            target: '/beta'
        },

        // Example of production target
        production: {
            name: 'Production',
            branch: 'master',
            src: 'dist',
            target: '/www',
            backup: true
        }
    }

});
```

## Release history
