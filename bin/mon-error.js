#!/usr/bin/env node

// this script gets executed when a monitor crashes
// it increases the crashed-count of the monitor in the db
// also it will exec the onError-command if provided
  
var cp = require('child_process')
var cfg = JSON.parse(process.env.NEXUS_CONFIG)
var id = process.env.NEXUS_ID
var nexus = require('../')(cfg)
            
nexus.initDb(function(){
  nexus.db.forEach(function(k,v){
    if (k!=id) return
    v.crashed++
    nexus.db.set(k,v)
    process.env.NEXUS_MONITOR = JSON.stringify(v)

    if (nexus._config.error)
      cp.exec(nexus._config.error,{cwd:cfg.prefix})
    if (v.nexus && v.nexus.error && typeof v.nexus.error == 'string') {
      cp.exec(v.nexus.error) 
      // maybe it should throw if the cmd fails?
      // maybe a timeout for exec would be good?
    }

  })
})
