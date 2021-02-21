###
Build scripts for persisto
###

"use strict"

module.exports = (grunt) ->

  grunt.initConfig

    pkg:
        grunt.file.readJSON("package.json")

    # Project metadata, used by the <banner> directive.
    # meta:
    #     banner: "/*! <%= pkg.title || pkg.name %> - @VERSION - @DATE\n" +
    #             # "<%= grunt.template.today('yyyy-mm-dd HH:mm') %>\n" +
    #             "<%= pkg.homepage ? '  * ' + pkg.homepage + '\\n' : '' %>" +
    #             "  * Copyright (c) <%= grunt.template.today('yyyy') %> <%= pkg.author.name %>;" +
    #             " Licensed <%= _.map(pkg.licenses, 'type').join(', ') %> */\n"

    exec:
        build:
            # FTP upload the demo files (requires https://github.com/mar10/pyftpsync)
            stdin: true  # Allow interactive console
            cmd: "yarn build"

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

    yabs:
        release:
            common: # defaults for all tools
              manifests: ['package.json']
            # The following tools are run in order:
            run_test: { tasks: ['qunit:develop'] }
            check: { branch: ['no-jquery-ts'], canPush: true, clean: true, cmpVersion: 'gte' }
            bump: {} # 'bump' also uses the increment mode `yabs:release:MODE`
            run_build: { tasks: ['exec:build'] }
            run_test_dist: { tasks: ['qunit:build'] }
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

#   grunt.registerTask "server", ["connect:forever"]
#   grunt.registerTask "dev", ["connect:dev", "watch"]
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

#   grunt.registerTask "build", [
#       "eslint:fix"
#       "test"
#       "clean:build"
#       "copy:build"
#       "uglify:build"
#       # "clean:extMin"
#       "replace:production"
#       # "uglify:build"
#       # "qunit:build"
#       ]

#   grunt.registerTask "make_dist", [
#       "build"
#       "clean:dist"
#       "copy:dist"
#       "clean:build"
#       "replace:release"
#       ]

  # grunt.registerTask "upload", [
  #     "build"
  #     "exec:upload"
  #     ]
