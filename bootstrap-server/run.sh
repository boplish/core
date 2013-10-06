#!/bin/bash

BASEDIR=$(dirname $0)

. $BASEDIR/../bin/activate
python $BASEDIR/run.py
