module.exports = function(grunt) {
  // Load Grunt tasks declared in the package.json file
  require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
  var jsSrc = [
        'lib/jquery/jquery.js',
        'lib/handlebars/handlebars.js',
        'lib/swag/swag.js',
        'lib/underscore/underscore.js',
        'lib/bootstrap/bootstrap.js',
        'bower_components/bootstrap-jasny/dist/extend/js/jasny-bootstrap.js',
        'lib/backbone/backbone.js',
        'lib/backbone.wreqr/lib/backbone.wreqr.js',
        'lib/backbone.babysitter/backbone.babysitter.js',
        'lib/backbone.supermodel/backbone.supermodel.js',
        'bower_components/marionette/lib/core/backbone.marionette.js',
        'lib/backbone.marionette.handlebars/backbone.marionette.handlebars.js',
        'lib/backbone-forms/distribution/backbone-forms.js',
        'lib/backbone-forms/distribution/editors/list.js',
        'lib/backbone-forms/distribution/templates/bootstrap3.js',
        'lib/microplugin/microplugin.js',
        'lib/sifter/sifter.js',
        'lib/selectize/selectize.js',
        'lib/spin.js/spin.js',
        'lib/ladda-bootstrap/ladda.js',
        'lib/moment/moment.js',
        'lib/jQuery-Mask-Plugin/jquery.mask.min.js',
        'lib/placeholders/build/placeholders.js',
        'bower_components/ie-alert/theplugin/iealert.js',
        'lib/messenger/messenger.js',
        'lib/messenger/messenger-theme-future.js',
        'lib/backbone.bootstrap-modal/src/backbone.bootstrap-modal.js',
        'lib/backgrid/backgrid.js',
        'lib/backbone-pageable/lib/backbone-pageable.js',
        'lib/jQuery-CreditCardValidator/jquery.creditCardValidator.js',
        'lib/credit_card_track_parser/lib/credit_card_track_parser.js',
        'lib/backgrid-paginator/backgrid-paginator.js',
        'lib/bootstrap-select/bootstrap-select.js'
      ],
      cssSrc = [
        'lib/bootstrap/bootstrap.css',
        'bower_components/bootstrap-jasny/dist/extend/css/jasny-bootstrap.css',
        'lib/font-awesome/css/font-awesome.css',
        'lib/selectize/selectize.css',
        'lib/ladda-bootstrap/ladda-themeless.css',
        'lib/messenger/messenger.css',
        'lib/messenger/messenger-theme-future.css',
        'lib/bootstrap-select/bootstrap-select.css',
        'lib/backgrid/backgrid.css',
        'lib/backgrid-paginator/backgrid-paginator.css',
        'lib/backbone-forms/distribution/templates/bootstrap3.css',
        'assets/css/custom.css'
      ];

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    bower: {
      install: {
        options: {
          targetDir: './lib',
          layout: 'byType',
          install: true,
          verbose: false,
          cleanTargetDir: true,
          cleanBowerDir: false
        }
      }
    },
    jshint: {
      all: ['Gruntfile.js', 'assets/js/**/*.js'],
      server: ['server.js', 'routes/index.js']
    },
    uglify: {
      options: {
        beautify: true,
        mangle: false
      },
      vendors: {
        options: {
          sourceMap: 'public/js/vendors.min.map'
        },
        files: {
          'public/js/vendors.min.js': jsSrc
        }
      },
      app: {
        options: {
          sourceMap: 'public/js/app.min.map'
        },
        files: {
          'public/js/app.min.js': [
            'assets/js/**/*.js'
          ]
        }
      }
    },
    cssmin: {
      combine: {
        files: {
          'public/css/app.css': cssSrc
        }
      }
    },
    concat: {
      options: {
        stripBanners: true,
        banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
          '<%= grunt.template.today("yyyy-mm-dd") %> */',
      },
      css: {
        src: cssSrc,
        dest: 'public/css/app.css',
      },
      app: {
        src: [
          'assets/js/**/*.js'
        ],
        dest: 'public/js/app.min.js',
      },
      jsDev: {
        src: jsSrc,
        dest: 'public/js/vendors.min.js',
      },
    },
    copy: {
      main: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [
              'lib/bootstrap/*.svg',
              'lib/bootstrap/*.eot',
              'lib/bootstrap/*.ttf',
              'lib/bootstrap/*.woff',
              'lib/font-awesome/fonts/*',
            ],
            dest: 'public/fonts/',
            filter: 'isFile'
          },
          {
            expand: true,
            flatten: true,
            src: [
              'lib/font-awesome/css/*.css'
            ],
            dest: 'public/css/',
            filter: 'isFile'
          }

        ]
      }
    },
    handlebars: {
      compile: {
        options: {
          namespace: "Templates",
          processName: function(filePath) { // input:  templates/_header.hbs
            var pieces = filePath.split("/");
            return pieces[pieces.length - 1].split(".")[0]; // output: _header.hbs
          },
          compilerOptions: {
            knownHelpers: {
              "ul": true
            }
          }
        },
        files: {
          "public/js/templates.js": ["assets/templates/*.html"]
        }
      }
    },
    watch: {
      grunt: {
        files: ['Gruntfile.js'],
        tasks: ['build', 'express:dev', 'watch'],
        options: {
          spawn: true,
        },
      },
      scripts: {
        files: ['assets/js/**/*.js'],
        tasks: ['jshint:all', 'concat:app'],
        options: {
          spawn: true,
        },
      },
      express: {
        files: ['server.js', 'routes/index.js', 'io-routes/index.js'],
        tasks: ['jshint:server', 'express:dev'],
        options: {
          nospawn: true //Without this option specified express won't be reloaded
        }
      },
      css: {
        files: ['assets/css/*.css'],
        tasks: ['concat:css'],
        options: {
          spawn: true,
        },
      },
      templates: {
        files: ['assets/templates/*.html'],
        tasks: ['handlebars'],
        options: {
          spawn: true,
        },
      },
      data: {
        files: ['assets/data/*.json'],
        tasks: ['json:data'],
        options: {
          spawn: true,
        },
      }
    },
    express: {
      options: {
        debug: true
        // Override defaults here
      },
      dev: {
        options: {
          script: 'server.js'
        }
      }
    },
    'node-inspector': {
      default: {}
    },
    json: {
      data: {
        options: {
          namespace: 'Data',
          includePath: true,
          processName: function(filename) {
            var _name = filename.split("/"),
                len = _name.length-1,
                name = _name[len].split(".")[0];
            return name.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
          }
        },
        src: ['assets/data/**/*.json'],
        dest: 'public/js/json.js'
      }
    }
  });

  grunt.registerTask('build', [
    'bower:install',
    'jshint:server',
    'jshint:all',
    'uglify',
    'cssmin',
    'copy',
    'handlebars',
    'json:data'
  ]);

  grunt.registerTask('build-dev', [
    'bower:install',
    'jshint:server',
    'jshint:all',
    'concat',
    'copy',
    'handlebars',
    'json:data'
  ]);

  grunt.event.on('watch', function(action, filepath, target) {
    grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
  });

  grunt.registerTask('server', [ 'build-dev', 'express:dev', 'watch' ]);

  // Default task(s).
  grunt.registerTask('default', ['build']);

};
