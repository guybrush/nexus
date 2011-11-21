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
    , '    install    .. install packages into program'
    , '    uninstall  .. uninstall packages'
    , '    git        .. hook git-repository'
    , '    ls         .. list installed programs'
    , '    ps         .. report snapshot of current running programs'
    // , '    dir        .. list source files of programs'
    , '    start      .. start program'
    , '    restart    .. restart running processes'
    , '    stop       .. stop running processes'
    , '    stopall    .. stop all running programs'
    , '    stdin      .. access stdin'
    , '    stdout     .. access stdout'
    , '    stderr     .. access stderr'
    , '    server     .. start net/tls-interface'
    , '    web        .. start web-interface'
    , '    remote     .. connect to tls-interface of another remote nexus'
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
      nexus.config(function(err,data){console.log(err ? err : data)})
      break
    case 'ls':
      nexus.ls(null, function(err, files){err && console.log(err)})
      break
    case 'install':
      nexus.install(argv._[0],function(err,data){console.log(err ? err : data)})
      break
    case 'rm':
    case 'uninstall':
      nexus.uninstall(argv._,function(err,data){console.log(err ? err : data)})
      break
    case 'git':
      nexus.git(argv._[0],function(err,data){console.log(err ? err : data)})
    case 'link':
      nexus.link(argv._[0],function(err,data){console.log(err ? err : data)})
      break
    case 'ps':
      nexus.ps(null, function(err,data){console.log(err ? err : data)})
      break
    case 'start':
      var options = process.argv.splice(process.argv.indexOf(argv._[0])).splice(1)
      nexus.start
        ( { script  : argv._[0]
          , options : options } 
        , function(err,data){console.log(err ? err : data)} )
      break
    case 'restart':
      nexus.restart({script:argv._[0]},function(err, proc){
        console.log(err ? err : {'restarted process':proc})
      })
      break
    case 'stop':
      nexus.stop({script:argv._[0]},function(err,proc){
        console.log(err ? err : {'stopped process':proc})
      })
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
    case 'web':
      console.log('OPTIONS',process.argv,argv)
      var options = process.argv.splice(process.argv.indexOf('web')).splice(1)
      console.log('OPTIONS',options)
      nexus.start
        ( { script  : __dirname+'/web.js'
          , options : options
          }
        , function(err,proc){console.log(err ? err : proc)}
        )
      break
    case 'test':
      var util = require('util')
      var net = require('net')
      var sockPath = nexus.config().socket+'/nexus.sock'
      socket = new net.Socket({ type: 'unix' })
      socket.on('data',function(data){util.print(data)})
      console.log('connecting to socket '+sockPath)
      socket.connect(nexus.config().socket+'/nexus.sock')
      break
    default: console.log(usage)
  }
}

function exit(msg) {
  console.log(msg)
  process.exit()
}
