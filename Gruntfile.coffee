###
Build scripts for persisto
###

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
                " Licensed <%= _.map(pkg.licenses, 'type').join(', ') %> */\n"

    # clean:
    #     build:
    #         src: [ "build" ]
    #     dist:
    #         src: [ "dist" ]

    # connect:
    #     forever:
    #         options:
    #             port: 8080
    #             base: "./"
    #             keepalive: true
    #     dev: # pass on, so subsequent tasks (like watch) can start
    #         options:
    #             port: 8080
    #             base: "./"
    #             keepalive: false
    #     sauce:
    #         options:
    #             hostname: "localhost"
    #             port: 9999
    #             base: ""
    #             keepalive: false

    # copy:
    #     build: # copy production files to build folder
    #         files: [{
    #             expand: true # required for cwd
    #             cwd: "src/"
    #             src: [
    #                 "*.js"
    #                 "*.txt"
    #                 ]
    #             dest: "build/"
    #         }, {
    #             # src: ["*.txt", "*.md"]
    #             src: ["LICENSE.txt"]
    #             dest: "build/"
    #         }]
    #     dist: # copy build folder to dist
    #         files: [{expand: true, cwd: "build/", src: ["**"], dest: "dist/"}]

    # eslint:
    #     # options:
    #     #   # See https://github.com/sindresorhus/grunt-eslint/issues/119
    #     #   quiet: true
    #     # We have to explicitly declare "src" property otherwise "newer"
    #     # task wouldn't work properly :/
    #     dist:
    #         src: "dist/persisto.js"
    #     dev:
    #         options:
    #             fix: false
    #             maxWarnings: 100
    #         src: [
    #           "src/*.js"
    #           "test/test-*.js"
    #           ]
    #     fix:
    #         options:
    #             fix: true
    #         src: [
    #           "src/*.js"
    #           "test/test-*.js"
    #           ]

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
                # https://github.com/felixge/node-dateformat
                to : "<%= grunt.template.today('isoUtcDateTime') %>"
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

    # watch:
    #     eslint:
    #         options:
    #             atBegin: true
    #         files: ["src/*.js", "test/unit/*.js", "demo/**/*.js"]
    #         tasks: ["eslint:dev"]

    yabs:
        release:
            common: # defaults for all tools
              manifests: ['package.json', 'bower.json']
            # The following tools are run in order:
            run_test: { tasks: ['test'] }
            check: { branch: ['master'], canPush: true, clean: true, cmpVersion: 'gte' }
            bump: {} # 'bump' also uses the increment mode `yabs:release:MODE`
            run_build: { tasks: ['make_dist'] }
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
    #   "eslint:dev"
      "qunit:develop"
  ]

#   grunt.registerTask "sauce", ["connect:sauce", "saucelabs-qunit"]
  if parseInt(process.env.TRAVIS_PULL_REQUEST, 10) > 0
      # saucelab keys do not work on forks
      # http://support.saucelabs.com/entries/25614798
      grunt.registerTask "travis", ["test"]
  else
      grunt.registerTask "travis", ["test"]  # , "sauce"]

  grunt.registerTask "default", ["test"]

  grunt.registerTask "ci", ["test"]  # Called by 'npm test'

  grunt.registerTask "build", [
      "eslint:fix"
      "test"
      "clean:build"
      "copy:build"
      "uglify:build"
      # "clean:extMin"
      "replace:production"
      # "uglify:build"
      # "qunit:build"
      ]

  grunt.registerTask "make_dist", [
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
