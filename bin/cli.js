#!/usr/bin/env node

var nexus = require('../index')
  // , _config = nexus.config()
  , opti  = require('optimist')
  , dnode = require('dnode')
  , execFile = require('child_process').execFile
  , exec = require('child_process').exec
  , fork = require('child_process').fork
  , spawn = require('child_process').spawn
  , fs = require('fs')
  , argv  = opti.argv
  , _conn
  , usage =
    [ ' ___  ___  _ _  _ _  ___'
    , '|   || -_||_\'_|| | ||_ -|'
    , '|_|_||___||_,_||___||___|v'+nexus.version
    , ''
    , 'nexus [-r <remote>] [<command> [<options>]]'
    , ''
    , 'commands:'
    , ''
    , '    help      .. help for each command'
    , '    version   .. print version-number'
    , '    config    .. get/set config'
    , '    ls        .. list installed packages'
    , '    install   .. install packages'
    , '    uninstall .. uninstall packages'
    , '    link      .. like npm link (only local)'
    , '    ps        .. list of current running programs'
    , '    start     .. start program'
    , '    restart   .. restart running program'
    , '    stop      .. stop running program'
    , '    stopall   .. stop all running programs'
    , '    subscribe .. subscribe to events'
    , '    remote    .. connect to remote nexus'
    , '    server    .. start a nexus-interface-server (only local)'
    , ''
    , 'try `nexus help <command>` for more info'
    ].join('\n')
    
var help = {}
help.help      = 'nexus help <command>' 
help.version   = 'nexus version'
help.config    = [ 'nexus config               .. show all config'
                 , 'nexus config <key>         .. show value of config.<key>'
                 , 'nexus config <key> <value> .. set config.<key> to <value>'
                 ].join('\n') 
help.install   = [ 'nexus install <tarball url> [<package-name>] [<option>]'
                 , 'nexus install <pkg> [<package-name>] [<option>]'
                 , 'nexus install <pkg>@<tag> [<package-name>] [<option>]'
                 , 'nexus install <pkg>@<version> [<package-name>] [<option>]'
                 , 'nexus install <pkg>@<version range> [<package-name>] [<option>]'
                 , ''
                 , 'works only locally:'
                 , ''
                 , 'nexus install <tarball file> [<package-name>] [<option>]'
                 , 'nexus install <folder> [<package-name>] [<option>]'
                 , ''
                 , 'options:'
                 , ''
                 , '    --package, -p .. set package.json-variables'
                 , ''
                 , 'example:'
                 , ''
                 , 'nexus install http://git.web/foo.git/snapshot/a1b2asd.tar.gz -p commit=a1b2asd foo-with-some-feature'
                 ].join('\n')
help.uninstall = [ 'TBA (look at code for now)'
                 , ''
                 , 'note: shortcuts for "uninstall" is "rm"'
                 ].join('\n')
help.rm        = help.uninstall
help.ls        = 'TBA (look at code for now)'
help.subscribe = 'TBA (look at code for now)'
help.ps        = 'TBA (look at code for now)'
help.start     = 'TBA (look at code for now)'
help.restart   = 'TBA (look at code for now)'
help.stop      = 'TBA (look at code for now)'
help.stopall   = 'TBA (look at code for now)'
help.server    = 'TBA (look at code for now)'

if (!argv._[0]) exit(usage)
else if (argv._[0] == 'help') {
  if (!argv._[1] || !help[argv._[1]]) 
    return exit('unknown command: '+argv._[1])
  exit(help[argv._[1]])
}
else if (argv._[0] == 'server') {
  if (!process.env.NEXUS_SERVER) {
    process.title = 'nexus-server-parent'
    process.env.NEXUS_SERVER = true
    var child = spawn('node', [__filename,'server'], {env:process.env})
    child.stdout.on('data',function(d){console.log('nexus-server-stdout> '+d)})
    child.stderr.on('data',function(d){console.log('nexus-server-stderr> '+d)})
    // #FORKISSUE
    // var child = fork(__filename, ['server'], {env:process.env})
    exit()
  } else {
    process.title = 'nexus-server'
    var server = dnode(nexus()).listen(5000)
    // #FORKISSUE
    // server.on('ready',function(){process.send({pid:process.pid})})
    // server.on('error',function(err){process.send({error:err})})
  }
} 
else {
  var opts = {}
  opts.key  = argv.k
  opts.cert = argv.c
  opts.host = argv.h || 'localhost'
  opts.port = argv.p || 5000

  var client = dnode({type:'NEXUS_CLI'})
  client.connect(opts, function(remote, conn){
    _conn = conn
    nexus = remote
    process.stdin.resume()
    process.stdin.on('data',function(data) {
      var cmd = data.toString().replace('\n','')
      argv = opti(cmd.split(' ')).argv
      parseArgs()
    })
    parseArgs()
  })
  client.on('error',function(err){
    exit(err)
  })
}

function parseArgs() {
  var cmd = argv._.shift()
  switch (cmd) {
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
      nexus.install( { package:argv._[0]
                     , name:argv._[1] 
                     , cwd:process.cwd() }, function(err,data){
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
      console.log('cli start')
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
    default: 
      exit('unknown command: '+cmd)
  }
}

function exit(msg) {
  console.log(msg)
  _conn && _conn.end()
  process.exit(0)
}

