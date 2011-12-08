#!/usr/bin/env node

var opti = require('optimist')
  , argv  = opti.argv
  , confFile = Array.isArray(argv.c) ? argv.c[0] : argv.c
  , nexus = require('../index')(confFile)
  , _config = nexus.config()
  , opti = require('optimist')
  , dnode = require('dnode')
  , fs = require('fs')
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
    , '    logs      .. access log-files'
    , '    cleanlogs .. remove old log-files (of not-running programs)'
    , '    subscribe .. subscribe to events'
    , '    server    .. start/stop/restart the nexus-server'
    , '    help      .. try `nexus help <command>` for more info'
    , ''
    , 'note: ps, start, restart, stop, stopall, cleanlogs and subscribe'
    , '      only work with a local or remote running nexus-server'
    , ''
    ].join('\n')

var help = {}
help.version   = 'nexus version .. will print the version of installed nexus'
help.config    = [ 'nexus config .. show all config'
                 , ''
                 , 'not implemented yet .. :'
                 , ''
                 , 'nexus config <key> .. show value of config.<key>'
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
                 , 'nexus subscribe "*"                   .. subscribe to all events'
                 , 'nexus subscribe all                   .. subscribe to all events'
                 , 'nexus subscribe "*::*::*"             .. subscribe to all events'
                 , 'nexus subscribe monitor::<id>::*      .. only events from that monitor'
                 , 'nexus subscribe monitor::<id>::stdout .. listen for a programm stdout'
                 , 'nexus subscribe monitor::<id>::stderr .. listen for a programm stderr'
                 , 'nexus subscribe monitor::<id>::start  .. the program has been restarted'
                 , 'nexus subscribe monitor::<id>::exit   .. a program exited'
                 , 'nexus subscribe monitor::*::connected .. a program has been started and'
                 , '                                         the monitor-server has connected'
                 , 'nexus subscribe monitor::*::exit      .. a program has exited'
                 , 'nexus subscribe server::*::installed  .. when packages get installed'
                 , 'nexus subscribe server::*::error      .. listen for nexus-server errors'
                 , ''
                 , 'note: in bash you may want to wrap the event with "",' 
                 , '      since "*" is a wildcard in bash too..'
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
help.restart   = 'nexus restart <id> .. restarts the program (not the monitor)'
help.stop      = 'nexus stop <id> .. stops the program (and the monitor)'
help.stopall   = ['nexus stopall .. there are no parameters, stops all programs'
                 ,'                 and their monitors'
                 ].join('\n')
help.logs      = [ 'nexus logs .. list all logfiles'
                 , 'nexus log <file> [-n <number of lines>] .. -n is 20 per default'
                 , ''
                 , 'note: the name of log-files is the path to the script without the'
                 , '      nexus-apps-root-path appended by ".<id>.[stdout/stderr].log"'
                 , '      where "/" and "\\s" are replaced with "_"'
                 ].join('\n')
help.server    = [ 'nexus server .. (without any options) will print information'
                 , '                about the server - if it is running'
                 , ''
                 , 'nexus server start [-c <path to configFile>]'
                 , 'nexus server stop'
                 , 'nexus server restart'
                 , ''
                 , 'note: the default-configFile-path is ~/.nexus/config.js'
                 ].join('\n')

if (!argv._[0]) exit(null, usage)
else if (argv._[0] == 'help') {
  if (!argv._[1] || !help[argv._[1]])
    return exit(null, usage)
  exit(null, help[argv._[1]])
}
else {
  var opts = {}
  if (argv.r && _config.remotes[argv.r]) {
    opts.host = _config.remotes[argv.r].host
    opts.port = _config.remotes[argv.r].port
    try {
      if (_config.remotes[argv.r].key)
        opts.key = fs.readFileSync(_config.remotes[argv.r].key)
    } catch(e) { exit('can not read key-file: '+_config.remotes[argv.r].key) }
    try {
      if (_config.remotes[argv.r].cert)
        opts.cert = fs.readFileSync(_config.remotes[argv.r].cert)
    } catch(e) { exit('can not read cert-file: '+_config.remotes[argv.r].cert) }
  } else {
    opts.host = _config.host
    opts.port = _config.port
    try {
      if (_config.key)
        opts.key = fs.readFileSync(_config.key)
    } catch(e) { exit('can not read key-file: '+_config.key) }
    try {
      if (_config.cert)
        opts.cert = fs.readFileSync(_config.cert)
    } catch(e) { exit('can not read cert-file: '+_config.cert) }
  }
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
    conn.on('end',function(){exit('disconnected from server')})
  })
  client.on('error',function(err){
    if (err.code == 'ECONNREFUSED' && !argv.r) {
      if (['version','config','ls','install','uninstall'
          ,'server','logs'
          ].indexOf(argv._[0]) != -1) {
        // no running server required
        parseArgs()
      }
      else return exit('server is not running, can not connect')
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
      if (argv._[0]) nexus.ps(argv._[0], exit)
      else nexus.ps(exit)
      break
    case 'start':
      var options = process.argv.splice(process.argv.indexOf(argv._[0])+1)
      nexus.start
        ( { script  : argv._[0]
          , options : options }
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
    case 'logs':
      nexus.logs({file:argv._[0],lines:argv.n}, exit)
      break
    case 'cleanlogs':
      nexus.cleanlogs(function(err,data){exit(err,'deleted '+data+' logfiles')})
      break
    case 'server':
      nexus.server({cmd:argv._[0]}, exit)
      break
    case 'subscribe':
      var emit = function(event, data) {
        console.log(event,'→',data)
      }
      nexus.subscribe(argv._[0], emit)
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

