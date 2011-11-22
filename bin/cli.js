#!/usr/bin/env node

var nexus = require('../index.js')
  , opti  = require('optimist')
  , argv  = opti.argv
  , usage =
    [ ' ___  ___  _ _  _ _  ___'
    , '|   || -_||_\'_|| | ||_ -|'
    , '|_|_||___||_,_||___||___|v'+nexus.version
    , ''
    , 'nexus [<command> [<options>]]'
    , ''
    , 'commands:'
    , ''
    , '    version    .. print version-number'
    , '    config     .. get/set config'
    , '    install    .. install packages'
    , '    uninstall  .. uninstall packages'
    , '    ls         .. list installed packages'
    , '    ps         .. list of current running programs'
    , '    start      .. start program'
    , '    restart    .. restart running program'
    , '    stop       .. stop running program'
    , '    stopall    .. stop all running programs'
    // , '    stdin      .. access stdin'
    // , '    stdout     .. access stdout'
    // , '    stderr     .. access stderr'
    , '    server     .. start dnode-server'
    , '    remote     .. connect to remote nexus'
    , ''
    ].join('\n')
    
if (argv._[0] == 'remote') {
  nexus.remote( {key:argv.k,cert:argv.c,host:argv.h,port:argv.p,remote:argv.r}
              , function(err, remote){
    if (err) { console.log(err) }
    else {
      nexus = remote
      argv._.shift()
      //process.stdin.pipe(process.stdout)
      process.stdin.resume()
      process.stdin.on('data',function(data) {
        var cmd = data.toString().replace('\n','')
        argv = opti(cmd.split(' ')).argv
        parseArgs()
      })
      parseArgs()
    }
  })
} else {
  parseArgs()
}

function parseArgs() {
  switch (argv._.shift()) {
    case 'version':
      console.log('v'+nexus.version)
      break
    case 'config':
      nexus.config(function(err, data){console.log(err ? err : data)})
      break
    case 'ls':
      nexus.ls(null, function(err, data){console.log(err ? err : data)})
      break
    case 'install':
      nexus.install(argv._[0],function(err,data){console.log(err ? err : data)})
      break
    case 'rm':
    case 'uninstall':
      nexus.uninstall(argv._[0],function(err,data){
        console.log(err ? err : 'uninstalled '+argv._[0])
      })
      break
    case 'git':
      nexus.git(argv._[0],function(err,data){console.log(err ? err : data)})
    case 'link':
      nexus.link(argv._[0],function(err,data){console.log(err ? err : data)})
      break
    case 'ps':
      nexus.ps({format:true}, function(err,data){console.log(err ? err : data)})
      break
    case 'start':
      // #TODO check for nexus-start-options besides scripts-options
      var options = process.argv.splice(process.argv.indexOf(argv._[0])).splice(1)
      nexus.start
        ( { script  : argv._[0]
          , options : options 
          , format  : true } 
        , function(err,data){console.log(err ? err : data)} )
      break
    case 'restart':
      nexus.restart
        ( { script : argv._[0] 
          , format : true }
        , function(err, proc){console.log(err ? err : {'restarted process':proc})})
      break
    case 'stop':
      nexus.stop
        ( { script:argv._[0]
          , format:true }
        , function(err,proc){console.log(err ? err : proc)} )
      break
    case 'stopall':
      nexus.stopall(null, function(err, procs){
        console.log(err ? err : {'stopped processes':procs})
      })
      break
    case 'stderr':
    case 'stdout':
    case 'stdin': console.log('#TODO'); break
    case 'server':
      nexus.start
        ( { script  : __dirname+'/server.js'
          , options : []
          }
        , function(err,proc){console.log(err ? err : proc)}
        )
      break
    default: console.log(usage)
  }
}

function exit(msg) {
  console.log(msg)
  process.exit()
}

