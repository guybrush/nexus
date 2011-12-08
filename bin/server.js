#!/usr/bin/env node

process.title = 'nexus-server'

var fs = require('fs')
  , dnode = require('dnode')
  , AA = require('async-array')
  , _config = JSON.parse(process.env.NEXUS_CONFIG)
  , nexus = require('../')
  , opts = { port : _config.port
           , host : _config.host }
           
if (_config.key) {
  try {
    console.log('using key',_config.key)
    opts.key = fs.readFileSync(_config.key)
  } catch(e) {}
}  

if (_config.cert) {
  try {
    console.log('using cert',_config.cert)
    opts.cert = fs.readFileSync(_config.cert)
  } catch(e) {}
}

fs.readdir(_config.ca,function(err,data){
  if (data.length > 0) {
    opts.requestCert = true
    opts.rejectUnauthorized = true
    new AA(data).map(function(x,i,next){
      console.log('adding cert to ca',_config.ca+'/'+x)
      fs.readFile(_config.ca+'/'+x,'utf8',next)
    }).done(function(err, data){
      if (err) return exit(err)
      opts.ca = data
      start()
    }).exec()
  } else {
    start()
  }
})

function start() {
  console.log('starting server',opts,_config)
  var server = dnode(nexus(_config)).listen(opts)
  server.on('error',function(err){console.log(err)})
  server.on('ready',function(){
    console.log('started server')
  })
}

function exit(msg) {
  console.log(msg)
  process.exit(0)
}
  