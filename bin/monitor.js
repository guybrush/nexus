#!/usr/bin/env node

var nexus = require('../')
  , _config
  , dnode = require('dnode')
  , _ = require('underscore')
  , opti = require('optimist')
  , portfinder = require('portfinder')
  , spawn = require('child_process').spawn
  , fstream = require('fstream')
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})
  , fs = require('fs')
  , subscriptions = {} 
  
if (!process.env.NEXUS_MONITOR) {
  process.env.NEXUS_MONITOR = true
  portfinder.basePort = 33333
  portfinder.getPort(function(err,port){
    var tempServer = dnode({done:function(err, data){
      if (process.send) {
        process.send({error:err, data:data})
      }
      else {
        if (err) console.error(err)
        else console.log(data)
      }
      tempServer.close()
      process.exit(0)
    }}).listen(port)
    tempServer.on('ready',function(remote, conn){
      var child = spawn( 'node'
                       , [ __filename
                         , '-c', opti.argv.c
                         , '-s', opti.argv.s
                         , '-p', port ] 
                       , { env : process.env } )
    })
  })
}                                         
else {
  delete process.env.NEXUS_MONITOR
  _config = JSON.parse(opti.argv.c)
  var startOpts = JSON.parse(opti.argv.s)
  var tempPort = opti.argv.p
  dnode.connect(tempPort, function(remote, conn){
    monitor(startOpts, function(err, data){
      if (err) 
        return remote.done(err)
      var error
      var opts = { port : _config.port
                 , host : _config.host
                 , reconnect : 500 }
      try {                      
        if (_config.key)
          opts.key = fs.readFileSync(_config.key)
        if (_config.cert)
          opts.cert = fs.readFileSync(_config.cert)
      } catch(e) {
        error = e
      }
      if (error)
        return remote.done(error)
      remote.done(null, data.info)
      conn.end()
      var dnodeMonitor = dnode(data.dnodeInterface)
      dnodeMonitor.connect(opts)
      dnodeMonitor.on('error',function(err){
        if (err.code != 'ECONNREFUSED')             
          console.log(err)
      })
    })
  })
}  

ee2.onAny(function(data){
  var self = this
  _.each(subscriptions,function(x,i){
    x(self.event,data)
  })
})

function monitor(opts, cb) {

  var self = this

  self.id = null
  self.crashed = 0
  self.ctime = 0
  self.env = opts.env
  self.name = opts.name
  self.package = opts.package
  self.script = opts.script
  self.options = opts.options
  self.child = null
  self.command = opts.command
  self.max = opts.max
  self.restartFlag = false
  self.stopFlag = false
  self.env = opts.env

  fs.readdir(_config.logs, function(err,data){
    var currIds = []
    _.each(data,function(x,i){
      var split = x.split('.')
      currIds.push(split[split.length-3])
    })
    do {
      self.id = Math.floor(Math.random()*Math.pow(2,32)).toString(16)
    } while(currIds.indexOf(self.id) != -1)

    start(function(){
      function server(remote, conn) {
        if (self.script == __dirname+'/server.js')
          this.type = 'NEXUS_SERVER_MONITOR'
        else
          this.type = 'NEXUS_MONITOR'
        this.info = info
        this.id = self.id
        this.start = start
        this.restart = restart
        this.stop = stop
        this.subscribe = function(emit, cb) {
          subscriptions[conn.id] = emit
          cb && cb()
        }
        this.unsubscribe = function(cb) {
          delete subscriptions[conn.id]
          cb && cb()
        }
      }
      info(function(err,data){
        cb(err,{dnodeInterface:server,info:data})
      })
    })
  })

  function start(cb) {
    var env = process.env
    if (opts.env) {
      for (var x in opts.env)
        env[x] = self.env[x]
    }
    
    var logFile = opts.script
  
    if (logFile == __dirname+'/server.js') {
      logFile = 'nexus_server'
    }
    else if (logFile.slice(0,_config.apps.length) == _config.apps) {
      logFile = logFile.slice(_config.apps.length+1)
    }
    
    logFile = logFile.replace(/[\/\s]/g,'_')+'.'+self.id
    
    self.logFileStdout = _config.logs+'/'+logFile+'.stdout.log'
    self.logFileStderr = _config.logs+'/'+logFile+'.stderr.log'
    
    // use require('npm').runScript()
    self.child = spawn( opts.command
                      , [opts.script].concat(opts.options)
                      , { cwd : opts.cwd
                        , env : env
                        } )

    ee2.emit('start', self.child.pid)

    self.ctime = Date.now()
    var fsStdout = fstream.Writer({path:self.logFileStdout,flags:'a'})
    var fsStderr = fstream.Writer({path:self.logFileStderr,flags:'a'})
    self.child.stdout.pipe(fsStdout)
    self.child.stderr.pipe(fsStderr)

    self.child.stdout.on('data',function(data){
      ee2.emit('stdout', data.toString())
    })
    self.child.stderr.on('data',function(data){
      ee2.emit('stderr', data.toString())
    })
    self.child.once('exit',function(code){
      ee2.emit('exit', code)
      self.child = null
      if ((code != 0) && !self.stopFlag) {
        self.crashed++
        if (self.crashed < self.max) {
          setTimeout(function(){
            start()
          },200)
        }
      }
    })
    cb && info(cb)
  }

  function restart(cb) {
    self.crashed = 0
    self.restartFlag = true
    stop(function(){
      setTimeout(function(){
        self.restartFlag = false
        start(cb)
      },200)
    })
  }

  function stop(cb) {
    self.stopFlag = true
    info(function(err,data){
      if (err) return cb(err)
      if (data.running) {
        var timer = setTimeout(function(){
          cb('tried to kill process (pid:'+data.pid+') but it did not exit yet')
        },4000)
        psTree(data.pid, function(err, children){
          var pids = children.map(function (p) {return p.PID})
          pids.unshift(data.pid)
          spawn('kill', ['-9'].concat(pids)).on('exit',function(){
            self.stopFlag = false
            clearTimeout(timer)
            cb(err,data)
            if (!self.restartFlag) process.exit(0)
          })
        })
      }
      else {
        self.stopFlag = false
        cb(err,data)
        if (!self.restartFlag) process.exit(0)
      }
    })
  }

  function info(cb) {
    var now = Date.now()
      , uptime = now-self.ctime
    cb( null
      , { id : self.id
        , running : self.child ? true : false
        , crashed : self.crashed
        , name : self.name
        , command : self.command
        , script : self.script
        , package : self.package
        , monitorPid : process.pid
        , pid : self.child ? self.child.pid : null
        , ctime : self.ctime
        , uptime : uptime
        , options : self.options
        , env : self.env
        , max : self.max
        } )
  }
}

