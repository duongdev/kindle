#!/bin/sh
# Name: Dashboard
# Author: kindle-dashboard
# DontUseFBInk

# Stock-home launcher: opens KOReader straight into the dashboard viewer (issue 10).
# The plugin reads and removes this flag at start.
touch /tmp/dashboard.autostart
/var/local/kmc/bin/kpm launch koreader --asap
