#!/bin/bash

rclone sync googledrive:Notes googledrive:Notes\ Backup/Daily \
	--verbose --progress \
