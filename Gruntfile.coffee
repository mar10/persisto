###
Build scripts for persisto
###

# jshint directives for the generated JS:

###jshint node: true, unused: false ###

"use strict"

module.exports = (grunt) ->

  grunt.initConfig

    pkg: 
        grunt.file.readJSON("package.json")

    # Project metadata, used by the <banner> directive.
    meta:
        # banner: "/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - " +
        banner: "/*! <%= pkg.title || pkg.name %> - @VERSION - @DATE\n" +
                # "<%= grunt.template.today('yyyy-mm-dd HH:mm') %>\n" +
                "<%= pkg.homepage ? '  * ' + pkg.homepage + '\\n' : '' %>" +
                "  * Copyright (c) <%= grunt.template.today('yyyy') %> <%= pkg.author.name %>;" +
                " Licensed <%= _.pluck(pkg.licenses, 'type').join(', ') %> */\n"

    clean:
        build:
            src: [ "build" ]
        dist:
            src: [ "dist" ]

    connect:
        forever:
            options:
                port: 8080
                base: "./"
                keepalive: true
        dev: # pass on, so subsequent tasks (like watch) can start
            options:
                port: 8080
                base: "./"
                keepalive: false
        sauce:
            options:
                hostname: "localhost"
                port: 9999
                base: ""
                keepalive: false

    copy:
        build: # copy production files to build folder
            files: [{
                expand: true # required for cwd
                cwd: "src/"
                src: [
                    "*.js"
                    "*.txt"
                    ]
                dest: "build/"
            }, {
                # src: ["*.txt", "*.md"]
                src: ["LICENSE.txt"]
                dest: "build/"
            }]
        dist: # copy build folder to dist
            files: [{expand: true, cwd: "build/", src: ["**"], dest: "dist/"}]

    jscs:
      src: ["src/*.js", "test/*.js"]
      options:
        config: ".jscsrc"
        force: true

    jshint:
        options:
            # Linting according to http://contribute.jquery.org/style-guide/js/
            jshintrc: ".jshintrc"
        beforeConcat: [
            # "Gruntfile.js"
            "src/*.js"
            "test/*.js"
            ]
        afterConcat: [
            "<%= concat.core.dest %>"
            "<%= concat.all.dest %>"
            ]

    qunit:
        # options:
        #   timeout: 20000
        #   '--cookies-file': 'misc/cookies.txt'
        build: [ 
            "test/unit/test-core-build.html" 
        ]
        develop: [ 
          "test/unit/test-core.html"
        ]

    replace: # grunt-text-replace
        production:
            src: ["build/**/*.js"]
            overwrite : true
            replacements: [ {
                from : /@DATE/g
                to : "<%= grunt.template.today('yyyy-mm-dd\"T\"HH:MM') %>"
            },{
                from : /buildType:\s*\"[a-zA-Z]+\"/g
                to : "buildType: \"production\""
            },{
                from : /debugLevel\s*:\s*[0-9]/g
                to : "debugLevel: 1"
            },{
                from : /debugLevel\s*=\s*[0-9]/g
                to : "debugLevel = 1"
            } ]
        release:
            src: ["dist/**/*.js"]
            overwrite : true
            replacements: [ {
                from : /@VERSION/g
                to : "<%= pkg.version %>"
            } ]

    "saucelabs-qunit":
        all:
            options:
                urls: ["http://localhost:9999/test/unit/test-core.html"]
                # tunnelTimeout: 5
                build: process.env.TRAVIS_JOB_ID
                # concurrency: 3
                throttled: 8
                browsers: [
                  # { browserName: "chrome", platform: "Windows 8.1" }
                  # { browserName: "firefox", platform: "Windows 8.1" }
                  # { browserName: "firefox", platform: "Windows XP" }
                  # { browserName: "firefox", platform: "Linux" }
                  # { browserName: "internet explorer", version: "6", platform: "Windows XP" }
                  # { browserName: "internet explorer", version: "7", platform: "Windows XP" }
                  # { browserName: "internet explorer", version: "8", platform: "Windows 7" }
                  # { browserName: "internet explorer", version: "9", platform: "Windows 7" }
                  # { browserName: "internet explorer", version: "10", platform: "Windows 8" }
                  # { browserName: "internet explorer", version: "11", platform: "Windows 8.1" }
                  # { browserName: "microsoftedge", platform: "Windows 10" }
                  # { browserName: "safari", version: "6", platform: "OS X 10.8" }
                  # { browserName: "safari", version: "7", platform: "OS X 10.9" }
                  # { browserName: "safari", version: "8", platform: "OS X 10.10" }
                  { browserName: "safari", version: "9", platform: "OS X 10.11" }
                ]
                testname: "persisto qunit tests"

    uglify:
        # options:  # see https://github.com/gruntjs/grunt-contrib-uglify/issues/366
        #   preserveComments: /(?:^!|@(?:license|preserve|cc_on))/

        build:
            options:
                report: "min"
                banner: "/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - " + "<%= grunt.template.today('yyyy-mm-dd') %> | " + "<%= pkg.homepage ? ' ' + pkg.homepage + ' | ' : '' %>" + " Copyright (c) <%= grunt.template.today('yyyy') %> <%= pkg.author.name %>;" + " Licensed <%= _.pluck(pkg.licenses, 'type').join(', ') %> */\n"
                sourceMap: true
            src: "src/persisto.js"
            dest: "build/persisto.min.js"

    watch:
        jshint:
            options:
                atBegin: true
            files: ["src/*.js", "test/unit/*.js", "demo/**/*.js"]
            tasks: ["jshint:beforeConcat", "jscs"]

    yabs:
        release:
            common: # defaults for all tools
              manifests: ['package.json', 'bower.json']
            # The following tools are run in order:
            run_test: { tasks: ['test'] }
            check: { branch: ['master'], canPush: true, clean: true, cmpVersion: 'gte' }
            bump: {} # 'bump' also uses the increment mode `yabs:release:MODE`
            run_build: { tasks: ['make_release'] }
            commit: { add: '.' }
            tag: {}
            push: { tags: true, useFollowTags: true },
            githubRelease:
                repo: 'mar10/persisto'
                draft: false
            npmPublish: {}
            bump_develop: { inc: 'prepatch' }
            commit_develop: { message: 'Bump prerelease ({%= version %}) [ci skip]' }
            push_develop: {}

  # ----------------------------------------------------------------------------


  # Load "grunt*" dependencies

  for key of grunt.file.readJSON("package.json").devDependencies
      grunt.loadNpmTasks key  if key isnt "grunt" and key.indexOf("grunt") is 0

  # Register tasks

  grunt.registerTask "server", ["connect:forever"]
  grunt.registerTask "dev", ["connect:dev", "watch"]
  # grunt.registerTask "tabfix", ["exec:tabfix"]
  grunt.registerTask "test", [
      "jshint:beforeConcat"
      # "csslint"
      "jscs"
      "qunit:develop"
  ]

  grunt.registerTask "sauce", ["connect:sauce", "saucelabs-qunit"]
  if parseInt(process.env.TRAVIS_PULL_REQUEST, 10) > 0
      # saucelab keys do not work on forks
      # http://support.saucelabs.com/entries/25614798
      grunt.registerTask "travis", ["test"]
  else
      grunt.registerTask "travis", ["test"]  # , "sauce"]

  grunt.registerTask "default", ["test"]

  grunt.registerTask "ci", ["test"]  # Called by 'npm test'

  grunt.registerTask "build", [
      "test"
      "clean:build"
      "copy:build"
      "uglify:build"
      # "clean:extMin"
      "replace:production"
      # "jshint:afterConcat"
      # "uglify:build"
      # "qunit:build"
      ]
  
  grunt.registerTask "make_release", [
      "build"
      "clean:dist"
      "copy:dist"
      "clean:build"
      "replace:release"
      ]

  # grunt.registerTask "upload", [
  #     "build"
  #     "exec:upload"
  #     ]
