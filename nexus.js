  //
 // nexus (remote program installation and control)
//

module.exports = nexus
nexus.version = version
nexus.config = config
nexus.ls = ls
nexus.install = install
nexus.uninstall = uninstall
nexus.start = start
nexus.exec = exec
nexus.execscript = execscript
nexus.logs = logs
nexus.server = server

var fs      = require('fs')
  , path    = require('path')
  , cp      = require('child_process')
  , dnode   = require('dnode')
  , _       = require('underscore')
  , fstream = require('fstream')
  , AA      = require('async-array')
  , EE2     = require('eventemitter2').EventEmitter2
  , ee2     = new EE2({wildcard:true,delimiter:'::',maxListeners:20})
  , rimraf  = require('rimraf')
  , npm     = require('npm')
  , mkdirp  = require('mkdirp')
  , ncp     = require('ncp')
  , _pkg    = require('./package.json')
  , debug   = require('debug')('nexus')
  , apps = {}
  , monitors = {}
  , serverMonitor = null
  , subscriptions = {}
  , subscriptionListeners = {}
  , userConfig = null

// node@0.6.x compat
fs.exists = fs.exists || path.exists
fs.existsSync = fs.existsSync || path.existsSync

ee2.onAny(function(data){debug(this.event,'→',data)})

/**
 * nexus
 *
 * @param {String|Object} config
 * @return {dnode-middleware}
 */
function nexus(configParam, cb) {
  userConfig = configParam
  // userConfig = configParam
  function dnodeServer(remote, conn) {
    var self = this
    this.version    = version
    this.config     = config
    this.ls         = ls
    this.install    = install
    this.uninstall  = uninstall
    this.ps         = ps
    this.start      = start
    this.restart    = restart
    this.stop       = stop
    this.stopall    = stopall
    this.exec       = exec
    this.execscript = execscript
    this.logs       = logs
    this.remote     = remote
    this.server     = server
    this.subscribe  = function(event, emit, cb) {
      if (event == '*' || event == 'all') event = '**'
      if (!subscriptions[event]) {
        subscriptions[event] = {}
        subscriptionListeners[event] = function(data){
          var self = this
          _.each(subscriptions[event],function(x,i){x(self.event,data)})
        }
        ee2.on(event,subscriptionListeners[event])
      }
      subscriptions[event][conn.id] = emit
      cb && cb()
    }
    this.unsubscribe = function(events, cb) {
      cb = _.isFunction(arguments.length-1) ? arguments.length-1 : function(){}
      events = _.isString(events)
               ? [events]
               : (_.isArray(events) && events.length>0)
                 ? events
                 : Object.keys(subscriptions)

      var remaining = []
      _.each(subscriptions,function(x,i){
        if (!x[conn.id]) return
        if (!~events.indexOf(i)) return remaining.push(i)
        delete x[conn.id]
        if (Object.keys(x).length == 0) {
          ee2.removeListener(subscriptionListeners[i])
          delete subscriptionListeners[i]
        }
      })
      cb(null, remaining)
    }
    conn.on('remote',function(rem){
      if (!rem.type || !rem.id) return
      if (rem.type == 'NEXUS_MONITOR') {
        monitors[rem.id+''] = rem
        rem.subscribe(function(event,data){
          ee2.emit('monitor::'+rem.id+'::'+event,data)
        },function(){
          ee2.emit('monitor::'+rem.id+'::connected')
        })
        conn.on('end',function(){
          ee2.emit('monitor::'+rem.id+'::disconnected')
          delete monitors[rem.id]
          self.unsubscribe()
        })
      }
      if (rem.type == 'NEXUS_SERVER_MONITOR') {
        if (serverMonitor) return rem.stop()
        serverMonitor = rem
        rem.subscribe(function(event,data){
          ee2.emit('server::'+rem.id+'::'+event,data)
        },function(){
          ee2.emit('server::'+rem.id+'::connected')
        })
        conn.on('end',function(){
          ee2.emit('server::'+rem.id+'::disconnected')
          self.unsubscribe()
        })
      }
      if (rem.type == 'NEXUS_APP') {
        if (!monitors[rem.id+''] || apps[rem.id+'']) {
          conn.end()
          return
        }
        apps[rem.id+''] = rem
        ee2.emit('app::'+rem.id+'::connected')
        conn.on('end',function(){
          ee2.emit('app::'+rem.id+'::disconnected')
          delete apps[rem.id+'']
        })
      }
    })
  }
  dnodeServer.version = version
  dnodeServer.config = config
  dnodeServer.ls = ls
  dnodeServer.install = install
  dnodeServer.uninstall = uninstall
  dnodeServer.start = start
  dnodeServer.exec = exec
  dnodeServer.execscript = execscript
  dnodeServer.logs = logs
  dnodeServer.server = server
  return dnodeServer
}

/**
 * version
 *
 * @param {Function} callback - arguments: error, version-number
 * @return {String} version-number
 */
function version(cb) {
  cb && cb(null, _pkg.version)
  return _pkg.version
}

/**
 * config
 *
 * @param {Function} callback - arguments: error, config
 * @return {Object} config
 */
function config(cb) {

  var currConfig = {}
    , fileConfig = {}
    , home = ( process.platform === "win32"
             ? process.env.USERPROFILE
             : process.env.HOME )
    , configPath = home+'/.nexus/config.js'

  if (userConfig && _.isString(userConfig))
    configPath = userConfig
  if (userConfig && _.isObject(userConfig))
    currConfig = userConfig

  try { fileConfig = require(configPath) }
  catch (e) {} // no config-file, so we use currConfig or hardcoded defaults

  currConfig.prefix  = currConfig.prefix  || fileConfig.prefix  || home+'/.nexus'
  currConfig.key     = currConfig.key     || fileConfig.key     || null
  currConfig.cert    = currConfig.cert    || fileConfig.cert    || null
  currConfig.ca      = currConfig.ca      || fileConfig.ca      || null
  currConfig.socket  = currConfig.socket  || fileConfig.socket  || currConfig.prefix+'/socket'
  currConfig.tmp     = currConfig.tmp     || fileConfig.tmp     || currConfig.prefix+'/tmp'
  currConfig.apps    = currConfig.apps    || fileConfig.apps    || currConfig.prefix+'/apps'
  currConfig.logs    = currConfig.logs    || fileConfig.logs    || currConfig.prefix+'/logs'
  currConfig.dbs     = currConfig.dbs     || fileConfig.dbs     || currConfig.prefix+'/dbs'
  currConfig.host    = currConfig.host    || fileConfig.host    || '0.0.0.0'
  currConfig.port    = currConfig.port    || fileConfig.port    || 0xf00
  currConfig.remotes = currConfig.remotes || fileConfig.remotes || {}

  // #TODO if key/cert/ca is set, check for validity

  new AA( [ currConfig.logs
          , currConfig.apps
          , currConfig.tmp
          , currConfig.dbs
          ] ).map(function(x, i, next){
    fs.exists(x, function(exists){
      if (!exists) mkdirp(x,0755,function(err){next(err)})
      else next()
    })
  }).done(function(err, data){
    cb && cb(err, currConfig)
  }).exec()

  return currConfig
}

/**
 * install
 *
 * @param {Object} options
 * @param {Function} callback, 2 arguments: error, information about
 *                   installed package
 */
function install(opts, cb) {
  debug('installing',opts)
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function() {}

  opts = opts || {}
  if (!opts.package) return cb('no package given to install')

  var _config = config()
  var tmpPath = _config.tmp+'/'+Math.floor(Math.random()*Math.pow(2,32)).toString(16)
  mkdirp(tmpPath,0755,function(err){
    if (err) return cb(err)
    // without checkDns the npm-childprocess will run,
    // print an error-msg and never exit
    if ((/:\/\//.test(opts.package)))
      return checkDns(opts.package, function(err){runNpm(err, installPackage)})
    runNpm(null, installPackage)
  })

  function runNpm(err, cb){
    if (err) return cb(err)
    var env = process.env
    env.npm_config_prefix = tmpPath
    cp.execFile( __dirname+'/node_modules/npm/cli.js'
               , [ 'install', '-p', '-g', opts.package ]
               , { cwd: tmpPath, env:env }
               , cb )
  }

  function installPackage(err, stdout, stderr) {
    if (err) return cb(err)
    var stdoutLines = stdout.split('\n')
    var tmpPathPkg = stdoutLines[stdoutLines.length-2]
    var package
    try {
      package = require(tmpPathPkg+'/package.json')
    } catch(e) {
      return cb(e)
    }

    var name = opts.name || package.name+'@'+package.version
    fs.exists(_config.apps+'/'+name,function(exists){
      if (exists) {
        var found = false, i = 0
        while (!found) {
          if (!fs.existsSync(_config.apps+'/'+name+'_'+(++i)))
            found = true
        }
        name = name+'_'+i
      }
      debug('copying',tmpPathPkg,'→',_config.apps+'/'+name)
      ncp.ncp(tmpPathPkg,_config.apps+'/'+name,function(err){
        if (err) return cb(err)
        debug('deleting',tmpPath)
        rimraf(tmpPath,function(err){
          if (err) return cb(err)
          debug('installed',name)
          if (serverMonitor)
            ee2.emit('server::'+serverMonitor.id+'::installed',name)
          var result = {}
          result[name] = package
          cb(null, result)
        })
      })
    })
  }
}

/**
 * uninstall
 *
 * @param {Object} options
 * @param {Function} callback, 2 arguments: error, information about
 *                   uninstalled package
 */
function uninstall(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]

  if (typeof arguments[0] === 'string')
    opts = arguments[0]
  else
    return cb('not sure how to handle the parameter')

  var self = this
  var _config = config()
  var path = _config.apps+'/'+opts

  fs.stat(path,function(err,stat){
    if (err) return cb(opts+' not installed')
    ps(function(err,res){
      if (err) return cb(err)
      var running = []
      _.each(res,function(x,i){
        if (x.name == opts) running.push(i)
      })
      if (running.length > 0)
        return cb('cant uninstall "'+opts+'", '
                 +'monitors are running: '
                 +JSON.stringify(running))
      rimraf(_config.apps+'/'+opts,function(){
        if (serverMonitor)
          ee2.emit('server::'+serverMonitor.id+'::uninstalled',opts)
        cb(null,opts)
      })
    })
  })
}

/**
 * ls
 *
 * @param {Object} options
 * @param {Function} callback, 2 arguments: error, array containing information
 *                   about installed applications
 */
function ls(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]

  var _config = config()
  if (opts && opts.name) {
    fs.exists(_config.apps+'/'+opts.name+'/package.json',function(exists){
      if (!exists) return cb(new Error('package is not installed: '+opts.name))
      readPackages([opts.name])
    })
  }
  else {
    fs.readdir(_config.apps,function(e,d){
      if (e) return cb(e)
      readPackages(d)
    })
  }

  function readPackages(arr) {
    var result = {}
    new AA(arr).map(function(x,i,next){
      fs.readFile(_config.apps+'/'+x+'/package.json','utf-8',function(e,d){
        try {d = JSON.parse(d)}
        catch(e) {}
        if (e) {
          result[x] = 'UNDEFINED'
          return next()
        }
        if (!opts.filter || opts.filter.length == 0) {
          result[x] = d
        }
        else {
          result[x] = {}
          _.each(opts.filter, function(y,j){
            var info = objPath(d,y)
            if (info !== undefined) result[x][y] = info
            else result[x][y] = 'UNDEFINED'
          })
        }
        next()
      })
    }).done(function(err,data){
      if (err) return cb(err)
      cb && cb(err,result)
    }).exec()
  }
}

/**
 * ps
 *
 * @param {Object} options
 * @param {Function} callback, 2 arguments: error, array containing information
 *                   about running applications
 */
function ps(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]

  if (arguments.length < 2)
    opts = {}

  opts = opts || {}
  if (!opts.filter || !Array.isArray(opts.filter) || opts.filter.length==0)
    opts.filter = null

  var result = {}

  if (Object.keys(monitors).length == 0)
    return cb(null,result)

  if (opts.id && monitors[opts.id]) {
    if (!monitors[opts.id])
      return cb('monitor with id: "'+opts.id+'" is not connected')
    if (!opts.filter) {
      monitors[opts.id].info(function(err,data){
        cb(err,data)
      })
      return
    }
    monitors[opts.id].info(function(err,data){
      _.each(opts.filter, function(x,i){
        var info = objPath(data,x)
        if (info !== undefined) result[x] = info
        else result[x] = 'UNDEFINED'
      })
      cb(err,result)
    })
    return
  }

  new AA(Object.keys(monitors)).map(function(x,i,next){
    monitors[x].info(function(err,data){
      if (!opts.filter)
        result[x] = data
      else {
        result[x] = {}
        _.each(opts.filter,function(y,j){
          var info = objPath(data,y)
          if (info !== undefined) result[x][y] = info
          else result[x][y] = 'UNDEFINED'
        })
      }
      next(err,data)
    })
  }).done(function(err,data){
    if (err) return cb(err)
    cb && cb(err,result)
  }).exec()
}

/**
 * start
 *
 * @param {Object} options
 * @param {Function} callback, 2 arguments: error, array containing information
 *                   about started applications
 */
function start(opts, cb) {
  debug('starting',opts.script)
  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}

  opts = (_.isObject(opts) && Object.keys(opts).length>0)
         ? opts : null

  if (!opts) return cb(new Error('no start-options defined'))

  parseStart(opts, function(err, data){
    if (err) return cb(err)
    debug('parsedStart',data.script)
    genId(function(err,id){
      debug('starting monitor',id,data.script)
      ee2.on('monitor::'+id+'::connected',function(){
        monitors[id].start(cb)
      })
      var child = cp.spawn
        ( 'node'
        , [ __dirname+'/bin/monitor.js'
          , '-c', JSON.stringify(config())
          , '-s', JSON.stringify(data)
          , '-i', id ]
        )
    })
  })
}

/**
 * restart
 *
 * @param {Array|String} ids of application you want to restart
 * @param {Function} callback, 2 arguments: error, array containing information
 *                   about restarted applications
 */
function restart(ids, cb) {
  ids = _.isString(ids) ? [ids] : _.isArray(ids) ? ids : null
  cb = arguments[arguments.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}
  if (!ids) return cb(new Error('invalid argument'))
  new AA(ids).map(function(x,i,next){
    if (!monitors[x])
      return next(new Error('there is no process with id: '+x))
    monitors[x].restart(next)
  }).done(cb).exec()
}

/**
 * stop
 *
 * @param {Array|String} ids of application you want to stop
 * @param {Function} callback, 2 arguments: error, array containing information
 *                   about stopped applications
 */
function stop(ids, cb) {
  ids = _.isString(ids) ? [ids] : _.isArray(ids) ? ids : null
  cb = arguments[arguments.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}
  if (!ids) return cb(new Error('invalid argument'))
  new AA(ids).map(function(x,i,next){
    if (!monitors[x])
      return next(new Error('there is no process with id: '+x))
    monitors[x].stop(function(err,data){
      if (err) return next(err)
      ee2.once('monitor::'+x+'::disconnected',function(){
        next(null,data)
      })
    })
  }).done(cb).exec()
}

/**
 * stopall
 *
 * @param {Function} callback, 2 arguments: error, array containing information
 *                   about stopped applications
 */
function stopall(cb) {
  cb = _.isFunction(cb) ? cb : function(){}
  var keys = Object.keys(monitors)
  if (keys.length == 0) return cb(null,[])
  new AA(keys).map(function(x,i,next){
    ee2.emit('debug','stopping '+x)
    monitors[x].stop(function(err,data){
      ee2.once('monitor::'+x+'::disconnected',function(){
        next(null,data)
      })
    })
  }).done(cb).exec()
}

/**
 * execute a command with CWD: $nexus.config.apps
 *
 * @param {String}
 * @param {Function}
 * @param {Function}
 * @param {Function}
 * @param {Function} callback, 1 argument: exit-code
 */
function exec(cmd, stdout, stderr, kill, cb) {
  if (!_.isString(cmd))
    return cb(new Error('invalid arguments, first arg must be string'))
  kill = _.isFunction(kill) ? kill : function(){}
  stdout = _.isFunction(stdout) ? stdout : function(){}
  stderr = _.isFunction(stderr) ? stderr : function(){}
  kill = _.isFunction(kill) ? kill : function(){}
  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}
  var _config = config()
  var sh = (process.platform === "win32") ? 'cmd' : 'sh'
  var shFlag = (process.platform === "win32") ? '/c' : '-c'
  console.log('spawning',sh, [shFlag, cmd])
  var child = cp.spawn(sh, [shFlag, cmd], {cwd:_config.apps} )
  kill(function(){child.kill('SIGHUP')})
  child.stdout.on('data',function(d){stdout(d.toString().replace(/\n$/, ''))})
  child.stderr.on('data',function(d){stderr(d.toString().replace(/\n$/, ''))})
  child.on('exit',cb)
  child.on('error',function(e){console.log('exec cp-error',opts,e)})
}

/**
 * execscript - execute scripts which are defined in the app's package.json
 *
 * the package.json of `myapp` looks like this:
 *
 *     { "name":"myapp", "version":"0.0.0", "scripts":{"test":"make test"} }
 *
 * then you can do:
 *
 *     execscript ( {name:'myapp',script:'test'}
 *                , function(d){console.log('stdout:',d)}
 *                , function(d){console.log('stderr:',d)}
 *                , function(kill){kill()}
 *                , function(err,stdout,stderr){} )
 *
 * @param {Object} has to contain fields: script and name
 * @param {Function} 1 argument: a function which gets called on stdout-output
 * @param {Function} 1 argument: a function which gets called on stderr-output
 * @param {Function} 1 argument: a function which kills the process when it gets called
 * @param {Function} callback, 1 argument: exit-code
 */
function execscript(opts, stdout, stderr, kill, cb) {
  if (!opts || !opts.name || !opts.script)
    return cb(new Error('invalid arguments, name or script not defined'))
  stdout = _.isFunction(stdout) ? stdout : function(){}
  stderr = _.isFunction(stdout) ? stderr : function(){}
  kill = _.isFunction(kill) ? kill : function(){}
  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}
  ls({name:opts.name},function(err, data){
    if (err) return cb(err)
    if ( !data[opts.name]
         || !data[opts.name].scripts
         || !data[opts.name].scripts[opts.script] )
      return cb(new Error('the app "'+opts.name
                         +'" has no script called "'+opts.script+'"'))

    var _config = config()
    // yes! this is like npm is doing it
    var sh = (process.platform === "win32") ? 'cmd' : 'sh'
    var shFlag = (process.platform === "win32") ? '/c' : '-c'
    var child = cp.spawn
      ( sh, [shFlag, data[opts.name].scripts[opts.script] ]
      , { cwd : _config.apps+'/'+opts.name } )
    kill(function(){process.kill(child.pid, 'SIGHUP')})
    child.stdout.on('data',function(d){stdout(d.toString().replace(/\n$/, ''))})
    child.stderr.on('data',function(d){stderr(d.toString().replace(/\n$/, ''))})
    child.on('exit',cb)
    child.on('error',function(e){console.error('execscript cp-error',opts,e)})
  })
}

/**
 * logs
 *
 * @param {Object}
 * @param {Function} callback, 2 arguments: error, logs (string)
 */
function logs(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  opts = opts === Object(opts) ? opts : {}

  if ( opts.cmd !== undefined
       && ( !~['stdout','stderr','clean'].indexOf(opts.cmd)
            || ( !!~['stdout','stderr'].indexOf(opts.cmd) && !opts.id ) ) )
    return cb(new Error('invalid arguments'))

  config(function(err, _config){
    if (err) return cb(err)
    if (!opts.cmd) return listLogs(cb)
    switch (opts.cmd) {
      case 'stdout':
      case 'stderr':
        readFile(opts.id, opts.cmd, cb)
        break
      case 'clean':
        clean(cb)
        break
      default:
        return cb(new Error('invalid first argument (unknown)'))
    }

    function listLogs(_cb) {
      fs.readdir(_config.logs,function(err,dataDir){
        if (err) return _cb(err)
        var result = {}
        _.each(dataDir,function(x,i){
          var id = x.split('.')[1]
          result[id] = {running:false}
          result[id].script = x.split('.')[0]
          if (serverMonitor && serverMonitor.id == id)
            result[id].running = true
        })
        _cb(null, result)
      })
    }

    function readFile(id, type, _cb) {
      fs.readdir(_config.logs,function(err,dataDir){
        if (err) return _cb(err)
        var file
        _.each(dataDir,function(x,i){
          if ( x.split('.')[1] == id && x.split('.')[2] == type )
            file = x
        })
        if (!file) return _cb(new Error('log-file not found'))
        fs.readFile(_config.logs+'/'+file, 'utf8', function(err, dataFile){
          if (err) return _cb(err)
          var lines = dataFile.split('\n')
          if (!opts.lines)
            return _cb(null, lines.splice(lines.length-20).join('\n'))
          if (opts.lines >= lines.length)
            opts.lines = lines.length
          _cb(null, lines.splice(lines.length - opts.lines).join('\n'))
        })
      })
    }

    function clean(_cb) {
      fs.readdir(_config.logs,function(err,data){
        if (err) return _cb(err)
        var toDel = []
        _.each(data,function(x,i){
          var split = x.split('.')
            , id = split[1]
          if (!monitors[id] && (!serverMonitor || (serverMonitor.id != id)))
            toDel.push(x)
        })
        new AA(toDel).map(function(x,i,next){
          fs.unlink(_config.logs+'/'+x,next)
        }).done(function(err,data){
          if (err) return _cb(err)
          if (serverMonitor)
            ee2.emit('server::'+serverMonitor.id+'::cleanedlogs',data)
          _cb(null, data.length)
        }).exec()
      })
    }
  })
}

/**
 * server
 *
 * @param {Object}
 * @param {Function} callback, 2 arguments: error, data
 */
function server(opts, cb) {
  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}

  var optsKeys = Object.keys(opts)
  opts = (_.isObject(opts) && opts.cmd)
         ? opts : null

  if (!opts && !serverMonitor)
    return cb('server is not running')

  if (!opts && serverMonitor)
    return serverMonitor.info(cb)
    // return cb(null,serverMonitor)

  if (opts.cmd && opts.cmd == 'version') {
    if (!serverMonitor) return cb('server is not running')
    serverMonitor.info(function(err,data){
      cb(err,data.package.version)
    })
    return
  }

  if (opts.cmd && (opts.cmd == 'start' || opts.cmd == 'reboot')) {
    if (serverMonitor)
      return cb(new Error('server is already running'))
    var _config = config()
    delete _config.remotes
    var env = { NEXUS_CONFIG : JSON.stringify(_config) }
    if (opts.debug) env.NODE_DEBUG = opts.debug
    if (opts.cmd == 'reboot') env.NEXUS_REBOOT = true
    var startOpts =
      { script: __dirname+'/bin/server.js'
      , command: 'node'
      , package: _pkg
      , env: env
      }

    debug('server-start starting',startOpts.script)
    start(startOpts)

    var client

    var clientOpts = _config.socket
    if (!_config.socket) {
      clientOpts = { port : _config.port
                   , host : _config.host }
      try {
        if (_config.key)
          clientOpts.key = fs.readFileSync(_config.key)
        if (_config.cert)
          clientOpts.cert = fs.readFileSync(_config.cert)
      }
      catch (e) {
        cb(e)
      }
    }
    ;(function check(){
      var client = dnode.connect(clientOpts,function(r,c){
        r.server(function(err, data){
          client.end()
          if (err) return setTimeout(check,20)
          cb(err,data)
        })
      })
      client.on('error',function(e){
        client.end()
        if (e.code === 'ENOENT' || e.code === 'ECONNREFUSED')
          setTimeout(check,20)
      })
    })()
  }
  else if (opts.cmd && opts.cmd == 'stop') {
    if (serverMonitor) {
      cb(null,'will try to stop the server, check with `nexus server`')
      return serverMonitor.stop(cb)
    }
    else return cb('cant stop, server is not running')
  }
  else if (opts.cmd && opts.cmd == 'restart') {
    cb(null,'will try to restart the server, check with `nexus server`')
    return serverMonitor.restart(cb)
  }
  else cb('invalid arguments')
}

/**
 * server
 *
 *         : CWD+"/<appName>" exists
 *     (A)   ? start CWD+"/<appName>"
 *           : /\\//.test(<appName>)
 *             ? <appName>.split("/")[0] is an installed app
 *     (B)       ? script = nexusApps+"/"+<appName>
 *               : invalid startScript
 *             : <appName> an installed app
 *               ? look for package.json-startScript
 *     (C)         ? 'node foo.js -b ar' -> spawn( 'node'
 *                                               , ['/<pathToApp>/foo.js','-b','ar']
 *                                               , {cwd:'/<pathToApp>'} )
 *     (D)         : look for package.json-bin
 *                   ? script = appName+"/"+package.json-bin
 *                   : appPath+"/server.js" exists || appPath+"/app.js" exists
 *     (E)             ? script = appName+"/server.js" || appName+"/app.js"
 *                     : invalid startScript
 *               : invalid startScript
 *
 * @param {Object}
 * @param {Function} callback, 2 arguments: error, data
 */
function parseStart(opts, cb) {
  debug('parsing start-options',opts.script)
  var result = {}
  opts = opts || {}

  if (!opts.script) return cb('no script defined')

  result.script = null
  result.command = opts.command || 'node'
  result.options = opts.options || []
  result.env = opts.env || {}
  result.cwd = opts.cwd || process.cwd()
  result.max = opts.max
  result.name = 'unnamed'
  result.package = opts.package || null

  var _config = config()
  var maybeApp = opts.script.split('/')[0]
    , appPath = null
  if (fs.existsSync(_config.apps+'/'+maybeApp)) {
    // console.log('---- A')
    result.name = maybeApp.split('/')[0]
    appPath = _config.apps+'/'+maybeApp
    try {
      result.package = JSON.parse(fs.readFileSync(appPath+'/package.json','utf-8'))
    } catch(e) {}
  }

  // handle `nexus start /some/file`
  result.script = /^\//.test(opts.script) ? opts.script : null

  // handle `nexus start appName/path/to/script`
  if (!result.script && /\//.test(opts.script)) {
    if (fs.existsSync(_config.apps+'/'+opts.script)) {
      // console.log('---- B')
      result.name = opts.script.split('/')[0]
      result.script = _config.apps+'/'+opts.script
    }
  }

  // handle `nexus start appName`
  if (!result.script) {
    if (result.package
        && result.package.scripts
        && result.package.scripts.start) {
      // console.log('---- C')
      var startScript = result.package.scripts.start
      if (/\w/.test(startScript)) {
        var split = startScript.split(' ')
        var isScript = fs.existsSync(appPath+'/'+split[0])
        if (isScript) {
          result.script = appPath+'/'+split[0]
          result.options = result.options || split.splice(1)
        }
        else {
          result.command = split[0]
          result.script = appPath+'/'+split[1]
          result.options = result.options || split.splice(2)
        }
      }
      else {
        result.script = appPath+'/'+startScript
      }
    }
    else if (result.package
             && result.package.bin) {
      // console.log('---- D')
      var startScript
      if (_.isString(result.package.bin)) {
        if (!fs.existsSync(path.join(appPath,result.package.bin)))
          cb('invalid script: '+path.join(appPath,result.package.bin))
        result.script = path.join(appPath,result.package.bin)
      }
      if (_.isObject(result.package.bin) && result.package.bin[result.name]) {
        if (!fs.existsSync(path.join(appPath,result.package.bin)))
          cb('invalid script: '+path.join(appPath,result.package.bin))
        result.script = path.join(appPath,result.package.bin[result.name])
      }
    }
    else if (appPath) {
      // console.log('---- E')
      var serverJsExists = fs.existsSync(appPath+'/server.js')
      var appJsExists = fs.existsSync(appPath+'/app.js')
      if (serverJsExists) result.script = appPath+'/server.js'
      else if (appJsExists) result.script = appPath+'/app.js'
      else result.script = appPath
    }
    else
      return cb('invalid script')
  }

  var split = result.script.split('/')
  split.pop()
  result.cwd = split.join('/')
  cb(null, result)
}

/**
 * objPath - create/access objects with a key-string
 *
 * @param {Object} scope
 * @param {String} key-string (e.g. 'a.b.c.d')
 * @param {Mixed} value to store in key (optional)
 * @return {Mixed} if value-param is given it will return
 *                 the object, otherwise it will return the value
 *                 of the selected key
 */
function objPath(obj, keyString, value) {
  var keys = keyString.split('.')
  if (obj[keys[0]] === undefined) obj[keys[0]] = {}
  var data = obj[keys[0]]
    , keys = keys.slice(1)

  if (!value) { // get data
    var value = data
    for (var i=0, len=keys.length; i<len; i++) {
      if (value === undefined) return false
      value = value[keys[i]]
    }
    return value
  } else { // set data
    var temp = data
    if (keys.length==0) {
      obj[keyString] = value
      return obj
    }

    for (var i=0, len=keys.length; i<len; i++) {
      if (i==(len-1)) {
        temp[keys[i]] = value
      } else {
        temp[keys[i]] = temp[keys[i]] || {}
        temp = temp[keys[i]]
      }
    }
    return data
  }
}

/**
 * genId
 *
 * @param {Function} callback, 2 arguments: error, id (string)
 */
function genId(cb) {
  config(function(err,_config){
    if (err) return cb(err)
    fs.readdir(_config.logs, function(err,data){
      if (err) return cb(err)
      var currIds = [], id
      _.each(data,function(x,i){
        var split = x.split('.')
        currIds.push(split[split.length-3])
      })
      do {
        id = Math.floor(Math.random()*Math.pow(2,32)).toString(16)+''
      } while(currIds.indexOf(id) != -1)
      cb(null,id)
    })
  })
}

/**
 * checkDns
 *
 * @param {String} uri
 * @param {Function} callback, 1 argument: error
 */
function checkDns(uri,cb) {
  var dns = require('dns')
  var domain = uri.split('://')[1]
  domain = domain.split('/')[0]
  domain = domain.split(':')[0]
  var split = domain.split('@')
  domain = split[split.length - 1]
  dns.lookup(domain,function(err,data,fam){
    if (err && domain!='localhost' && domain!='127.0.0.1' && domain!='0.0.0.0')
      return cb(err)
    cb()
  })
}

