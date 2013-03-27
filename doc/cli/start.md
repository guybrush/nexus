# nexus-start(1) -- start a program

## SYNOPSIS

    nexus start <installedProgram> [-- <startCommand>]
    
## DESCRIPTION

start a program

## EXAMPLES

    nexus start someInstalledProgram
    nexus start someInstalledProgram -- node server.js
    nexus -r someRemote start someInstalledProgram -- node app.js -p 1337
