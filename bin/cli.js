#!/usr/bin/env node

var nexus = require('../index')
  , _config = nexus.config()
  , opti  = require('optimist')
  , dnode = require('dnode')
  , argv  = opti.argv
  , _conn
  , usage =
    [ ' ___  ___  _ _  _ _  ___'
    , '|   || -_||_\'_|| | ||_ -|'
    , '|_|_||___||_,_||___||___|v'+nexus.version()
    , ''
    , 'nexus [-r <remote>] [<command> [<options>]]'
    , ''
    , 'commands:'
    , ''
    , '    version   .. print version-number'
    , '    config    .. get/set config'
    , '    ls        .. list installed packages'
    , '    install   .. install packages'
    , '    uninstall .. uninstall packages'
    , '    ps        .. list of current running (and crashed) programs'
    , '    start     .. start a program'
    , '    restart   .. restart a running (or max crashed) program'
    , '    stop      .. stop a running program'
    , '    stopall   .. stop all running programs'
    , '    subscribe .. subscribe to events'
    , '    server    .. start/stop/restart the nexus-server'
    , '    help      .. try `nexus help <command>` for more info'
    , ''
    ].join('\n')

var help = {}
help.version   = 'nexus version .. will print the version of installed nexus'
help.config    = [ 'nexus config               .. show all config'
                 , ''
                 , 'not implemented yet .. :'
                 , ''
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
help.uninstall = [ 'nexus uninstall <name>'
                 , ''
                 , 'note: shortcut for "uninstall" is "rm"'
                 ].join('\n')
help.rm        = help.uninstall
help.ls        = 'nexus ls .. there are no parameters'
help.subscribe = [ 'nexus subscribe <event> .. pipe events to stdout'
                 , ''
                 , '<event> is a wildcarded eventemitter2-event'
                 , ''
                 , 'examples:'
                 , ''
                 , 'nexus subscribe *                      .. subscribe to all events'
                 , 'nexus subscribe monitor::<id>::*       .. only events from that monitor'
                 , 'nexus subscribe monitor::<id>::stdout  .. '
                 , 'nexus subscribe monitor::<id>::stderr  .. '
                 , 'nexus subscribe monitor::<id>::start   .. the program has been restarted'
                 , 'nexus subscribe monitor::<id>::exit    .. '
                 , 'nexus subscribe monitor::*::exit       .. '
                 , 'nexus subscribe nexus::installed       .. when packages get installed'
                 , 'nexus subscribe nexus::error           .. listen for nexus errors'
                 ].join('\n')
help.ps        = 'nexus ps [<id>]'
help.start     = [ "nexus start /some/file                                             "
                 , "  script = /some/file                                              "
                 , "nexus start ./some/file                                            "
                 , "  script = CWD+'/some/file'                                        "
                 , "nexus start appName/path/to/script                                 "
                 , "  appName is an app                                                "
                 , "    ? script = _config.apps+'/appName/path/to/script'              "
                 , "    : script = CWD+'/appName/path/to/script'                       "
                 , "nexus start appName                                                "
                 , "  appName is an app                                                "
                 , "    ? look for package.json-startScript                            "
                 , "      ? starScript.split(' ')                                      "
                 , "        ? fs.stat([0])                                             "
                 , "          ? script = [0], options = [>0]                           "
                 , "          : command = [0], script = [1], options = [>1]            "
                 , "        : script = _config.apps+'/appName/'+startScript            "
                 , "      : fs.stat(appName+'/server.js') || fs.stat(appName+'/app.js')"
                 , "        ? script = appName+'/server.js' || appName+'/server.js'    "
                 , "        : script = appName // this is most likely an error..       "
                 , "    : script CWD+'/'+appName // this is most likely an error..     "
                 ].join('\n')
help.restart   = 'nexus restart <id>'
help.stop      = 'nexus stop <id>'
help.stopall   = 'nexus stopall .. there are no parameters'
help.server    = ['nexus server .. (without any options) will print information'
                 ,'                about the server - if it is running'
                 ,''
                 ,'nexus server start [-p <port>] [-h <host>] [-c <path to configFile>]'
                 ,'nexus server stop'
                 ,'nexus server restart'
                 ].join('\n')

if (!argv._[0]) exit(null, usage)
else if (argv._[0] == 'help') {
  if (!argv._[1] || !help[argv._[1]])
    return exit(null, usage)
  exit(null, help[argv._[1]])
}
else {
  var opts = {}
  opts.key  = argv.k
  opts.cert = argv.c
  opts.host = argv.h || _config.host
  opts.port = argv.p || _config.port

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
    if (err.code == 'ECONNREFUSED') {
      if (['version','config','ls','install','uninstall','server'
          ].indexOf(argv._[0]) != -1) {
        // #TODO check if its the "localhost"-remote
        // no running server required
        parseArgs()
      }
      else return exit('server is not running')
    }
    else exit(err)
  })
}

function parseArgs() {
  var cmd = argv._.shift()
  switch (cmd) {
    case 'version':
      exit(null,'v'+nexus.version())
      break
    case 'config':
      nexus.config(exit)
      break
    case 'ls':
      nexus.ls(argv._[0], exit)
      break
    case 'install':
      nexus.install( { package : argv._[0]
                     , name    : argv._[1]
                     , cwd     : process.cwd() }
                   , exit )
      break
    case 'rm':
    case 'uninstall':
      nexus.uninstall(argv._[0], exit)
      break
    case 'ps':
      nexus.ps(exit)
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
        , exit )
      break
    case 'restart':
      nexus.restart(process.argv[3], exit)
      break
    case 'stop':
      nexus.stop(process.argv[3], exit)
      break
    case 'stopall':
      nexus.stopall(exit)
      break
    case 'server':
      nexus.server({cmd:argv._[0]}, exit)
      break
    default:
      exit('unknown command: '+cmd)
  }
}

function exit(err,msg) {
  if (err) console.log('ERROR:',err)
  else console.log(msg)
  _conn && _conn.end()
  process.exit(0)
}

