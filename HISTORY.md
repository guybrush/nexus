
0.1.0 / 2012-09-24 
==================

  * refactor with mon

0.0.48 / 2012-07-19 
===================

  * running programs are `require('child_process').spawn`'ed child-processes of
    monitor-servers (dnode-clients). monitor-servers connect (and reconnect) to
    the nexus-server (dnode-server). the nexus-server is also a
    `require('child_process').spawn`'ed child-process of a monitor-server -
    which itself will connect (and reconnect) to its own child-process
