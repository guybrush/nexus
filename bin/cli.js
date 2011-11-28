#!/usr/bin/env node

var nexus = require('../index')
  , opti  = require('optimist')
  , dnode = require('dnode')
  , execFile = require('child_process').execFile
  , exec = require('child_process').exec
  , fork = require('child_process').fork
  , spawn = require('child_process').spawn
  , argv  = opti.argv
  , _conn
  , usage =
    [ ' ___  ___  _ _  _ _  ___'
    , '|   || -_||_\'_|| | ||_ -|'
    , '|_|_||___||_,_||___||___|v'+nexus.version
    , ''
    , 'nexus [<command> [<options>]]'
    , ''
    , 'commands:'
    , ''
    , '    help      .. help for each command'
    , '    version   .. print version-number'
    , '    config    .. get/set config'
    , '    install   .. install packages'
    , '    uninstall .. uninstall packages'
    , '    ls        .. list installed packages'
    , '    ps        .. list of current running programs'
    , '    start     .. start program'
    , '    restart   .. restart running program'
    , '    stop      .. stop running program'
    , '    stopall   .. stop all running programs'
    , '    remote    .. access remote nexus-server'
    , '    server    .. start a nexus-server'
    , ''
    ].join('\n')
  , help =
    { help    : 'nexus help <command>' 
    , version : 'nexus version'
    , config  : 
      [ 'nexus config               .. show all config'
      , 'nexus config <key>         .. show value of config.<key>'
      , 'nexus config <key> <value> .. set config.<key> to <value>'
      , ''
      ].join('\n')
    , install : 
      [ 'nexus install <tarball file> [<package-name>]'
      , 'nexus install <tarball url> [<package-name>]'
      , 'nexus install <folder> [<package-name>]'
      , 'nexus install <pkg> [<package-name>]'
      , 'nexus install <pkg>@<tag> [<package-name>]'
      , 'nexus install <pkg>@<version> [<package-name>]'
      , 'nexus install <pkg>@<version range> [<package-name>]'
      , ''
      ].join('\n')
    }

if (argv._[0] == 'server') {
  if (!process.send) {
    var childA = fork(__filename, ['server'], {env:process.env})
    childA.on('message',function(m){
      exit(m)
    })
  } else {
    var childB = fork(__dirname+'/server.js', [], {env:process.env})
    childB.on('message',function(m){
      process.send(m)
    })
  }
}    
else if (argv._[0] == 'remote') {
  var key = argv.k
    , cert = argv.c
    , host = argv.h || 'localhost'
    , port = argh.p || 5000
  dnode.connect( {key:key,cert:cert,host:host,port:port}
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
} 
else {
  var key = argv.k
    , cert = argv.c
    , host = argv.h || 'localhost'
    , port = argv.p || 5000

  dnode.connect( {key:key,cert:cert,host:host,port:port}
               , function(remote, conn){
    _conn = conn
    nexus = remote
    //argv._.shift()
    //process.stdin.pipe(process.stdout)
    process.stdin.resume()
    process.stdin.on('data',function(data) {
      var cmd = data.toString().replace('\n','')
      //console.log('COMMAND',cmd)
      argv = opti(cmd.split(' ')).argv
      parseArgs()
    })
    parseArgs()
  })
}

function parseArgs() {
  switch (argv._.shift()) {
    case 'version':
      exit('v'+nexus.version)
      break
    case 'config':
      nexus.config(function(err, data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'ls':
      nexus.ls(argv._[0], function(err, data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'install':
      nexus.install(argv._[0], argv._[1], function(err,data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'rm':
    case 'uninstall':
      nexus.uninstall(argv._[0],function(err,data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'link':
      nexus.link(argv._[0],function(err,data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'ps':
      nexus.ps(function(err,data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'start':
      // #TODO check for nexus-start-options besides scripts-options
      
      var options = argv._.splice(process.argv.indexOf(argv._[0]))
      var options = []
      // console.log('start argv',argv,options,process.argv)
      nexus.start
        ( { script  : argv._[0]
          , options : options 
          , env     : {FOO:'BAR'} } 
        , function(err,data){
            if (err) return exit(err)
            exit(data)
          } )
      break
    case 'restart':
      nexus.restart
        ( argv._[0]
        , function(err, proc){console.log(err ? err : {'restarted process':proc})})
      break
    case 'stop':
      nexus.stop(argv._[0], function(err,data){
        if (err) return exit(err)
        exit(data)
      })
      break
    case 'stopall':
      nexus.stopall(function(err, data){
        if (err) return exit(err)
        exit(data)
      })
      break
    default: exit(usage)
  }
}

function exit(msg) {
  console.log(msg)
  _conn && _conn.end()
  process.exit()
}

