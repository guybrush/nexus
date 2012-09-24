#!/usr/bin/env node

// this script gets executed when a monitor crashes
// it increases the crashed-count of the monitor in the db
// also it will exec the onError-command if provided
  
var cp = require('child_process')
var cfg = JSON.parse(process.env.NEXUS_CONFIG)
var id = process.env.NEXUS_ID
var nexus = require('../')(cfg)

cp.exec('echo '+JSON.stringify(process.env.NEXUS_CONFIG)+' >> MONERROR_ENV.txt')

nexus.initDb(function(){
  nexus.db.forEach(function(k,v){
    if (k!=id) return
    v.crashed++
    nexus.db.set(k,v)
    if (v.nexus && v.nexus.error && typeof v.nexus.error == 'string') {
      var env = process.env
      env.NEXUS_MONITOR = v
      cp.exec(v.nexus.error,{env:env}) 
      // maybe it should throw if the cmd fails?
      // maybe a timeout for exec would be good?
    }
  })
})
