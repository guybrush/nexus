#!/usr/bin/env node

var nexus = require('../')
  , dnode = require('dnode')
  , fork = require('child_process').fork
  , psTree = require('ps-tree')
  , EE2 = require('eventemitter2').EventEmitter2
  , ee2 = new EE2({wildcard:true,delimiter:'::',maxListeners: 20})

if (!process.env.NEXUS_MONITOR) {
  console.log('monitor-parent> going to start monitor-child')
  process.on('message',function(data){
    console.log('monitor-parent> get message from parent',data)
    var child = fork(__filename,[],{env:{NEXUS_MONITOR:true}})
    child.send(data)
    child.on('message',function(m){
      console.log('monitor-parent> get message from child',m)
      process.send(m)
      setTimeout(function(){process.exit()},20)
    })
  })
}
else {
  console.log('monitor-child> here we go')
  process.on('message',function(m){
    console.log('monitor-child> get message from parent',m)
  })
  var client = dnode(monitor)
  client.connect( 5000
                , {reconnect:100}
                , function(remote,conn){
    conn.on('remote',function(rem){
      process.send({data:{pid:process.pid}})
    })
  })
  client.on('error',function(err){
    if (err.code != 'ECONNREFUSED')
      process.send({error:err})
  })
}


function monitor(remote, conn) {
  var self = this
  
  self.type = 'NEXUS_MONITOR'
  self.monitorPid = process.pid
  self.crashed = 0
  
  self.start = function() {
    var child = spawn('node',[__dirname+'/testscript.js'])
    ee2.emit('start')
    self.pid = child.pid
    self.ctime = Date.now()
    self.env = {}
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
        if (!self.forceStop) return
        else {
          if (self.crashed <= 10) {
            self.start()
          }
        }
      }
    })
  }
  
  self.stop = function(cb) {
    self.forceStop = true
    psTree(self.pid, function (err, children) {
      spawn('kill', ['-9'].concat(children.map(function (p) {return p.PID})))
    })
    server.close()
    cb()
    process.exit(0)
  }
  
  self.restart = function(cb) {
    self.forceStop = true
    psTree(self.pid, function (err, children) {
      spawn('kill', ['-9'].concat(children.map(function (p) {return p.PID})))
      // setTimeout(function(){start()},50)
      start()
    })
  }
  
  self.subscribe = function(what, cb) {
    ee2.on(what,function(data){
      cb(null,this.event,data)
    })
  }
}



/*

var child = spawn( data.command
                 , [data.script].concat(data.options)
                 , { env : env
                   , cwd : data.cwd
                   } )

var id = opts.id || uuid()

if (!procs[id]) { 
  procs[id] = data
  procs[id].id = id
  procs[id].crashed = 0
  procs[id].ctime = Date.now()
  procs[id].env = data.env
}

procs[id].pid = child.pid

ee.emit('started::'+id, procs[id])
child.stdout.on('data',function(data){
  ee.emit('stdout::'+id, data.toString())
})
child.stderr.on('data',function(data){
  ee.emit('stderr::'+id, data.toString())
})
child.on('exit',function(code){
  ee.emit('exited::'+id, code)
  if (code != 0) {
    procs[id].crashed++
    var toStopIndex = toStop.indexOf(id)
    if (toStopIndex != -1) {
      toStop.splice(toStopIndex)
      delete procs[id]
    }
    else {
      if (procs[id].crashed <= 10) {
        opts.id = id
        start(opts)
      } else {
        delete procs[id]
      }
    }
  }
})
cb && cb(null, procs[id])

*/

