#!/bin/sh
# Location LODer
#
# chkconfig: 35 82 16
# description: locationLODer
### BEGIN INIT INFO
# Provides: locationLODer
# Required-Start: 
# Default-Start: 2 3 4 5
# Default-Stop: 0 1 6
# Short-Description: locationLODer
# Description: locationLODer
### END INIT INFO


DIR=/home/driie/apps/location-loder
USER=driie

PIDFILE='locationLODer.pid'


case "$1" in
  start)
	# Start daemons.
	pushd $DIR  &> /dev/null
	echo -n "Starting locationLODer: "
	su $USER -c "nohup python server.py &> access.log" &
	if [ $? -eq 0 ]; then
	    echo $! > $PIDFILE
	    chown $USER.$USER $DIR/$PIDFILE
	    echo "done"
	else
	    echo  "error"
	fi
	echo
	popd  &> /dev/null
	;;
  stop)
	# Stop daemons.
	echo -n "Shutting down locationLODer: "
	kill -15 `cat $DIR/$PIDFILE`
	rm $DIR/$PIDFILE
	echo "done"
	echo
	;;
  *)
	echo "Usage: $0 {start|stop}"
	exit 1
esac

exit 0
