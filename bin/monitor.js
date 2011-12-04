#!/usr/bin/env node

var nexus = require('../')
  , dnode = require('dnode')
  , _ = require('underscore')
  , fork = require('child_process').fork
  , spawn = require('child_process').spawn
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})

if (!process.env.NEXUS_MONITOR) {
  process.on('message',function(data){
    process.env.NEXUS_MONITOR = true
    var child = fork(__filename,[],{env:process.env})
    child.send(data)
    child.on('message',function(m){
      process.send(m)
      process.exit()
    })
  })
}
else {
  delete process.env.NEXUS_MONITOR
  process.on('message',function(m){
    monitor(m,function(s){
      process.send({data:{pid:process.pid}})
      var dnodeMonitor = dnode(s)
      dnodeMonitor.connect(5000,{reconnect:100})
      dnodeMonitor.on('error',function(err){
        if (err.code != 'ECONNREFUSED') console.log(err)
      })
    })
  })
}

ee2.onAny(function(data){
  var self = this
  _.each(subscriptions,function(x,i){
    if (x.events.indexOf(self.event)) {
      x.emit && x.emit(self.event,data)
    }
  })
})

function monitor(opts, cb) {
  var self = this
  
  self.subscriptions = {}
  self.crashed = 0
  self.ctime = 0
  self.env = opts.env
  self.package = opts.package
  self.restartFlag = false
  self.child = null
  
  start(function(){
    function server(remote, conn) {
      this.type = 'NEXUS_MONITOR'
      this.monitorPid = process.pid
      this.pid = self.child.pid
      this.crashed = self.crashed
      this.ctime = self.ctime
      this.package = self.package
      this.start = start
      this.restart = restart
      this.stop = stop
      this.subscribe = function(event, cb) {
        self.subscriptions[conn.id] = 
          self.subscriptions[conn.id] || {events:[],emit:null}
        if (self.subscriptions[conn.id].events.indexOf(event) != -1)
          self.subscriptions[conn.id].events.push(event)
        self.subscriptions[conn.id].emit = cb
      }
      this.unsubscribe = function(cb) {
        delete self.subscriptions[conn.id]
        cb()
      }
    }
    cb(server)
  })
  
  function start(cb) {
    
    var env = process.env
    if (opts.env) {
      for (var x in opts.env)
        env[x] = opts.env[x]
    }
    
    var child = spawn( opts.command
                     , [opts.script].concat(opts.options)
                     , { cwd : opts.cwd
                       , env : env
                       } )
    
    self.ctime = Date.now()
    
    child.stdout.on('data',function(data){
      ee2.emit('stdout', data.toString())
    })
    child.stderr.on('data',function(data){
      ee2.emit('stderr', data.toString())
    })
    child.on('exit',function(code){
      ee2.emit('exit', code)
      if (code != 0) {
        self.crashed++
        if (self.crashed <= 10) {
          // https://github.com/joyent/node/issues/2254
          start()
        }
        else {
          process.exit(0)
        }
      }
    })
    self.child = child
    cb && cb()
  }
  
  function restart(cb) {
    self.restartFlag = true
    stop(function(){start(function(){
      self.restartFlag = false
      cb()
    })})
  }
  
  function stop(cb) {
    psTree(self.child.pid, function (err, children) {
      spawn('kill', ['-9'].concat(children.map(function (p) {return p.PID})))
    })
    if (!self.restartFlag) {
      process.exit(0)
    }
    cb && cb()
  }
}

