exports = module.exports = function(opts){
  var n = new Nexus(opts)
  return n
}

exports.Nexus = Nexus
exports.config = config
exports.objPath = objPath
exports.objFilter = objFilter
exports.genId = genId
exports.readTlsKeys = readTlsKeys
exports.readNexus = readNexus
exports.readPackage = readPackage
exports.readGit = readGit
exports.monStatus = monStatus
exports.monRestart = monRestart
exports.monStop = monStop

var fs      = require('fs')
  , path    = require('path')
  , cp      = require('child_process')
  , util    = require('util')
  , opti    = require('optimist')
  , dnode   = require('dnode')
  , _       = require('underscore')
  , net     = require('net')
  , tls     = require('tls')
  , rimraf  = require('rimraf')
  , dirty   = require('dirty')
  , mkdirp  = require('mkdirp')
  , pstree  = require('ps-tree')
  , async   = require('async')
  , EE2     = require('eventemitter2').EventEmitter2
  , crypto  = require('crypto')
  , debug   = require('debug')('nexus')
  , _config, _configStringified

// node@0.6.x compat
fs.exists = fs.exists || path.exists
fs.existsSync = fs.existsSync || path.existsSync

/**
 * @param {Object} options
 */
function Nexus(opts) {
  var self = this
  EE2.call(self,{wildcard:true,delimiter:'::',maxListeners:20})
  try { self.package = require('./package.json') } catch(e) {}
  self.servers = {}
  self.monitors = {}
  _config = self._config = config(opts)
  _configStringified = JSON.stringify(_config)
  self.initDb()
  return self
}

var N = Nexus.prototype = new EE2

/**
 * @param {Function} cb with 2 args: err, version
 */
N.config = function config(cb) {
  cb(null, this._config)
}

/**
 * install an application
 *
 *     install({url:<path or uri>,ref:<gitref>,name:<some name>},cb)
 *
 * @param {Object} options
 * @param {Function} cb with 2 args: err, result
 */
N.install = function install(opts, cb) {
  opts = opts || {}
  cb = arguments[arguments.length-1]
  cb = _.isFunction(cb) ? cb : function() {}

  var self = this
  opts.type = opts.type || 'git'
    
  if (opts.type == 'git') {
    if (!opts.url && !_.isString(opts.url))
      return cb(new Error('invalid options, no git-url defined'))
    var url = opts.url
    var ref = opts.ref || url.split('#').slice(1)
    var urlSplit = url.split('/')
    var name = opts.name || urlSplit[urlSplit.length-1].replace(/#.*$/,'')
    var dir = path.join(self._config.apps, name)
    var cacheHash = crypto.createHash("sha1").update(url).digest("hex")
    var cachePath = path.join(self._config.cache, cacheHash)
      
    async.series([checkDir, checkCache], function(err){
       if (err) return cb(err)
       var todo =
        [ exec('git fetch', cachePath)
        , exec('git clone '+cachePath+' '+dir, self._config.apps)
        , exec('git checkout '+ref, dir)
        , exec('git remote rm origin', dir)
        , exec('git remote add origin '+url, dir)
        , checkNexus
        ]
      async.series(todo, function(err, data){
        if (err) return cb(err)
        self.ls({name:name}, function(err,data){
          if (err) return cb(err)
          cb(null,data[0])
        })
      })
    })

    function exec(cmd, cwd) {
      return function(next) {
        cp.exec(cmd, {cwd:cwd,timeout:self._config.execTimeout}, next)
      }
    }

    function checkDir(next) {
      var origName = name
      var i = 0
      ;(function check() {
        fs.exists(dir, function(exists){
          if (!exists) return next()
          name = origName+'_'+(++i)
          dir = path.join(self._config.apps, name)
          check()
        })
      })()
    }

    function checkCache(next) {
      fs.exists(cachePath, function(exists){
        if (exists) return exec('git fetch', cachePath)(next)
        exec( 'git clone --mirror '+url+' '+cachePath
            , self._config.cache
            )(next)
      })
    }
    
    function checkNexus(next) {
      readNexus(dir, function(err, data) {
        if (err || !data.install) return next()
        exec(data.install, dir)(next)
      })
    }
    
    return
  }
  cb(new Error('invalid options, unknown type'))
}

/**
 * uninstall an app
 *
 * @param {String} app-name
 * @param {Function} cb with 2 args: err, result
 */
N.uninstall = function uninstall(name, cb) {
  cb = arguments[arguments.length-1]
  cb = _.isFunction(cb) ? cb : function() {}
  if (!name || !_.isString(name))
    return cb(new Error('invalid options, invalid name: '+name))
  var self = this
  var rmPath = path.join(self._config.apps, name)
  fs.exists(rmPath, function(e){
    if (!e) return cb(new Error('cant uninstall '+path+' it doesnt exist'))
    self.ps({name:name,pid:true,command:true},function(err,data){
      if (err) return cb(err)
      if (data.length > 0)
        return cb(new Error( 'cant uninstall '+name
                           + ' there are running processes: '
                           + JSON.stringify(data)
                           ) )
      self.ls({name:name},function(err,data){
        if (err) return cb(err)
        rimraf(rmPath, function(err){
          if (err) return cb(err)
          self.emit('server::uninstall',name)
          cb(err, data[0])
        })
      })
    })
  })
}

/**
 * list installed apps
 *
 *     ls({'package.name':'foo'},cb)
 *
 * @param {Object} filter (optional)
 * @param {Function} cb with 2 args: err, result (array)
 */
N.ls = function ls(filter, cb) {
  var self = this
  cb = arguments[arguments.length-1]
  cb = _.isFunction(cb) ? cb : function() {}

  if ( arguments.length < 2
       || !_.isObject(filter)
       || Object.keys(filter).length==0)
    filter = null

  fs.readdir(self._config.apps, function(err, dirs){
    if (err) return cb(err)
    async.map(dirs, function(x, next){
      var app = {}
      app.name = x
      var appPath = path.join(self._config.apps,x)
      var pkgPath = path.join(appPath, 'package.json')
      var gitPath = path.join(appPath, '.git')

      async.series([checkPackage, checkGit, checkNexus], function(err, data){
        if (err) return cb(err)
        next(err, app)
      })

      function checkPackage(next){
        readPackage(appPath,function(err,data){
          if (err) return next() // ignore
          app.package = data
          next()
        })
      }

      function checkGit(next){
        readGit(appPath,function(err,data){
          if (err) return next() // ignore
          app.git = data
          next()
        })
      }
      
      function checkNexus(next){
        readNexus(appPath,function(err,data){
          if (err) return next()
          app.nexus = data
          next()
        })
      }
    }, function(err, d){
      var result = []
      _.each(d,function(data){
        if (!filter)
          return result.push(data)
        filter.name = filter.name || true
        var filteredData = objFilter(filter, data)
        if (filteredData) result.push(filteredData)
      })
      cb(null, result)
    })
  })
}

/**
 * get information about running apps
 *
 * filter all apps with name "foo" and also show the id:
 *
 *     ps( { name : 'foo', id : true, env: true }, cb )
 *
 * @param {Object} filter
 * @param {Function} cb with 2 args: err, an array containing infos about apps
 */
N.ps = function ps(filter, cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.ps.apply(this,args)})
  
  var self = this

  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}

  if ( arguments.length < 2
       || !_.isObject(filter)
       || !Object.keys(filter).length )
    filter = null

  var monPath = path.join(__dirname,'bin','mon')
  var result = []
  var mons = []
  self.db.forEach(function(key,val){
    if (!val) return  
    mons.push(val)
  })
  async.map(mons,function(mon,next){
    monStatus(mon.id,function(err,data){
      if (err) return cb(err)
      mon.status = data.status
      if (data.monStatus == 'dead' && data.status == 'dead')
        mon.status = 'ghost'
      mon.pid = data.pid
      mon.monPid = data.monPid
      mon.uptime = data.uptime
      delete mon.env.NEXUS_CONFIG
      delete mon.env.NEXUS_ID
      if (!filter) {
        result.push(mon)
        return next()
      }
      filter.id = filter.id || true
      var filtered = objFilter(filter, mon)
      if (filtered) result.push(filtered)
      next()
    })
  },function(){cb(null,result)})
}

/**
 * start an application
 *
 *     start({name:'someInstalledApp',env:{},command:'node foo'},cb)
 *
 * @param {Object} options
 * @param {Function} cb with 2 args: err, result
 */
N.start = function start(opts, cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.start.apply(self,args)})
  
  opts = _.isObject(opts) ? opts : {}
  cb = arguments[arguments.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}

  if (!opts.name || !_.isString(opts.name))
    return cb(new Error('invalid options, no name defined'))
  
  opts.cwd = opts.cwd || path.join(self._config.apps, opts.name)
  
  fs.exists(opts.cwd, function(e){
    if (!e)
      return cb(new Error('invalid options, the cwd doesnt exist: '+opts.cwd))
    
    if (!opts.id) {
      var ids = []
      self.db.forEach(function(k){ids.push(k)})
      opts.id = genId(10)
      while (!!~ids.indexOf(opts.id)) opts.id = genId()
    }
    
    var monitor = {}
    monitor.id = opts.id
    monitor.name = opts.name || 'UNNAMED'
    monitor.cwd = opts.cwd
    monitor.crashed = 0
    monitor.env = opts.env || {}
    monitor.env.NEXUS_ID = opts.id
    if (opts.NEXUS_SERVER) monitor.NEXUS_SERVER = true
      
    readNexus(opts.cwd,function(err,data){
      if (opts.command)
        monitor.command = opts.command
      else if (!err && data.start)
        monitor.command = data.start
      
      if (!err) monitor.nexus = data
      
      if (!monitor.command) 
        return cb(new Error('invalid options, no command defined'))
      
      var monPath = path.join(__dirname,'bin','mon')
      var pidPath = path.join(self._config.pids,monitor.id+'.pid')
      var monPidPath = path.join(self._config.pids,monitor.id+'.mon.pid')
      var monErrorPath = path.join(__dirname,'bin','mon-error.js')
      var logPath = path.join(self._config.logs,monitor.name+'_'+monitor.id+'.log')
      var spawnOpts = {cwd:monitor.cwd,env:process.env}
      Object.keys(monitor.env).forEach(function(x){
        spawnOpts.env[x] = monitor.env[x] 
        spawnOpts.env.NEXUS_CONFIG = _configStringified
      })
      var child = cp.spawn
        ( monPath
        , [ '-d', monitor.command
          , '-p', pidPath
          , '-m', monPidPath
          , '-l', logPath 
          , '-e', monErrorPath ]
        , spawnOpts )
      child.on('exit',function(code){
        if (code !== 0) 
          return cb(new Error( 'could not start the monitor: '
                             + JSON.stringify(monitor))) 
        self.db.set(monitor.id,monitor)
        self.ps({id:monitor.id},function(err,data){
          if (err) return cb(err)
          cb(null,data[0])
        })
      })
    })
  })
}

/**
 * @param {String} id of app
 * @param {Function} cb with 2 args: err, result
 */
N.restart = function restart(id, cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.restart.apply(self,args)})
  id = _.isString(id) ? id : null
  cb = arguments[arguments.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}
  if (!id) return cb(new Error('invalid options, missing id'))
  monStatus(id,function(err,data){
    if (err) return cb(err)
    var oldPid = data.pid
    monRestart(id,function(err){
      if (err) return cb(err)
      ;(function check(){
        // check if pid changed.. so we know the new process is up
        setTimeout(function(){
          monStatus(id,function(err,res){
            var dat = self.db.get(id)
            dat.crashed = 0
            self.db.set(id,dat)
            if (res.pid == oldPid) return check()
            self.ps({id:id},function(err,res){cb(null,res[0])})
          })
        },500)
      })()
    })
  })
}

/**
 * @param {Function} cb with 2 args: err, result
 */
N.restartall = function restarall(cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.restartall.apply(self,args)})
  cb = arguments[arguments.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}
  var self = this
  var ids = []
  self.db.forEach(function(k,v){
    if (v) ids.push(k)
  })
  async.map(ids,function(id,next){
    self.restart(id,next)
  }, cb)
}

/**
 * @param {Function} cb with 2 args: err, result
 */
N.reboot = function reboot(cb) {
  cb = arguments[arguments.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}
  var self = this
  self.ps(function(err,data){
    if (err) return cb(err)
    var result = []
    async.map(data,function(x,next){
      if (x.status != 'ghost') return next()
      var opts = {}
      opts.id = x.id
      opts.command = x.command
      opts.cwd = x.cwd
      opts.name = x.name
      self.start(opts, function(err,data){
        result.push(data)
        next()
      })
    },function(){cb(null,result)})
  })
}

/**
 * @param {String} id of app
 * @param {Function} cb with 2 args: err, result
 */
N.stop = function stop(id, cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.stop.apply(self,args)})
  id = _.isString(id) ? id : null
  cb = args[args.length - 1]
  cb = _.isFunction(cb) ? cb : function(){}
  if (!id) return cb(new Error('invalid options, missing id'))
  self.ps({id:id},function(err,old){
    if (err) return cb(err)
    if (old[0].status == 'ghost') {
      self.db.rm(id)
      return cb(null,old)
    }
    monStop(id,function(err){
      if (err) return cb(err)
      self.db.rm(id)
      cb(null,old[0])
    })
  })
  // monStatus(id,function(err,data){
  //   if (err) return cb(err)
  //   if (data.monStatus == 'dead') {
  //     var old = self.db.get(id)
  //     self.db.rm(id)
  //     return cb(null,old)
  //   }
  //   monStop(id,function(err){
  //     if (err) return cb(err)
  //     var old = self.db.get(id)
  //     self.db.rm(id)
  //     cb(null,old)
  //   })
  // })
}

/**
 * @param {Function} cb with 2 args: err, result
 */
N.stopall = function stopall(cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.stopall.apply(self,args)})
  var toStop = []
  self.db.forEach(function(k,v){
    if (v && !v.env.NEXUS_SERVER) toStop.push(k)
  })
  async.map(toStop,function(id,next){self.stop(id,next)},cb)
}

/**
 * @param {Object} options
 * @param {Function} cb with 2 args: err, result
 */
N.log = function log(opts, cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.log.apply(self,args)})
  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}
  
  opts = opts || {}

  if (!opts.id) return cb(new Error('invalid options, no id'))
  var mon = self.db.get(opts.id)
  var logPath = path.join(_config.logs,mon.name+'_'+opts.id+'.log')
  opts.command = 'tail '+logPath
  if (opts.follow) opts.command += ' -f'
  self.exec(opts, cb)
}

/**
 * @param {Object} options
 * @param {Function} cb with 2 args: err, result
 */
N.exec = function exec(opts, cb) {
  var self = this
  opts = opts || {}
  cb = _.isFunction(arguments[arguments.length-1])
       ? arguments[arguments.length-1]
       : function() {}

  if (!opts.command)
    return cb(new Error('invalid arguments, missing command'))

  if (_.isArray(opts.command))
    opts.command = opts.command.join(' ')

  if (!_.isString(opts.command))
    return cb(new Error('invalid arguments, invalid command (must be array or string)'))

  ;['kill','killService','stdout','stderr'].forEach(function(x){
    opts[x] = opts[x] && _.isFunction(opts[x]) ? opts[x] : function(){}
  })

  
  var sh = (process.platform === "win32") ? 'cmd' : 'sh'
  var shFlag = (process.platform === "win32") ? '/c' : '-c'
  var cwd = opts.name ? path.join(self._config.apps,opts.name) : self._config.apps
  fs.exists(cwd,function(exists){
    if (!exists)
      return cb(new Error('invalid arguments, cwd does not exist: '+cwd))
    var child = cp.spawn(sh, [shFlag, opts.command], {cwd:cwd})
    opts.kill(kill)
    opts.killService(kill)
    setTimeout(kill, self._config.execTimeout)
    child.stdout.on('data',function(d){
      opts.stdout(d.toString().replace(/\n$/, ''))
    })
    child.stderr.on('data',function(d){
      opts.stderr(d.toString().replace(/\n$/, ''))
    })
    child.once('close',cb)
    child.on('error',function(e){console.log('exec cp-error',opts,e)})
    function kill(cb) {
      pstree(child.pid, function(err, children){
        var tokill = []
        children.map(function(p){tokill.push(p.PID)})
        tokill.unshift(child.pid)
        cp.exec('kill -9 '+tokill.join(' '),cb)
      })
    }
  })
}

/**
 * @param {Function} cb
 */
N.initDb = function initDb(cb) {
  cb = _.isFunction(cb) ? cb : function() {}
  var self = this
  if (!self._config.db) 
    return cb(new Error('invalid config, no database-path defined'))
  self.db = dirty(self._config.db).on('load',function(){
    self._dbLoaded = true
    self.emit('db::load')
    cb()
  })
}

/**
 * @param {Function} end, 1 param: function to destroy the api (subscribtions)
 * @return {Object} api
 */
N.createService = function createService() {
  var self = this
  return function(remote, conn){
    var service = this
    ;[ 'install', 'uninstall', 'ls', 'ps', 'start', 'restart', 'restartall'
     , 'reboot', 'server', 'stop', 'stopall', 'config'
     ].forEach(function(x){ service[x] = Nexus.prototype[x].bind(self) })
    service.exec = function(opts, cb){
      opts.killService = function(killIt){
        conn.once('end',function(){killIt()})
      }
      self.exec(opts,cb)
    }
    service.log = function(opts, cb){
      opts.killService = function(killIt){
        conn.once('end',function(){killIt()})
      }
      self.log(opts,cb)
    }
  }
}

/**
 * connect to a remote nexus-server
 */
N.connect = function connect(opts,cb) {

  var self = this
  cb = arguments[arguments.length-1]
  cb = _.isFunction(cb) ? cb : function(){}
  opts = opts || {}
  opts.port = opts.port || self._config.port
  opts.key = opts.key || self._config.key
  opts.cert = opts.cert || self._config.cert
  opts.socket = opts.socket || self._config.socket
  opts.reconnect = opts.reconnect || null
  
  if (opts.remote && self._config.remotes[opts.remote]) {
    Object.keys(self._config.remotes[opts.remote]).forEach(function(x){
      opts[x] = self._config.remotes[opts.remote][x]
    })
  }

  function connect() {
    var client
    if (!opts.socket && opts.port && opts.key) {
      var tlsOpts = readTlsKeys(opts)
      client = tls.connect(opts.port, opts.host, tlsOpts)
    } else {
      client = net.connect(opts.port, opts.host)
    }
    client.on('error',onError)
    var d = dnode()
    d.on('remote',cb)
    d.on('error',onError)
    d.on('fail',onError)
    d.pipe(client).pipe(d)
    return client
  }
  function onError(err) {
    if (!opts.reconnect && err) return
    setTimeout(connect,opts.reconnect)
  }
  
  return connect()
}

/**
 * start the nexus-server
 */
N.listen = function listen(opts, cb) {
  cb = arguments[arguments.length-1]
  cb = _.isFunction(cb) ? cb : function(){}
  opts = _.isObject(opts) ? opts : {}

  var self = this
  var servers = {}
  var cfg = self._config
  _.each(opts,function(x,i){cfg[i] = x !== undefined ? x : cfg[i]})

  var todo = []
  if (cfg.socket) todo.push(listenUnix)
  if (cfg.key && cfg.port) todo.push(listenTls)
  else if (cfg.port) todo.push(listenNet)

  // console.log(cfg, todo)
  
  async.parallel(todo,function(err){
    if (err) return cb(err)
    cb(null, self.servers)
  })

  function listenUnix(cb) {
    checkSocket(cfg.socket, function(err){
      if (err) return cb(err)
      var name = 'unix://'+cfg.socket
      debug('starting unix-server', name)
      self.servers[name] = net.createServer(handler).listen(cfg.socket, cb)
    })
    function checkSocket(path, cb) {
      fs.exists(path,function(exists){
        if (!exists) return cb()
        fs.unlink(path,cb)
      })
    }
  }

  function listenNet(cb) {
    var name = 'net://'+cfg.host+':'+cfg.port
    debug('starting net-server', name)
    self.servers[name] = net.createServer(handler)
    self.servers[name].listen(cfg.port, cfg.host, cb)
  }

  function listenTls(cb) {
    var name = 'tls://'+cfg.host+':'+cfg.port
    debug('starting tls-server', name, cfg)
    var tlsOpts = readTlsKeys(cfg)
    self.servers[name] = tls.createServer(tlsOpts,handler)
    self.servers[name].listen(cfg.port, cfg.host, cb)
  }

  function handler(s){
    var d = dnode(self.createService())
    s.pipe(d).pipe(s)
    s.on('error',function(){s.destroy()})
  }
}

/**
 * control the nexus-server
 *
 *     server( { command: ..
 *             , options: ..
 *             } )
 *
 * @param {Object} options - possible keys: command, options; command can be
 *                 'restart', 'start', 'stop' or 'info'; every command
 * @param {Function} callback
 */
N.server = function server(opts, cb) {
  var self = this
  var args = arguments
  if (!this._dbLoaded) 
    return this.once('db::load',function(){N.server.apply(self,args)})
  
  opts = _.isObject(opts) ? opts : {}
  cb = arguments[arguments.length-1]
  cb = _.isFunction(cb) ? cb : function(){}
  if (!opts.command) {
    self.ps(function(err,data){
      if (err) return cb(err)
      var result = []
      data.forEach(function(x){
        if (x.env && x.env.NEXUS_SERVER) result.push(x)
      })
      cb(null,result)
    })
  }
  else if (opts.command == 'start') {
    var startOpts = {}
    startOpts.cwd = path.join(__dirname,'bin')
    startOpts.command = 'node server.js'
    startOpts.name = 'NEXUS_SERVER'
    startOpts.env = {NEXUS_SERVER:true}
    
    if (opts.port) startOpts.command += ' -p '+opts.port
    if (opts.key)  startOpts.command += ' --key '+opts.key
    if (opts.cert) startOpts.command += ' --cert '+opts.cert
    if (opts.ca)   startOpts.command += ' --ca '+opts.ca

    if (opts.config)
      startOpts.command += ' -c '+opts.config
    else if (_config.configFile)
      startOpts.command += ' -c '+_config.configFile
    else
      startOpts.env.NEXUS_CONFIG = JSON.stringify(_config)
    
    self.start(startOpts,cb)
  }
}

/**
 * filter object-properties
 * 
 * @param {Object} filter
 * @param {Object} data
 * @return {Object|false} filtered data or false
 */
function objFilter(filter, data) {
  var result = {}
  var all = true

  _.each(filter,function(y,j){
    if (!result) return
    if (_.isBoolean(y)) {
      all = false
      var info = objPath(data,j)
      if (info !== undefined) result[j] = info
      else result[j] = 'UNDEFINED'
    }
    else {
      y = y.toString()
      var info = objPath(data,j)
      if (info != y) result = false
      else result[j] = info
    }
  })

  if (result && all) return data
  return result
}

/**
 * create/access objects with a key-string
 *
 * @param {Object} scope
 * @param {String} key-string (e.g. 'a.b.c.d')
 * @param {Mixed} value to store in key (optional)
 * @return {Mixed} if value-param is given it will return the object,
 *                 otherwise it will return the value of the selected key,
 *                 undefined values will get false..
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
  }
  else { // set data
    var temp = data
    if (keys.length==0) {
      obj[keyString] = value
      return obj
    }

    for (var i=0, len=keys.length; i<len; i++) {
      if (i==(len-1)) {
        temp[keys[i]] = value
      }
      else {
        temp[keys[i]] = temp[keys[i]] || {}
        temp = temp[keys[i]]
      }
    }
    return data
  }
}

/**
 * @param {Integer} length
 * @return {String} random id with requested length
 */
function genId(len) {
  len = len ? parseInt(len) : 8
  var ret = ''
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWYXZabcdefghijklmnopqrstuvwyxz0123456789'
  while (len--)
    ret += chars[Math.round(Math.random() * (chars.length-1))]
  return ret
}

/**
 * initialize config (synchron - it throws when something goes wrong)
 *
 * @param {Object} options
 * @return {Object} config
 */
function config(opts) {
  var cfg = {}
    , cfgFile = {}
    , home = ( process.platform === "win32"
             ? process.env.USERPROFILE
             : process.env.HOME )
    , cfgPath = path.join(home,'.nexus','config.js')

  if (!opts || opts && _.isString(opts)) {
    if (opts) cfgPath = opts
    cfg.configFile = cfgPath
    try { cfgFile = require(cfgPath) }
    catch (e) {
      delete cfg.configFile 
    }
  }
  else if (opts && _.isObject(opts)) cfg = opts
    
  cfg.prefix  = cfg.prefix  || cfgFile.prefix  || path.dirname(cfgPath)
  cfg.apps    = cfg.apps    || cfgFile.apps    || path.join(cfg.prefix,'apps')
  cfg.cache   = cfg.cache   || cfgFile.cache   || path.join(cfg.prefix,'cache')
  cfg.db      = cfg.db      || cfgFile.db      || path.join(cfg.prefix,'nexus.db')
  cfg.logs    = cfg.logs    || cfgFile.logs    || path.join(cfg.prefix,'logs')
  cfg.pids    = cfg.pids    || cfgFile.pids    || path.join(cfg.prefix,'pids')
  cfg.remotes = cfg.remotes || cfgFile.remotes || {}
  cfg.sleep   = cfg.sleep   || cfgFile.sleep   || 1
  cfg.execTimeout = cfg.execTimeout || cfgFile.execTimeout || 1000*60*30
  
  // client
  cfg.key     = cfg.key     || cfgFile.key     || null
  cfg.cert    = cfg.cert    || cfgFile.cert    || null

  // server
  cfg.ca      = cfg.ca      || cfgFile.ca      || null
  cfg.host    = cfg.host    || cfgFile.host    || '0.0.0.0'
  cfg.port    = cfg.port    || cfgFile.port    || 0xf00
  cfg.socket  = cfg.socket  || cfgFile.socket  || null

  var ensureDirs = [cfg.apps, cfg.cache, path.dirname(cfg.db), cfg.logs, cfg.pids]
  if (cfg.ca) ensureDirs.push(cfg.ca)

  ensureDirs.forEach(function(x){
    if (!fs.existsSync(x)) mkdirp.sync(x, 0755)
  })

  // console.log(cfg)
  return cfg
}

/**
 *     var tlsOpts = readTlsKeys
 *       ( { key  : '/path/to/key.pem'   // key-file
 *         , cert : '/path/to/cert.pem'  // cert-file
 *         , ca   : '/path/to/ca-dir'    // every file in that dir will be read
 *                                       // into the ca
 *         } )
 */
function readTlsKeys(opts) {
  opts = opts || {}
  var result = {}
  if (opts.key)
    result.key = fs.readFileSync(opts.key)
  if (opts.cert)
    result.cert = fs.readFileSync(opts.cert)
  if (opts.ca) {
    result.ca = []
    fs.readdirSync(opts.ca).forEach(function(x){
      result.ca.push(fs.readFileSync(path.join(opts.ca,x)))
    })
  }
  return result
}

function readNexus(appPath, cb) {
  var filePath = path.join(appPath,'nexus.json')
  fs.readFile(filePath,function(err,data){
    if (err) return cb(err)
    var data
    try { data = JSON.parse(data) }
    catch(e) { err = e }
    if (err) return cb(err)
    cb(null, data)
  })
}

function readPackage(appPath, cb){
  var filePath = path.join(appPath,'package.json')
  fs.readFile(filePath,function(err,data){
    if (err) return cb(err)
    var data
    try { data = JSON.parse(data) }
    catch(e) { err = e }
    if (err) return cb(err)
    cb(null, data)
  })
}

function readGit(appPath, cb){
  var result = {}
  var getCommit = 'git log --no-color | head -n1'
  var getRemote = 'git remote show origin | head -n2'
  cp.exec(getCommit, {cwd:appPath}, function(err, stdout, stderr){
    if (err || stderr) return cb(err || stderr)
    result.commit = stdout.trim().split(/\s+/)[1]
    cp.exec(getRemote, {cwd:appPath}, function(err, stdout, stderr){
      if (err || stderr) return cb(err || stderr)
      result.remote = stdout.split('\n')[1].split(/\s+/)[3]
      cb(null, result)
    })
  })
}

function monStatus(id, cb) {
  var monPath = path.join(__dirname,'bin','mon')
  var pidPath = path.join(_config.pids,id+'.pid')
  var monPidPath = path.join(_config.pids,id+'.mon.pid')
  var result = {}
  result.pidPath = pidPath
  result.monPidPath = monPidPath
  cp.exec(monPath+' -p '+monPidPath+' -S',function(err,stdout,stderr){
    if (err) return cb(err)
    var split = stdout.split(':')
    result.monPid = split[0]
    result.monStatus = split[1]
    result.monUptime = split[2] || 0
    cp.exec(monPath+' -p '+pidPath+' -S',function(err,stdout,stderr){
      if (err) return cb(err)
      var split = stdout.split(':')
      result.pid = split[0]
      result.status = split[1]
      result.uptime = split[2] || 0
      cb(null,result)
    })
  })
}

function monRestart(id, cb) {
  var pidPath = path.join(_config.pids,id+'.pid')
  cp.exec('kill -3 $(cat '+pidPath+')',cb)
}

function monStop(id, cb) {
  var pidPath = path.join(_config.pids,id+'.pid')
  var monPidPath = path.join(_config.pids,id+'.mon.pid')
  cp.exec('kill -3 $(cat '+monPidPath+')',function(err){
    if (err) return cb(err)
    fs.unlink(pidPath,function(err){
      if (err) return cb(err)
      fs.unlink(monPidPath,cb)
    })
  })
}

