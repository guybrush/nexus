# nexus-exec(1) -- Execute a command

## SYNOPSIS

    nexus exec <program-name> -- <command>
    
## DESCRIPTION
    
## EXAMPLES

    nexus exec myProgram -- node -e "console.log('hello')"
    nexus exec myProgram -- pwd
    nexus exec -r someRemote someProgram -- ls
