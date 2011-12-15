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
nexus.scripts = scripts
nexus.logs = logs
nexus.server = server

var fs      = require('fs')
  , path    = require('path')
  , fork    = require('child_process').fork
  , spawn   = require('child_process').spawn
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
  , procs   = {}
  , serverProc = null
  , subscriptions = {}
  , subscriptionListeners = {}
  , userConfig = null

process.title = 'nexus'

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
    this.scripts   = scripts
    this.logs      = logs
    this.cleanlogs = cleanlogs
    this.remote    = remote
    this.server    = server
    this.subscribe = function(event, emit, cb) {
      if (event == '*' || event == 'all') event = '*::*::*'
      if (!subscriptions[event]) {
        subscriptions[event] = {}
        subscriptionListeners[event] = function(data){
          var self = this
          _.each(subscriptions[event],function(x,i){
            x(self.event,data)
          })
        }
        ee2.on(event,subscriptionListeners[event])
      }
      subscriptions[event][conn.id] = emit
      cb && cb()
    }
    this.unsubscribe = function(cb) {
      _.each(subscriptions,function(x,i){
        delete x[currId]
        if (Object.keys(x).length == 0) {
          ee2.removeListener(subscriptionListeners[i])
          delete subscriptionListeners[i]
        }
      })
      cb && cb()
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
        serverProc = rem
        rem.subscribe(function(event,data){
          ee2.emit('server::'+rem.id+'::'+event,data)
        })
        conn.on('end',function(){
          ee2.emit('server::'+rem.id+'::disconnected')
          serverProc = null
        })
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
  dnodeInterface.scripts = scripts
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
  currConfig.tmp     = currConfig.tmp     || fileConfig.tmp     || currConfig.prefix+'/tmp'
  currConfig.apps    = currConfig.apps    || fileConfig.apps    || currConfig.prefix+'/apps'
  currConfig.ca      = currConfig.ca      || fileConfig.ca      || currConfig.prefix+'/ca'
  currConfig.logs    = currConfig.logs    || fileConfig.logs    || currConfig.prefix+'/logs'
  currConfig.host    = currConfig.host    || fileConfig.host    || '0.0.0.0'
  currConfig.port    = currConfig.port    || fileConfig.port    || 0xf00
  currConfig.remotes = currConfig.remotes || fileConfig.remotes || {}

  new AA( [ currConfig.ca
          , currConfig.logs
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
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function() {}

  opts = opts || {}
  if (!opts.package) return cb('no package given to install')

  var _config = config()

  if (!(/:\/\//.test(opts.package)))
    return installPackage()
  // this code sucks in general ..
  // but ye .. without this, npm will throw on non-valid domains
  // install via authed http? not implemented yet :D
  // (on the cli ssh-agent might help with ssh-transport)
  var dns = require('dns')
  var domain = opts.package.split('://')[1]
  domain = domain.split('/')[0]
  domain = domain.split(':')[0]
  var split = domain.split('@')
  domain = split[split.length - 1]
  dns.lookup(domain,function(err,data,fam){
    if (err && domain!='localhost')
      return cb(err)
    rimraf(_config.tmp+'/node_modules',function(err){
      installPackage()
    })
  })

  function installPackage() {
    npm.load({loglevel:'silent',exit:false}, function(err){
      if (err) return cb(err)
      npm.commands.install(_config.tmp, opts.package, function(err, res) {
        if (err) return cb(err)
        var name = opts.name || res[res.length-1][0]
        var tmpPath = res[res.length-1][1]
        if (path.existsSync(_config.apps+'/'+name)) {
          var found = false, i = 0
          while (!found) {
            if (!path.existsSync(_config.apps+'/'+name+'_'+(++i)))
              found = true
          }
          name = name+'_'+i
        }
        ncp.ncp(tmpPath,_config.apps+'/'+name,function(err){
          if (err) return cb(err)
          rimraf(_config.tmp+'/node_modules',function(err){
            if (serverProc)
              ee2.emit('server::'+serverProc.id+'::installed',name)
            cb(err, name)
          })
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

function ls(package, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]

  var _config = config()
  if (arguments[0] && typeof arguments[0] === 'string') {
    package = arguments[0]
    path.exists(_config.apps+'/'+package+'/package.json',function(exists){
      if (!exists) return cb('package is not installed: '+package)
      var pkg
      try {
        pkg = require(_config.apps+'/'+package+'/package.json')
      } catch(e) { return cb(e) }
      cb(null, pkg)
    })
  }
  else {
    fs.readdir(_config.apps,function(err,data){
      if (err) return cb(err)
      var result = {}
      new AA(data).map(function(x,i,next){
        try {
          var pkg = require(_config.apps+'/'+x+'/package.json')
          result[x] = pkg
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

function ps(proc, cb) {
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  if (typeof arguments[0] === 'string' && procs[arguments[0]] && cb)
    return procs[arguments[0]].info(cb)

  var result = {}

  if (Object.keys(procs).length == 0)
    return cb(null,result)

  new AA(Object.keys(procs)).map(function(x,i,next){
    procs[x].info(function(err,data){
      result[x] = data
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
  if (typeof arguments[arguments.length - 1] === 'function')
    cb = arguments[arguments.length - 1]
  else
    cb = function(){}

  if (arguments.length != 2)
    return cb('start needs 2 arguments')

  parseStart(opts, function(err, data){
    if (err) return cb(err)

    var child = fork( __dirname+'/bin/monitor.js'
                    , []
                    , {env:process.env} )

    child.on('message',function(m){
      cb(m.error, m.data)
    })
    child.send({start:data,config:config()})
  })
}

//------------------------------------------------------------------------------
//                                               restart
//------------------------------------------------------------------------------

function restart(id, cb) {
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
  if (!cb) cb = function() {}
  new AA(Object.keys(procs)).map(function(x,i,next){
    procs[x].stop(next)
  }).done(cb).exec()
}

//------------------------------------------------------------------------------
//                                               stopall
//------------------------------------------------------------------------------

function scripts(cb) {
  cb('#TODO')
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
      cb(err, data)
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

  if (opts.cmd && opts.cmd == 'start') {
    if (serverProc) return cb('server is already running')
    var startOptions =
      { script: __dirname+'/bin/server.js'
      , command: 'node'
      , max: 100
      , package: _pkg
      , env: {NEXUS_CONFIG:JSON.stringify(config())}
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

  cb(null,'server is not running')
}

//------------------------------------------------------------------------------
//                                               parseStart
//------------------------------------------------------------------------------

function parseStart(opts, cb) {
  var result = {}
  opts = opts || {}
  //console.log('parseStart',opts)
  if (!opts.script) return cb('no script defined')

  result.script = null
  result.command = opts.command || 'node'
  result.options = opts.options || []
  result.env = opts.env || {}
  result.cwd = opts.cwd || process.cwd()
  result.max = opts.max || 100

  var _config = config()
  var maybeApp = opts.script.split('/')[0]
    , appPath = null
  if (path.existsSync(_config.apps+'/'+maybeApp)) {
    //console.log('---- A')
    appPath = _config.apps+'/'+maybeApp
    try {
      result.package = require(appPath+'/package.json')
    } catch(e) {}
  }

  // handle `nexus start /some/file`
  result.script = /^\//.test(opts.script) ? opts.script : null

  // handle `nexus start appName/path/to/script`
  if (!result.script && /\//.test(opts.script)) {
    if (path.existsSync(_config.apps+'/'+opts.script)) {
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
//                                               error
//------------------------------------------------------------------------------


function error(err,cb) {
  console.log('error:',err)
  if (serverProc)
    ee2.emit('server::'+serverProc.id+'::error',err)
  cb(err)
}

