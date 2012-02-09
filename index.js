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
  , pf      = require('portfinder')
  , ncp     = require('ncp')
  , _pkg    = require('./package.json')
  , debug   = require('debug')('nexus')
  , procs   = {}
  , serverProc = null
  , subscriptions = {}
  , subscriptionListeners = {}
  , userConfig = null

//------------------------------------------------------------------------------
//                                               constructor
//------------------------------------------------------------------------------

function nexus(configParam) {
  userConfig = configParam
  function dnodeInterface(remote, conn) {
    var self = this
      , currId = null
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
      if (!events) return cb(new Error('invalid first argument'))
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
      if (rem.type && rem.type == 'NEXUS_MONITOR') {
        currId = rem.id
        ee2.emit('monitor::'+currId+'::connected')
        procs[currId] = rem
        rem.subscribe(function(event,data){
          ee2.emit('monitor::'+currId+'::'+event,data)
        })
        conn.on('end',function(){
          ee2.emit('monitor::'+currId+'::disconnected')
          delete procs[currId]
        })
      }
      if (rem.type && rem.type == 'NEXUS_SERVER_MONITOR') {
        ee2.emit('server::'+rem.id+'::connected')
        rem.subscribe(function(event,data){
          ee2.emit('server::'+rem.id+'::'+event,data)
        })
        conn.on('end',function(){
          ee2.emit('server::'+rem.id+'::disconnected')
        })
        if (serverProc)
          return rem.stop()

        serverProc = rem
      }
    })
    conn.on('end',function(){self.unsubscribe()})
  }
  dnodeInterface.version = version
  dnodeInterface.config = config
  dnodeInterface.ls = ls
  dnodeInterface.install = install
  dnodeInterface.uninstall = uninstall
  dnodeInterface.start = start
  dnodeInterface.runscript = runscript
  dnodeInterface.logs = logs
  dnodeInterface.server = server
  return dnodeInterface
}

//------------------------------------------------------------------------------
//                                               version
//------------------------------------------------------------------------------

function version(cb) {cb && cb(null, _pkg.version); return _pkg.version}

//------------------------------------------------------------------------------
//                                               config
//------------------------------------------------------------------------------

function config(key, value, cb) {

  // #TODO get/set config

  if (key && value && !cb) cb = value
  if (key && !value && !cb) cb = key

  var currConfig = {}
    , fileConfig = {}
    , home = ( process.platform === "win32" // HAHA!
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
      console.error(new Error(e))
      return cb(new Error(e))
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
          if (serverProc)
            ee2.emit('server::'+serverProc.id+'::installed',name)
          cb(null, name)
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
      if (serverProc)
        ee2.emit('server::'+serverProc.id+'::uninstalled',opts)
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
      if (!exists) return cb('package is not installed: '+opts.name)
      var pkg
      try {
        pkg = JSON.parse(fs.readFileSync(_config.apps+'/'+opts.name+'/package.json','utf-8'))
      } catch(e) { return cb(e) }
      if (!opts.filter || opts.filter.length == 0)
        return cb(null, pkg)
      var result = {}
      _.each(opts.filter, function(x,i){
        var info = objPath(pkg,x)
        if (info !== undefined) result[x] = info
        else result[x] = 'UNDEFINED'
      })
      cb(null,result)
    })
  }
  else {
    fs.readdir(_config.apps,function(err,data){
      if (err) return cb(err)
      var result = {}
      new AA(data).map(function(x,i,next){
        try {
          var pkg = JSON.parse(fs.readFileSync(_config.apps+'/'+x+'/package.json','utf-8'))
          if (!opts.filter || opts.filter.length == 0) {
            result[x] = pkg
          }
          else {
            result[x] = {}
            _.each(opts.filter, function(y,j){
              var info = objPath(pkg,y)
              if (info !== undefined) result[x][y] = info
              else result[x][y] = 'UNDEFINED'
            })
          }
        } catch(e) {
          return next(e)
        }
        next()
      }).done(function(err,data){
        if (err) return error(err,cb)
        cb && cb(err,result)
      }).exec()
    })
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

  if (Object.keys(procs).length == 0)
    return cb(null,result)

  if (opts.id && procs[opts.id]) {
    if (!opts.filter) {
      return procs[opts.id].info(cb)
    }
    procs[opts.id].info(function(err,data){
      _.each(opts.filter, function(x,i){
        var info = objPath(data,x)
        if (info !== undefined) result[x] = info
        else result[x] = 'UNDEFINED'
      })
      cb(err,result)
    })
    return
  }

  new AA(Object.keys(procs)).map(function(x,i,next){
    procs[x].info(function(err,data){
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
    if (err) return error(err,cb)
    cb && cb(err,result)
  }).exec()
}

//------------------------------------------------------------------------------
//                                               start
//------------------------------------------------------------------------------

function start(opts, cb) {
  debug('starting',opts.script)
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  if (arguments.length != 2)
    return cb('start needs 2 arguments')

  parseStart(opts, function(err, data){
    if (err) return cb(err)
    pf.basePort = 33333
    pf.getPort(function(err,port){
      // a tempServer to make starting apps without a
      // running nexus-server possible
      var tempServer = dnode({done:function(err, data){
        cb(err, data)
        tempServer.close()
      }}).listen(port)

      tempServer.on('ready',function(remote, conn){
        debug('starting monitor',data.script)
        var child = cp.execFile( __dirname+'/bin/monitor.js'
                               , [ '-c', JSON.stringify(config())
                                 , '-s', JSON.stringify(data)
                                 , '-P', port ]
                               , {env:process.env} )
        child.stdout.on('data',function(d){
          debug('monitorScript-stdout',d.toString())
        })
        child.stderr.on('data',function(d){
          debug('monitorScript-stderr',d.toString())
        })
      })
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

  if (!id || !procs[id])
    return cb('there is no process with id: '+id)

  procs[id].restart(cb)
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

  if (!id || !procs[id])
    return cb('there is no process with id: '+id)

  procs[id].stop(cb)
}

//------------------------------------------------------------------------------
//                                               stopall
//------------------------------------------------------------------------------

function stopall(cb) {
  debug('stopping all')
  if (!cb) cb = function() {}
  var keys = Object.keys(procs)
  if (keys.length==0) return cb(null,[])
  new AA(Object.keys(procs)).map(function(x,i,next){
    procs[x].stop(next)
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
    return cb('name or script not defined')
  ls({name:opts.name},function(err,data){
    if (err)
      return cb(err)
    if (!data.scripts[opts.script])
      return cb('the app "'+opts.name+'" has no script called "'+opts.script+'"')

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
      if (err) return error(err,cb)
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
    if (err) return error(err,cb)
    var toDel = []
    _.each(data,function(x,i){
      var split = x.split('.')
        , id = split[split.length-3]
      if (!procs[id] && (serverProc.id != id))
        toDel.push(x)
    })
    new AA(toDel).map(function(x,i,next){
      fs.unlink(_config.logs+'/'+x,next)
    }).done(function(err,data){
      if (err) return error(err,cb)
      ee2.emit('server::'+serverProc.id+'::cleanedlogs',data)
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
    return cb('dont know about the remote "'+rem+'"')

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
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  if (arguments.length == 1 && serverProc)
    serverProc.info(cb)

  opts = opts || {}

  if (opts.cmd && opts.cmd == 'version') {
    if (!serverProc) return cb('server is not running')
    serverProc.info(function(err,data){
      cb(err,data.package.version)
    })
    return
  }

  if (opts.cmd && opts.cmd == 'start') {
    if (serverProc) return cb('server is already running')
    var startOptions =
      { script: __dirname+'/bin/server.js'
      , command: 'node'
      // , max: 100
      , package: _pkg
      , env:
        { NEXUS_CONFIG : JSON.stringify(config())
        , NODE_DEBUG : !!opts.debug
        }
      }

    return start(startOptions, cb)
  }

  if (opts.cmd && opts.cmd == 'stop') {
    if (serverProc) {
      cb(null,'will try to stop the server, check with `nexus server`')
      return serverProc.stop(cb)
    }
    else return cb('cant stop, server is not running')
  }

  if (opts.cmd && opts.cmd == 'restart') {
    cb(null,'will try to restart the server, check with `nexus server`')
    return serverProc.restart(cb)
  }

  if (serverProc)
    return serverProc.info(cb)

  cb('server is not running')
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
//                                               error
//------------------------------------------------------------------------------

function error(err,cb) {
  console.log('error:',err)
  if (serverProc)
    ee2.emit('server::'+serverProc.id+'::error',err)
  cb(err)
}

