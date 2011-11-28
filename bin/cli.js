#!/usr/bin/env node

var nexus = require('../index')
  , opti  = require('optimist')
  , dnode = require('dnode')
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
  var execFile = require('child_process').execFile
  var fork = require('child_process').fork
  if (!process.send) {
    var child = fork( __filename 
                    , ['server'] 
                    , { env:process.env } )
    child.on('message',function(m){
      console.log('pid: '+child.pid)
      process.exit(0)
    })
  } else {
    execFile(__dirname+'/server.js',function(error,stdout,stderr){
      console.log('stdout: '+stdout)
      if (error) console.log('exec error: ' + error)
      process.send('ready')
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
    nexus = remote
    //argv._.shift()
    //process.stdin.pipe(process.stdout)
    process.stdin.resume()
    process.stdin.on('data',function(data) {
      var cmd = data.toString().replace('\n','')
      console.log('COMMAND',cmd)
      argv = opti(cmd.split(' ')).argv
      parseArgs()
    })
    parseArgs()
  })
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
      nexus.ls
        ( argv._[0]
        , function(err, data){console.log(err ? err : data)})
      break
    case 'install':
      nexus.install
        ( argv._[0]
        , argv._[1]
        , function(err,data){console.log(err ? err : data)})
      break
    case 'rm':
    case 'uninstall':
      nexus.uninstall(argv._[0],function(err,data){
        console.log(err ? err : 'uninstalled '+argv._[0])
      })
      break
    case 'link':
      nexus.link(argv._[0],function(err,data){console.log(err ? err : data)})
      break
    case 'ps':
      nexus.ps(function(err,data){
        if (err) return console.log(err)
        for (var proc in data) {
          delete data[proc].env
        }
        console.log(data)
      })
      break
    case 'start':
      // #TODO check for nexus-start-options besides scripts-options
      
      //var options = argv._.splice(process.argv.indexOf(argv._[0]))
      var options = []
      console.log('start argv',argv,options,process.argv)
      nexus.start
        ( { script  : argv._[0]
          , options : options } 
        , function(err,data){console.log(err ? err : data)} )
      break
    case 'restart':
      nexus.restart
        ( argv._[0]
        , function(err, proc){console.log(err ? err : {'restarted process':proc})})
      break
    case 'stop':
      nexus.stop
        ( argv._[0]
        , function(err,proc){console.log(err ? err : proc)} )
      break
    case 'stopall':
      nexus.stopall(null, function(err, procs){
        console.log(err ? err : {'stopped processes':procs})
      })
      break
    case 'server':
      var execFile = require('child_process').execFile
      var fork = require('child_process').fork
      if (!process.send) {
        fork( __filename 
            , ['server'] 
            , { env:process.env } )
        process.exit(0)
      } else {
        execFile(__dirname+'/server.js',function(error,stdout,stderr){
          console.log('stdout: '+stdout)
          if (error) console.log('exec error: ' + error)
        })
      }
      break
    default: console.log(usage)
  }
}

function exit(msg) {
  console.log(msg)
  process.exit()
}

