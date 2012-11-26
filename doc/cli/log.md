# nexus-log(1) -- Access and manage nexus-logs

## SYNOPSIS

    nexus logs <command> [<options>]

## DESCRIPTION

Access and manage nexus-logs

## COMMANDS

### list

### cleanup

### tail

    nexus tail <appId> [<options>]
    
#### OPTIONS

* `-f` - follow
* `-n <n>` - last `<n>` lines 

## EXAMPLES

Print the last `50` lines of the log-file corresponding to the application
with the id `idY`

    nexus tail idY -n 50

Print the last `50` lines of the log-file corresponding to the application 
with the id `idY` running on a remote nexus `remoteX` and follow the output:

    nexus -r remoteX tail idY -n 50 -f   
