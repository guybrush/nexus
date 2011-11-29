#!/usr/bin/env node

var nexus = require('../index')
  , dnode = require('dnode')
  , server = dnode(nexus)
  , _config = nexus.config()
  , info = {pid:process.pid,port:_config.port}

module.exports = server

server.pid = process.pid
server.listen(_config.port)
server.on('error',function(err){
  info.error = err
  if (!!process.send) process.send(info)
  else console.log(info)
})
server.on('ready',function(){
  if (!!process.send) process.send(info)
  else console.log(info)
})
  