#!/usr/bin/env node

var Hook = require('hook.io').Hook
  , nexus = require('../index')
  , config = nexus.config()
  , hook = new Hook({name:'nexus'})

hook.on('hook::ready',function(){})
hook.on('*::nexus-config',nexus.config)
hook.on('*::nexus-install',nexus.install)
hook.on('*::nexus-uninstall',nexus.uninstall)
hook.on('*::nexus-link',nexus.link)
hook.on('*::nexus-ls',nexus.ls)
hook.on('*::nexus-start',nexus.start)
hook.on('*::nexus-restart',nexus.restart)
hook.on('*::nexus-stop',nexus.stop)
hook.on('*::nexus-stopall',nexus.stopall)
hook.on('*::nexus-ps',nexus.ps)
 
hook.start(5000,function(){
  console.log(':'+config.port)
})
