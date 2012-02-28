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
nexus.runscript = runscript
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
  , monitors = {}
  , serverMonitor = null
  , subscriptions = {}
  , subscriptionListeners = {}
  , userConfig = null

// ee2.onAny(function(data){debug(this.event,'→',data)})
  
//------------------------------------------------------------------------------
//                                               constructor
//------------------------------------------------------------------------------

function nexus(configParam) {
  userConfig = configParam
  function dnodeServer(remote, conn) {
    var self = this
    this.version   = version
    this.config    = config
    this.ls        = ls
    this.install   = install
    this.uninstall = uninstall
    this.ps        = ps
    this.start     = start
    this.restart   = restart
    this.stop      = stop
    this.stopall   = stopall
    this.runscript = runscript
    this.logs      = logs
    this.cleanlogs = cleanlogs
    this.remote    = remote
    this.server    = server
    this.subscribe = function(event, emit, cb) {
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
               : (_.isArray(events) && events.length>0) ? events : null
      var remaining = []
      _.each(subscriptions,function(x,i){
        if (!x[conn.id]) return
        if (events && !~events.indexOf(i)) return remaining.push(i)
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
      if (rem.type == 'NEXUS_MONITOR_STARTER') {
        ee2.emit('monitor-starter::'+rem.id+'::connected')
      }
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
        })
      }
    })
    conn.on('end',function(){self.unsubscribe()})
  }
  dnodeServer.version = version
  dnodeServer.config = config
  dnodeServer.ls = ls
  dnodeServer.install = install
  dnodeServer.uninstall = uninstall
  dnodeServer.start = start
  dnodeServer.runscript = runscript
  dnodeServer.logs = logs
  dnodeServer.server = server
  return dnodeServer
}

//------------------------------------------------------------------------------
//                                               version
//------------------------------------------------------------------------------

function version(cb) {
  cb && cb(null, _pkg.version)
  return _pkg.version
}

//------------------------------------------------------------------------------
//                                               config
//------------------------------------------------------------------------------

function config(key, value, cb) {

  // #TODO get/set config

  if (key && value && !cb) cb = value
  if (key && !value && !cb) cb = key

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
  currConfig.tmp     = currConfig.tmp     || fileConfig.tmp     || currConfig.prefix+'/tmp'
  currConfig.apps    = currConfig.apps    || fileConfig.apps    || currConfig.prefix+'/apps'
  currConfig.logs    = currConfig.logs    || fileConfig.logs    || currConfig.prefix+'/logs'
  currConfig.host    = currConfig.host    || fileConfig.host    || '0.0.0.0'
  currConfig.port    = currConfig.port    || fileConfig.port    || 0xf00
  currConfig.remotes = currConfig.remotes || fileConfig.remotes || {}

  new AA( [ currConfig.logs
          , currConfig.apps
          , currConfig.tmp
          ] ).map(function(x, i, next){
    path.exists(x, function(exists){
      if (!exists) mkdirp(x,0755,function(err){next(err)})
      else next()
    })
  }).done(function(err, data){
    cb && cb(err, currConfig)
  }).exec()

  return currConfig
}

//------------------------------------------------------------------------------
//                                               install
//------------------------------------------------------------------------------

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
    var env = process.env
    env.npm_config_prefix = tmpPath
    cp.execFile( __dirname+'/node_modules/npm/cli.js'
               , [ 'install', '-p', '-g', opts.package ]
               , { cwd: tmpPath, env:env }
               , installPackage )
  })

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
    path.exists(_config.apps+'/'+name,function(exists){
      if (exists) {
        var found = false, i = 0
        while (!found) {
          if (!path.existsSync(_config.apps+'/'+name+'_'+(++i)))
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


//------------------------------------------------------------------------------
//                                               uninstall
//------------------------------------------------------------------------------

function uninstall(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]

  if (typeof arguments[0] === 'string')
    opts = arguments[0]
  else
    return cb('not sure how to handle the parameter')

  var _config = config()
  var path = _config.apps+'/'+opts
  fs.stat(path,function(err,stat){
    if (err) return cb(opts+' not installed')
    rimraf(_config.apps+'/'+opts,function(){
      if (serverMonitor)
        ee2.emit('server::'+serverMonitor.id+'::uninstalled',opts)
      cb(null,'uninstalled '+opts)
    })
  })
}

//------------------------------------------------------------------------------
//                                               ls
//------------------------------------------------------------------------------

function ls(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]

  var _config = config()
  if (opts && opts.name) {
    path.exists(_config.apps+'/'+opts.name+'/package.json',function(exists){
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
      if (arr.length==1) result = result[Object.keys(result)[0]]
      cb && cb(err,result)
    }).exec()
  }
}

//------------------------------------------------------------------------------
//                                               ps
//------------------------------------------------------------------------------

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
    if (!opts.filter) {
      return monitors[opts.id].info(cb)
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

//------------------------------------------------------------------------------
//                                               start
//------------------------------------------------------------------------------

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
      var child = cp.execFile
        ( __dirname+'/bin/monitor.js'
        , [ '-c', JSON.stringify(config())
          , '-s', JSON.stringify(data) 
          , '-i', id ]
        //, {env:process.env}
        , function(err,stdout,stderr){
            if (err) return cb(err)
            if (!serverMonitor) cb(null,data)
          }
        )
      child.stdout.on('data',function(d){debug('monitor-stdout',d.toString())})
      child.stderr.on('data',function(d){debug('monitor-stderr',d.toString())})
    })
  })
}

//------------------------------------------------------------------------------
//                                               restart
//------------------------------------------------------------------------------

function restart(id, cb) {
  debug('restarting',id)
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  if (!id || !monitors[id])
    return cb('there is no process with id: '+id)

  monitors[id].restart(cb)
}

//------------------------------------------------------------------------------
//                                               stop
//------------------------------------------------------------------------------

function stop(id, cb) {
  debug('stopping',id)
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}                              

  if (!id || !monitors[id])
    return cb(new Error('there is no process with id: '+id))

  monitors[id].stop(cb)
}

//------------------------------------------------------------------------------
//                                               stopall
//------------------------------------------------------------------------------

function stopall(cb) {
  debug('stopping all')
  if (!cb) cb = function() {}
  var keys = Object.keys(monitors)
  if (keys.length==0) return cb(null,[])
  new AA(Object.keys(monitors)).map(function(x,i,next){
    monitors[x].stop(next)
  }).done(function(err,data){
    if (!err) debug('stopped',data)
    cb(err,data)
  }).exec()
}

//------------------------------------------------------------------------------
//                                               runscript
//------------------------------------------------------------------------------

function runscript(opts, stdout, stderr, cb) {
  if (!opts || !opts.name || !opts.script)
    return cb(new Error('name or script not defined'))
  ls({name:opts.name},function(err,data){
    if (err)
      return cb(err)
    if (!data.scripts[opts.script])
      return cb(new Error('the app "'+opts.name
                         +'" has no script called "'+opts.script+'"'))

    var _config = config()
    var child = cp.exec
      ( data.scripts[opts.script]
      , {cwd:_config.apps+'/'+opts.name}
      , function(err,stdout,stderr){
          cb(err)
        } )
    cb(null,function(cb){
      process.kill(child.pid,'SIGHUP')
      cb && cb()
    })
    stdout && child.stdout.on('data',function(d){stdout(d)})
    stderr && child.stderr.on('data',function(d){stderr(d)})
  })
}

//------------------------------------------------------------------------------
//                                               logs
//------------------------------------------------------------------------------

function logs(opts, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  opts = opts || {}

  var _config = config()

  if (!opts.file) {
    return fs.readdir(_config.logs,function(err,data){
      if (err) return cb(err)
      cb(err, data.sort())
    })
  }

  fs.readFile(_config.logs+'/'+opts.file,'utf8',function(err,data){
    if (err) return error(err,cb)
    var lines = data.split('\n')
    if (!opts.lines)
      return cb(null, lines.splice(lines.length-20).join('\n'))
    if (opts.lines >= lines.length)
      opts.lines = lines.length
    cb(null, lines.splice(lines.length - opts.lines).join('\n'))
  })
}

//------------------------------------------------------------------------------
//                                               cleanlogs
//------------------------------------------------------------------------------

function cleanlogs(cb) {
  if (!cb) cb = function() {}
  var _config = config()
  fs.readdir(_config.logs,function(err,data){
    if (err) return cb(err)
    var toDel = []
    _.each(data,function(x,i){
      var split = x.split('.')
        , id = split[split.length-3]
      if (!monitors[id] && (serverMonitor.id != id))
        toDel.push(x)
    })
    new AA(toDel).map(function(x,i,next){
      fs.unlink(_config.logs+'/'+x,next)
    }).done(function(err,data){
      if (err) return cb(err)
      ee2.emit('server::'+serverMonitor.id+'::cleanedlogs',data)
      cb(null, data.length)
    }).exec()
  })
}

//------------------------------------------------------------------------------
//                                               remote
//------------------------------------------------------------------------------

function remote(rem, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  if (!_config.remotes[rem])
    return cb(new Error('dont know about the remote "'+rem+'"'))

  var _config = config()
  var opts = {}
  opts.host = _config.remotes[rem].host
  opts.port = _config.remotes[rem].port
  try {
    if (_config.remotes[rem].key)
      opts.key = fs.readFileSync(_config.remotes[rem].key)
    if (_config.remotes[argv.r].cert)
      opts.cert = fs.readFileSync(_config.remotes[rem].cert)
  } catch(e) { return cb(e) }

  var client = dnode({type:'NEXUS_REMOTE'})
  client.connect(opts, function(remote, conn) {
    cb(null, remote)
  })
  client.on('error',function(err){cb(err)})
}

//------------------------------------------------------------------------------
//                                               server
//------------------------------------------------------------------------------

function server(opts, cb) {
  cb = _.isFunction(arguments[arguments.length-1]) 
       ? arguments[arguments.length-1]
       : function() {}
       
  var optsKeys = Object.keys(opts)
  opts = (_.isObject(opts) && opts.cmd) 
         ? opts : null

  if (!opts && !serverMonitor) 
    return cb(new Error('server is not running'))
         
  if (!opts && serverMonitor) 
    return serverMonitor.info(cb)
  
  if (opts.cmd && opts.cmd == 'version') {
    if (!serverMonitor) return cb('server is not running')
    serverMonitor.info(function(err,data){
      cb(err,data.package.version)
    })
    return
  }

  if (opts.cmd && opts.cmd == 'start') {
    if (serverMonitor) 
      return cb(new Error('server is already running'))
    var _config = config()
    var startOpts =
      { script: __dirname+'/bin/server.js'
      , command: 'node'
      , package: _pkg
      , env:
        { NEXUS_CONFIG : JSON.stringify(_config)
        , NODE_DEBUG : !!opts.debug
        }
      }

    start(startOpts)

    var clientOpts = { port : _config.port
                     , host : _config.host
                     , reconnect : 100 }
    try {
      if (_config.key)
        clientOpts.key = fs.readFileSync(_config.key)
      if (_config.cert)
        clientOpts.cert = fs.readFileSync(_config.cert)
    }
    catch (e) {
      cb(e)
    }

    var client = dnode.connect(clientOpts,function(r,c){
      var _didit = false
      r.subscribe('server::*::connected',function(){
        r.server(function(err, data){
          if (_didit) return
          cb(err,data)
          _didit = true
          c.end()
          //process.exit(0)
        })
      })                                             
      r.server(function(err,data){
        if (err || _didit) return
        cb(err,data)
        _didit = true
        c.end()
        //process.exit(0)
      }) 
    })
    client.on('error',function(e){console.error(e)})
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
  else cb(new Error('invalid arguments'))
}

//------------------------------------------------------------------------------
//                                               parseStart
//------------------------------------------------------------------------------

function parseStart(opts, cb) {
  debug('parsing start-options',opts.script)
  var result = {}
  opts = opts || {}
  //console.log('parseStart',opts)
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
  if (path.existsSync(_config.apps+'/'+maybeApp)) {
    //console.log('---- A')
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
    if (path.existsSync(_config.apps+'/'+opts.script)) {
      result.name = opts.script.split('/')[0]
      result.script = _config.apps+'/'+opts.script
    }
  }

  // handle `nexus start appName`
  if (!result.script) {
    if (result.package
        && result.package.scripts
        && result.package.scripts.start) {
      //console.log('---- AA')
      var startScript = result.package.scripts.start
      if (/\w/.test(startScript)) {
        //console.log('---- AAA')
        var split = startScript.split(' ')
        var isScript = path.existsSync(appPath+'/'+split[0])
        if (isScript) {
          //console.log('---- AAAA')
          result.script = appPath+'/'+split[0]
          result.options = result.options || split.splice(1)
        }
        else {
          //console.log('---- AAAB')
          result.command = split[0]
          result.script = appPath+'/'+split[1]
          result.options = result.options || split.splice(2)
        }
      }
      else {
        //console.log('---- AAB')
        result.script = appPath+'/'+startScript
      }
    }
    else if (appPath) {
      //console.log('---- AB')
      var serverJsExists = path.existsSync(appPath+'/server.js')
      var appJsExists = path.existsSync(appPath+'/app.js')
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

//------------------------------------------------------------------------------
//                                               objPath
//------------------------------------------------------------------------------

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

//------------------------------------------------------------------------------
//                                               genId
//------------------------------------------------------------------------------

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

