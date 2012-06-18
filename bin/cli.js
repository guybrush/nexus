#!/usr/bin/env node

// nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]
//
//      |<------------ argvNexus -------------->|          |<- argvCmd ->|

var opti = require('optimist')
  , argv = opti.argv
  , argvNexus = opti.parse(process.argv.slice(0,process.argv.indexOf(argv._[0])))
  , argvCmd = opti.parse(process.argv.slice(process.argv.indexOf(argv._[0])+1))
  , nexus = require('../')(argvNexus.c)
  , _config = nexus.config()
  , _pkg = require('../package.json')
  , opti = require('optimist')
  , dnode = require('dnode')
  , fs = require('fs')
  , path = require('path')
  , _ = require('underscore')
  , _conn
  , usage =
    [ ' ___  ___  _ _  _ _  ___'
    , '|   || -_||_\'_|| | ||_ -|'
    , '|_|_||___||_,_||___||___|v'+_pkg.version
    , ''
    , 'nexus [-r <remote>] [-c <path to configFile>] [<command> [<options>]]'
    , ''
    , 'commands:'
    , ''
    , '    version   .. print version-number'
    , '    config    .. print config'
    , '    ls        .. list installed packages'
    , '    install   .. install packages'
    , '    uninstall .. uninstall packages'
    , '    ps        .. list of current running (and crashed) programs'
    , '    start     .. start a program'
    , '    restart   .. restart a running (or max crashed) program'
    , '    stop      .. stop a running program'
    , '    stopall   .. stop all running programs'
    , '    runscript .. execute a script, defined in the package.json'
    , '    logs      .. access log-files'
    , '    subscribe .. subscribe to events'
    , '    server    .. start/stop/restart the nexus-server'
//    , '    reboot    .. usefull to recover from a system-reboot'
    , '    help      .. try `nexus help <command>` for more info'
    , ''
    , 'note: ps, restart, stop, stopall, subscribe and `logs clean`'
    , '      only work with a local or remote running nexus-server.'
    , ''
    ].join('\n')

process.title = 'nexus-v'+_pkg.version

var help = {}
help.version   = [ 'nexus version .. will print the version of installed nexus'
                 , '                 if the nexus-server is running it will'
                 , '                 print the version of the nexus-server'
                 , ''
                 , 'nexus -r foo version .. will print the version of the remote'
                 , '                        nexus-server'
                 ].join('\n')
help.config    = [ 'nexus config .. print local config'
                 , 'nexus -r foo config .. print remote config'
                 // , 'nexus config <key> .. show value of config.<key>'
                 // , 'nexus config <key> <value> .. set config.<key> to <value>'
                 , ''
                 , 'the nexus-cli will create a `~/.nexus`-directory if it doesnt exist. you can'
                 , 'create a `~/.nexus/config.js`-file which exposes a json-object, or pass a'
                 , 'path to a `.js/.json`-file to the cli (`-c`) or to the nexus-constructor - it'
                 , 'will be `require()`\'ed.'
                 , ''
                 , 'if no config is passed to the cli or constructor, the config is'
                 , '`{socket:home+"/.nexus/socket"}` - where `home` is either'
                 , '`process.env.HOME` or `process.env.USERPROFILE` depending on `process.platform`.'
                 , ''
                 , 'your config may look like this:'
                 , ''
                 , '{ socket  : "/path/to/socket"    // if set, the nexus-server will listen on that UNIX-socket'
                 , '                                 // local cli and monitor-servers will connect to it'
                 , ', port    : 12345                // if set, the nexus-server will listen on that port'
                 , '                                 // remote nexus-cli can connect (see -r option)'
                 , ', host    : "0.0.0.0"'
                 , ', key     : "/path/to/key.pem"   // if set, the nexus-server uses tls'
                 , ', cert    : "/path/to/cert.pem"  // if set, the nexus-server uses tls'
                 , ', ca      : "/path/to/ca"        // every file in that directory will be read into the ca'
                 , ', remotes :                      // can be used with the cli: `nexus -r foo ps`'
                 , '  { local : { port:12345, key:<key>, cert:<cert>, host:"0.0.0.0" }'
                 , '  , foo   : { port:12346, key:<key>, cert:<cert>, host:"foo.com" }'
                 , '  , bar   : { port:12347, key:<key>, cert:<cert>, host:"bar.com" }'
                 , '  }'
                 , '}'
                 ].join('\n')
help.install   = [ 'nexus install <tarball url> [<package-name>]'
                 , 'nexus install <pkg> [<package-name>]'
                 , 'nexus install <pkg>@<tag> [<package-name>]'
                 , 'nexus install <pkg>@<version> [<package-name>]'
                 , 'nexus install <pkg>@<version range> [<package-name>]'
                 , ''
                 , 'works only locally:'
                 , ''
                 , 'nexus install <tarball file> [<package-name>]'
                 , 'nexus install <folder> [<package-name>]'
                 , ''
                 , 'examples (just like npm):'
                 , ''
                 , 'nexus install http://git.web/foo.git/snapshot/a1b2asd.tar.gz'
                 , 'nexus install some/folder 1337app'
                 , 'nexus install git+ssh://foo@bar.com:blub/gnag.git#v12.23.34'
                 , 'nexus install express'
                 , ''
                 , 'note: if no <package-name> is passed, the package-name from'
                 , '      its package.json will be taken appended by "@<version>"'
                 , 'note: upon name-collision the package-name will be appended with "_$i"'
                 ].join('\n')
help.uninstall = [ 'nexus uninstall <appName>'
                 , ''
                 , 'note: while there are running programs of <appName> it cant be uninstalled'
                 , 'note: shortcut for "uninstall" is "rm"'
                 ].join('\n')
help.rm        = help.uninstall
help.ls        = [ 'nexus ls [<appName>] [<filter>]'
                 , ''
                 , 'examples:'
                 , ''
                 , 'nexus ls                      .. list all installed apps with all infos'
                 , 'neuxs ls foo                  .. show all infos about the app "foo"'
                 , 'nexus ls --name --version     .. list all installed apps and'
                 , '                                 filter `package.name` and `package.version`'
                 , 'nexus ls foo --name --version .. show `package.name` and `package.version` of'
                 , '                                 of the installed app "foo"'
                 ].join('\n')
help.subscribe = [ 'nexus subscribe <event> .. pipe events to stdout'
                 , ''
                 , '<event> is a wildcarded eventemitter2-event'
                 , ''
                 , 'examples:'
                 , ''
                 , 'nexus subscribe                       .. subscribe to all events'
                 , 'nexus subscribe "*"                   .. subscribe to all events'
                 , 'nexus subscribe all                   .. subscribe to all events'
                 , 'nexus subscribe "*::*::*"             .. subscribe to all events'
                 , 'nexus subscribe monitor::<id>::*      .. only events from that monitor'
                 , 'nexus subscribe monitor::<id>::stdout .. listen for an app stdout'
                 , 'nexus subscribe monitor::<id>::stderr .. listen for an app stderr'
                 , 'nexus subscribe monitor::<id>::start  .. the app has been (re)started'
                 , 'nexus subscribe monitor::<id>::exit   .. an app exited'
                 , 'nexus subscribe monitor::*::connected .. an app has been started and'
                 , '                                         the monitor-server has connected'
                 , 'nexus subscribe monitor::*::exit      .. an app has exited'
                 , 'nexus subscribe server::*::installed  .. when an app get installed'
                 , 'nexus subscribe server::*::error      .. listen for nexus-server errors'
                 , ''
                 , 'note: in bash you may want to wrap the event with "",'
                 , '      since "*" is a wildcard in bash too..'
                 , 'note: shortcut for "subscribe" is "sub"'
                 ].join('\n')
help.sub       = help.subscribe
help.ps        = [ 'nexus ps [<id>] [<filter>]'
                 , ''
                 , 'examples:'
                 , ''
                 , 'nexus ps --uptime'
                 , 'nexus ps 20a00a0d --package.name --options'
                 , ''
                 , 'available filters:'
                 , ''
                 , 'id, monitorPid, pid, crashed, ctime, uptime, uptimeH, package.name,'
                 , 'package.version, package.<any-package.json-value>, script,'
                 , 'options, command, env, max, running'
                 , ''
                 , 'note: if no <id> is passed, it will list all running programs'
                 , '      if no <filter> is passed, it will print all information'
                 ].join('\n')
help.start     = [ 'nexus start [<startOptions>] <appName> [<appOptions>]'
                 , ''
                 , 'examples:'
                 , ''
                 , 'nexus start installedApp -p 3001'
                 , 'nexus start installedApp/path/to/script.js -p 3002'
                 , 'nexus start /home/me/foo.js -p 3003'
                 , 'nexus start ./foo.js -p 3004'
                 , 'nexus start foo.js -p 3005'
                 , 'nexus start --max 0 installedApp'
                 , 'nexus start --env.DEBUG=* foo.js'
                 , ''
                 , 'startOptions:'
                 , ''
                 , '--env.<key> .. set the process.env.<key>'
                 , '--max       .. restart script upon crash only <max> times'
                 , '--cmd       .. start script with <command>'
                 , ''
                 , 'the algorithm looks like this:'
                 , ''
                 , '/^\\//.test(<appName>)'
                 , '  ? script = <appName>'
                 , '  : CWD+"/<appName>" exists'
                 , '    ? start CWD+"/<appName>"'
                 , '    : /\\//.test(<appName>)'
                 , '      ? <appName>.split("/")[0] is an installed app'
                 , '        ? script = nexusApps+"/"+<appName>'
                 , '        : invalid startScript'
                 , '      : <appName> an installed app'
                 , '        ? look for package.json-startScript'
                 , '          ? npm start (note: <options> will overwrite the options'
                 , '                       defined in the package.json-startScript)'
                 , '          : appPath+"/server.js" exists || appPath+"/app.js" exists'
                 , '            ? script = appName+"/server.js" || appName+"/app.js"'
                 , '            : invalid startScript'
                 , '        : invalid startScript'
                 ].join('\n')
help.restart   = [ 'nexus restart <id> .. restarts the program (not the monitor)'
                 , 'nexus restart <id1> <id2>'
                 ].join('\n')
help.stop      = [ 'nexus stop <id>    .. stops a running app (and the monitor)'
                 , 'nexus stop <id1> <id2>'
                 ].join('\n')
help.stopall   = [ 'nexus stopall      .. there are no parameters, stops all apps'
                 , '                      and their monitors'
                 ].join('\n')
help.runscript = [ 'nexus runscript [<appName> <scriptName>]'
                 , ''
                 , '* do `nexus ls --scripts` to list available scripts'
                 , '* the script is started with require("child_process").exec()'
                 , '* the script will not be restarted upon crash'
                 , '  `nexus runscript foo start` is not like `nexus start foo`!'
                 , '* you can kill the running script with `^C`'
                 , ''
                 , 'example:'
                 , ''
                 , 'nexus runscript foo test .. will run the apps.foo.package.scripts.test -script'
                 ].join('\n')
help.logs      = [ 'nexus logs       .. list available logs'
                 , 'nexus logs clean .. delete all log-files of not running apps'
                 , 'nexus logs stdout <id> [-n <number of lines>] .. -n is 20 per default'
                 , 'nexus logs stderr <id> [-n <number of lines>] .. -n is 20 per default'
                 , ''
                 , 'note: the name of log-files is the path to the script without the'
                 , '      nexus-apps-root-path appended by ".<id>.[stdout/stderr].log"'
                 , '      where "/" and "\\s" are replaced with "_"'
                 ].join('\n')
help.server    = [ 'nexus server .. (without any options) will print information'
                 , '                about the server - if it is running'
                 , ''
                 , 'examples:'
                 , ''
                 , 'nexus server start [-c <path to configFile>]'
                 , 'nexus server stop'
                 , 'nexus server restart'
                 , 'nexus server version  .. print version of the current running nexus-server'
                 , ''
                 , 'note: the default-configFile-path is ~/.nexus/config.js'
                 , 'note: starting AND stopping the nexus-server will reset the reboot-database'
                 ].join('\n')
help.reboot    = [ 'nexus reboot [<path to database>]'
                 , ''
                 , '1) dump database into memory'
                 , '2) stop all running apps (if any is running)'
                 , '3) stop the nexus-server (if it is running)'
                 , '4) start the nexus-server (this will reset the database)'
                 , '5) start all programms stored in the memory-dump of the database'
                 , ''
                 , 'note: the default-path for the database is ~/.nexus/db.dirty'
                 ].join('\n')

if (!argv._[0]) exit(null, usage)
else if (argv._[0] == 'help') {
  if (!argv._[1] || !help[argv._[1]])
    return exit(null, usage)
  exit(null, help[argv._[1]])
}
else {
  var opts = {}
  if (argvNexus.r && _config.remotes[argvNexus.r]) {
    opts.host = _config.remotes[argvNexus.r].host
    opts.port = _config.remotes[argvNexus.r].port
    try {
      if (_config.remotes[argvNexus.r].key)
        opts.key = fs.readFileSync(_config.remotes[argvNexus.r].key)
    } catch(e) { exit('can not read key-file: '+_config.remotes[r].key,e) }
    try {
      if (_config.remotes[argvNexus.r].cert)
        opts.cert = fs.readFileSync(_config.remotes[argvNexus.r].cert)
    } catch(e) { exit('can not read cert-file: '+_config.remotes[argvNexus.r].cert,e) }
  } else {
    opts.host = _config.host
    opts.port = _config.port
    try {
      if (_config.key)
        opts.key = fs.readFileSync(_config.key)
    } catch(e) { exit('can not read key-file: '+_config.key,e) }
    try {
      if (_config.cert)
        opts.cert = fs.readFileSync(_config.cert)
    } catch(e) { exit('can not read cert-file: '+_config.cert,e) }
    if (_config.socket) opts = _config.socket
  }
  var client = dnode({type:'NEXUS_CLI'})
  client.connect(opts, function(remote, conn){
    _conn = conn
    nexus = remote
    // process.stdin.resume()
    // process.stdin.on('data',function(data) {
    //   var cmd = data.toString().replace('\n','')
    //   argv = opti(cmd.split(' ')).argv
    //   parseArgs()
    // })
    parseArgs()
    conn.on('end',function(){exit('disconnected from server')})
  })
  client.on('error',function(err){
    if ((err.code == 'ECONNREFUSED' || err.code == 'ENOENT') && !argvNexus.r) {
      if (['version','config','ls','install','uninstall'
          ,'server','logs','start'
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
      nexus.version(exit)
      break
    case 'config':
      nexus.config(exit)
      break
    case 'ls':
      var opts = {}
      if (argv._[0]) opts.name = argv._[0]
      var filter = _.without(Object.keys(argvCmd),'_','$0')
      if (filter.length>0) opts.filter = filter
      nexus.ls(opts, exit)
      break
    case 'install':
      var pkg = argv._[0]
      if (/^\//.test(pkg)) {
        nexus.install({package:pkg, name:argv._[1]}, exit)
      }
      else {
        path.exists(process.cwd()+'/'+pkg,function(exists){
          if (exists) pkg = process.cwd()+'/'+pkg
          nexus.install({package:pkg, name:argv._[1]}, exit)
        })
      }
      break
    case 'rm':
    case 'uninstall':
      nexus.uninstall(argv._[0], exit)
      break
    case 'ps':
      var opts = {}
      if (argv._[0]) opts.id = argv._[0]
      var filter = _.without(Object.keys(argvCmd),'_','$0')
      if (filter.length>0) opts.filter = filter
      nexus.ps(opts, exit)
      break
    case 'start':
      var scriptOpts = process.argv.slice(process.argv.indexOf(argv._[0])+1)
      var startOpts = process.argv.slice( process.argv.indexOf(cmd)+1
                                        , process.argv.indexOf(argv._[0]) )
      startOpts = opti.parse(startOpts)
      var env = startOpts.env || null
      var max = startOpts.max || null
      var cmd = startOpts.cmd || null
      var script = argv._[0]
      var opts = {script:script, options:scriptOpts, env:env, max:max, cmd:cmd}

      if (argv.debug) opts.env = {NODE_DEBUG:true}
      if (/^\//.test(script)) {
        nexus.start(opts, exit)
      }
      else {
        path.exists(process.cwd()+'/'+script,function(exists){
          if (exists) script = process.cwd()+'/'+script
          nexus.start(opts, exit)
        })
      }
      break
    case 'restart':
      nexus.restart(argvCmd._, exit)
      break
    case 'stop':
      nexus.stop(argvCmd._, exit)
      break
    case 'stopall':
      nexus.stopall(exit)
      break
    case 'runscript':
      var opts = {}
      opts.name = argv._[0]
      opts.script = argv._[1]
      if (!opts.name || !opts.script)
        return exit(new Error('no name or script defined'))
      var stdout = function(data) {console.log('stdout →',data.replace(/\n$/, ''))}
      var stderr = function(data) {console.log('stderr →',data.replace(/\n$/, ''))}
      var kill = function(killIt) {
        var stdin = process.openStdin()
        require('tty').setRawMode(true)
        stdin.on('keypress', function (chunk, key) {
          if (key && key.ctrl && key.name == 'c') {
            console.log('killing processes')
            killIt(exit())
          }
        })
      }
      var done = function(err) {exit(err)}
      nexus.runscript(opts, stdout, stderr, kill, done)
      break
    case 'logs':
      var opts = {cmd:argvCmd._[0], id:argvCmd._[1], lines:argvCmd.n}
      nexus.logs(opts, exit)
      break
    case 'server':
      nexus.server({cmd:argv._[0],debug:argv.debug}, exit)
      break
    case 'sub':
    case 'subscribe':
      var emit = function(event, data) {
        var val = data ? data.toString().replace(/\n$/, '') : '•' 
        console.log(event,'→',val)
      }
      nexus.subscribe(argv._[0], emit)
      break
    default:
      exit('unknown command: '+cmd)
  }
}

function exit(err,msg) {
  if (err) console.error('error:',err)
  else msg && console.log(msg)
  _conn && _conn.end()
  process.exit(0)
}

